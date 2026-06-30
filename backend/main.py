"""
HireMinds API — FastAPI backend
Wraps all AI/ML logic and serves the real candidates.jsonl dataset.

Run with:  uvicorn main:app --reload --port 8000
"""
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ──────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────
app = FastAPI(title="HireMinds API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # dev only — tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# candidates.jsonl is expected next to this file (or set HIREMINDS_DATA env var)
DATA_PATH = os.environ.get(
    "HIREMINDS_DATA",
    str(Path(__file__).parent / "candidates.jsonl")
)

# ──────────────────────────────────────────────
# Safe parsing helpers — mapped to the REAL nested schema
# ──────────────────────────────────────────────

def safe_name(c):
    return c.get("profile", {}).get("anonymized_name", "N/A")

def safe_experience(c):
    return c.get("profile", {}).get("years_of_experience", 0) or 0

def safe_role(c):
    return c.get("profile", {}).get("current_title", "N/A")

def safe_headline(c):
    return c.get("profile", {}).get("headline", "")

def safe_summary(c):
    return c.get("profile", {}).get("summary", "")

def safe_location(c):
    p = c.get("profile", {})
    loc = p.get("location", "")
    country = p.get("country", "")
    return ", ".join(x for x in [loc, country] if x)

def safe_industry(c):
    return c.get("profile", {}).get("current_industry", "N/A")

def safe_company(c):
    return c.get("profile", {}).get("current_company", "N/A")

def safe_skills(c):
    """skills is a LIST of objects: [{'name': 'Spark', 'proficiency': ...}]"""
    s = c.get("skills", [])
    if isinstance(s, list):
        return [x.get("name") for x in s if isinstance(x, dict) and x.get("name")]
    return []

def safe_skill_objects(c):
    s = c.get("skills", [])
    return s if isinstance(s, list) else []

def safe_skill_scores(c):
    return c.get("redrob_signals", {}).get("skill_assessment_scores", {}) or {}

def safe_salary_range(c):
    sr = c.get("redrob_signals", {}).get("expected_salary_range_inr_lpa", {})
    if isinstance(sr, dict):
        return sr.get("min", 0) or 0, sr.get("max", 0) or 0
    return 0, 0

def safe_signal(c, key, default=None):
    return c.get("redrob_signals", {}).get(key, default)

# ── Skill expansion map: related skills imply each other ──
# If a candidate has a skill on the right, they implicitly know the concept on the left.
SKILL_IMPLIES = {
    "machine learning": ["tensorflow", "pytorch", "scikit-learn", "keras", "xgboost",
                          "deep learning", "neural networks", "model training"],
    "deep learning": ["tensorflow", "pytorch", "keras", "cnn", "rnn", "transformers"],
    "data science": ["pandas", "numpy", "scikit-learn", "statistics", "jupyter"],
    "nlp": ["transformers", "bert", "spacy", "nltk", "huggingface", "llm"],
    "data engineering": ["spark", "kafka", "airflow", "hadoop", "etl"],
    "cloud": ["aws", "azure", "gcp", "ec2", "s3", "lambda"],
    "devops": ["docker", "kubernetes", "jenkins", "ci/cd", "terraform"],
    "backend": ["fastapi", "django", "flask", "node", "express", "spring"],
    "frontend": ["react", "vue", "angular", "javascript", "typescript"],
}

def expand_skills(skill_list):
    """Given a candidate's skills, infer related higher-level skills they likely have."""
    have = {s.lower() for s in skill_list}
    inferred = set()
    for concept, children in SKILL_IMPLIES.items():
        if any(child in have for child in children):
            if concept not in have:
                inferred.add(concept)
    return inferred  # set of inferred concept skills

def profile_quality(c):
    """
    Returns (quality_score 0..1, flags list).
    Detects suspicious / low-quality profiles. Higher score = more trustworthy.
    """
    flags = []
    score = 1.0
    sig = c.get("redrob_signals", {})
    prof = c.get("profile", {})
    skills = c.get("skills", [])

    # 1. Unverified contact
    if sig.get("verified_email") is False:
        score -= 0.10; flags.append("Email not verified")
    if sig.get("verified_phone") is False:
        score -= 0.05; flags.append("Phone not verified")

    # 2. Low completeness
    comp = sig.get("profile_completeness_score")
    if isinstance(comp, (int, float)) and comp < 40:
        score -= 0.15; flags.append("Very incomplete profile")

    # 3. Claims expert skills but zero endorsements (possible inflation)
    end = sig.get("endorsements_received", 0) or 0
    expert_skills = [s for s in skills if isinstance(s, dict)
                     and str(s.get("proficiency", "")).lower() in ("expert", "advanced")]
    if len(expert_skills) >= 5 and end == 0:
        score -= 0.15; flags.append("Many expert skills but no endorsements")

    # 4. Experience vs skill mismatch (claims senior exp but very few skills)
    yoe = prof.get("years_of_experience", 0) or 0
    if yoe >= 10 and len(skills) <= 2:
        score -= 0.10; flags.append("High experience but very few skills listed")

    # 5. Suspiciously high / impossible numbers
    if isinstance(yoe, (int, float)) and yoe > 45:
        score -= 0.20; flags.append("Implausible years of experience")

    return max(0.0, score), flags

def safe_education(c):
    edu = c.get("education", [])
    if isinstance(edu, list) and edu:
        first = edu[0]
        if isinstance(first, dict):
            deg = first.get("degree", "")
            inst = first.get("institution", first.get("school", ""))
            return ", ".join(x for x in [deg, inst] if x) or "N/A"
    return "N/A"

def candidate_text(c):
    """Build the searchable text blob for TF-IDF."""
    parts = [
        " ".join(safe_skills(c)),
        safe_role(c), safe_headline(c), safe_summary(c),
        safe_industry(c), safe_education(c),
    ]
    for k in safe_skill_scores(c).keys():
        parts.append(str(k))
    return " ".join(p for p in parts if p).lower()

def candidate_summary(c):
    """Compact dict sent to the frontend."""
    mn, mx = safe_salary_range(c)
    return {
        "id": c.get("candidate_id"),
        "name": safe_name(c),
        "role": safe_role(c),
        "headline": safe_headline(c),
        "experience": round(float(safe_experience(c)), 1),
        "location": safe_location(c),
        "industry": safe_industry(c),
        "company": safe_company(c),
        "education": safe_education(c),
        "skills": safe_skills(c)[:15],
        "skill_scores": safe_skill_scores(c),
        "salary_min": mn,
        "salary_max": mx,
        "github_score": (lambda g: g if isinstance(g, (int, float)) and g >= 0 else None)(safe_signal(c, "github_activity_score")),
        "connections": safe_signal(c, "connection_count"),
        "endorsements": safe_signal(c, "endorsements_received"),
        "work_mode": safe_signal(c, "preferred_work_mode", "unknown"),
        "relocate": safe_signal(c, "willing_to_relocate"),
        "notice_days": safe_signal(c, "notice_period_days"),
        "open_to_work": safe_signal(c, "open_to_work_flag"),
        "completeness": safe_signal(c, "profile_completeness_score"),
        "response_rate": safe_signal(c, "recruiter_response_rate"),
    }

# ──────────────────────────────────────────────
# Data loading (cached in memory at startup)
# ──────────────────────────────────────────────
_CANDIDATES = []
_TEXTS = []
_VECTORIZER = None
_TFIDF_MATRIX = None

# ── Semantic matching (sentence embeddings) ──
# Understands MEANING, so "ML Engineer" ~ "Machine Learning Developer".
# Loads a small local model (no API key, runs offline). Falls back to
# TF-IDF only if the library/model isn't available.
_EMBEDDER = None
_EMBEDDINGS = None
_SEMANTIC_ON = False

def _init_embedder():
    global _EMBEDDER, _SEMANTIC_ON
    try:
        from sentence_transformers import SentenceTransformer
        # all-MiniLM-L6-v2: tiny (~80MB), fast, great for semantic search
        _EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
        _SEMANTIC_ON = True
        print("[OK] Semantic model loaded (all-MiniLM-L6-v2)")
    except Exception as e:
        _SEMANTIC_ON = False
        print(f"[WARN] Semantic model unavailable ({e}); using TF-IDF only")

def load_data(limit=10000):
    global _CANDIDATES, _TEXTS, _VECTORIZER, _TFIDF_MATRIX, _EMBEDDINGS
    candidates = []
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= limit:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    candidates.append(json.loads(line))
                except Exception:
                    continue
    except FileNotFoundError:
        print(f"[WARN] {DATA_PATH} not found — running with empty dataset")

    _CANDIDATES = candidates
    _TEXTS = [candidate_text(c) for c in candidates]

    if _TEXTS:
        _VECTORIZER = TfidfVectorizer(stop_words="english", ngram_range=(1, 2),
                                      max_features=8000)
        _TFIDF_MATRIX = _VECTORIZER.fit_transform(_TEXTS)

        # Build semantic embeddings once (this is the meaning-based index)
        if _SEMANTIC_ON and _EMBEDDER is not None:
            try:
                print(f"[..] Building semantic embeddings for {len(_TEXTS)} candidates...")
                _EMBEDDINGS = _EMBEDDER.encode(
                    _TEXTS, batch_size=64, show_progress_bar=False,
                    convert_to_numpy=True, normalize_embeddings=True)
                print("[OK] Semantic embeddings ready")
            except Exception as e:
                print(f"[WARN] Embedding build failed ({e}); using TF-IDF only")
                _EMBEDDINGS = None
    print(f"[OK] Loaded {len(candidates)} candidates")

@app.on_event("startup")
def _startup():
    _init_embedder()
    load_data()

# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────
class MatchRequest(BaseModel):
    job_description: str
    top_n: int = 10
    work_mode: Optional[str] = None
    budget_max: Optional[float] = None   # max salary (LPA) HR is willing to pay
    # Optional custom signal weights (0..100 each). If omitted, sensible defaults used.
    weights: Optional[dict] = None
    recruiter: str = "default"           # used to flag already-shortlisted candidates

class SalaryRequest(BaseModel):
    experience: float
    skills: list[str]

class SkillGapRequest(BaseModel):
    target_role: str
    current_skills: list[str]

# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "candidates": len(_CANDIDATES)}

@app.get("/api/stats")
def stats():
    """Sidebar + analytics summary stats."""
    if not _CANDIDATES:
        return {"total": 0}
    exps, skill_counts, modes, roles = [], [], {}, {}
    github_scores, completeness = [], []
    salary_mins = []
    for c in _CANDIDATES:
        exps.append(float(safe_experience(c)))
        skill_counts.append(len(safe_skills(c)))
        m = safe_signal(c, "preferred_work_mode", "unknown")
        modes[m] = modes.get(m, 0) + 1
        r = safe_role(c)
        roles[r] = roles.get(r, 0) + 1
        g = safe_signal(c, "github_activity_score")
        if g is not None:
            github_scores.append(g)
        comp = safe_signal(c, "profile_completeness_score")
        if comp is not None:
            completeness.append(comp)
        mn, _ = safe_salary_range(c)
        if mn:
            salary_mins.append(mn)

    top_roles = sorted(roles.items(), key=lambda x: -x[1])[:8]
    return {
        "total": len(_CANDIDATES),
        "avg_experience": round(sum(exps) / len(exps), 1) if exps else 0,
        "avg_skills": round(sum(skill_counts) / len(skill_counts), 1) if skill_counts else 0,
        "avg_github": round(sum(github_scores) / len(github_scores), 1) if github_scores else None,
        "avg_completeness": round(sum(completeness) / len(completeness), 1) if completeness else None,
        "experience_dist": exps,
        "skills_dist": skill_counts,
        "work_modes": modes,
        "top_roles": [{"role": r, "count": n} for r, n in top_roles],
        "salary_mins": salary_mins,
    }

@app.post("/api/match")
def match(req: MatchRequest):
    """Weighted candidate matching: text relevance + skill assessments + signals."""
    if not _CANDIDATES:
        raise HTTPException(503, "No candidate data loaded")

    pool_idx = list(range(len(_CANDIDATES)))
    if req.work_mode and req.work_mode.lower() != "any":
        pool_idx = [i for i in pool_idx
                    if str(safe_signal(_CANDIDATES[i], "preferred_work_mode", "")).lower()
                    == req.work_mode.lower()]
        if not pool_idx:
            pool_idx = list(range(len(_CANDIDATES)))

    jd_lower = req.job_description.lower()
    jd_vec = _VECTORIZER.transform([jd_lower])
    sub_matrix = _TFIDF_MATRIX[pool_idx]
    tfidf_scores = cosine_similarity(jd_vec, sub_matrix).flatten()

    # Semantic similarity — understands MEANING, not just words.
    # This is what lets "ML Engineer" match "Machine Learning Developer".
    use_semantic = _EMBEDDINGS is not None and _EMBEDDER is not None
    if use_semantic:
        try:
            jd_emb = _EMBEDDER.encode([req.job_description], convert_to_numpy=True,
                                      normalize_embeddings=True)[0]
            sub_emb = _EMBEDDINGS[pool_idx]
            # cosine = dot product (already normalized)
            semantic_scores = sub_emb @ jd_emb
        except Exception:
            use_semantic = False
            semantic_scores = tfidf_scores
    else:
        semantic_scores = tfidf_scores

    # Combined text relevance: 70% semantic meaning + 30% keyword exactness.
    # Semantic leads (understanding), TF-IDF keeps exact-term precision.
    if use_semantic:
        text_scores = 0.70 * semantic_scores + 0.30 * tfidf_scores
    else:
        text_scores = tfidf_scores

    # Which skills does the JD actually mention? (for explanations)
    jd_words = set(jd_lower.replace(",", " ").split())

    # ── Signal weights (normalised). HR can override via req.weights ──
    default_w = {
        "text": 40,        # semantic + keyword job relevance
        "skills": 20,      # tested skill assessment scores on JD skills
        "github": 8,       # github activity
        "endorsements": 8, # peer endorsements (social proof)
        "connections": 4,  # network size
        "salary_fit": 8,   # fits within budget / reasonable
        "work_pref": 6,    # work-mode preference match
        "availability": 4, # shorter notice period = more available
        "completeness": 2, # profile completeness
    }
    w = dict(default_w)
    if req.weights:
        for k, v in req.weights.items():
            if k in w and isinstance(v, (int, float)):
                w[k] = float(v)
    w_total = sum(w.values()) or 1.0
    wn = {k: v / w_total for k, v in w.items()}  # normalised 0..1

    scored = []
    for local_i, gi in enumerate(pool_idx):
        c = _CANDIDATES[gi]
        text_score = float(text_scores[local_i])  # 0..1

        # Signal: tested skill scores on JD-relevant skills
        skill_scores = safe_skill_scores(c)
        relevant = {k: v for k, v in skill_scores.items() if k.lower() in jd_words}
        assess_score = (sum(relevant.values()) / (len(relevant) * 100)) if relevant else 0.0

        # ── Skill expansion: infer related skills the candidate implicitly has ──
        cand_skill_names = safe_skills(c)
        inferred_skills = expand_skills(cand_skill_names)
        # bonus if inferred skills match the job words the candidate didn't list explicitly
        inferred_match = [s for s in inferred_skills if s in jd_words]
        skill_expand_bonus = min(len(inferred_match) * 0.15, 0.45)  # up to +45%

        # ── Profile quality / trust check ──
        quality_score, quality_flags = profile_quality(c)

        # Signal: github activity (0..1)
        gh = safe_signal(c, "github_activity_score")
        gh_norm = (gh / 100.0) if isinstance(gh, (int, float)) and gh >= 0 else 0.0

        # Signal: endorsements (0..1, capped at 50 endorsements = full)
        end = safe_signal(c, "endorsements_received")
        end_norm = min((end or 0) / 50.0, 1.0) if isinstance(end, (int, float)) else 0.0

        # Signal: connections (0..1, capped at 500 = full)
        conn = safe_signal(c, "connection_count")
        conn_norm = min((conn or 0) / 500.0, 1.0) if isinstance(conn, (int, float)) else 0.0

        # Signal: salary fit (1.0 if within budget, scaled down if over)
        mn, mx = safe_salary_range(c)
        if req.budget_max and mx:
            salary_fit = 1.0 if mx <= req.budget_max else max(0.0, 1.0 - (mx - req.budget_max) / req.budget_max)
        else:
            salary_fit = 0.7  # neutral when no budget specified

        # Signal: work-mode preference match
        cand_mode = str(safe_signal(c, "preferred_work_mode", "")).lower()
        if req.work_mode and req.work_mode.lower() != "any":
            work_pref = 1.0 if cand_mode == req.work_mode.lower() else 0.3
        else:
            work_pref = 0.7  # neutral

        # Signal: availability (shorter notice = better; 0 days = 1.0, 90+ = low)
        notice = safe_signal(c, "notice_period_days")
        if isinstance(notice, (int, float)):
            availability = max(0.0, 1.0 - notice / 90.0)
        else:
            availability = 0.5

        # Signal: completeness (0..1)
        comp = safe_signal(c, "profile_completeness_score")
        comp_norm = (comp / 100.0) if isinstance(comp, (int, float)) else 0.0

        # ── Weighted final score across ALL signals ──
        final = (wn["text"] * text_score +
                 wn["skills"] * assess_score +
                 wn["github"] * gh_norm +
                 wn["endorsements"] * end_norm +
                 wn["connections"] * conn_norm +
                 wn["salary_fit"] * salary_fit +
                 wn["work_pref"] * work_pref +
                 wn["availability"] * availability +
                 wn["completeness"] * comp_norm)

        # Skill expansion: small boost to text relevance for inferred matching skills
        final += wn["text"] * skill_expand_bonus * 0.5

        # Profile quality acts as a trust multiplier (low-quality profiles ranked down)
        # quality_score is 0..1; we keep at least 70% so a flag doesn't fully sink a strong match
        final *= (0.7 + 0.3 * quality_score)

        # Per-candidate signal breakdown (transparency)
        breakdown = {
            "text": round(text_score * 100),
            "skills": round(assess_score * 100),
            "github": round(gh_norm * 100),
            "endorsements": round(end_norm * 100),
            "connections": round(conn_norm * 100),
            "salary_fit": round(salary_fit * 100),
            "work_pref": round(work_pref * 100),
            "availability": round(availability * 100),
            "completeness": round(comp_norm * 100),
        }

        # Human explanation
        cand_skills = [s.lower() for s in safe_skills(c)]
        matched_skills = [s for s in safe_skills(c) if s.lower() in jd_words]
        missing = [w_.title() for w_ in jd_words
                   if w_ in {sk.lower() for sk in
                            ['python', 'sql', 'spark', 'aws', 'docker', 'kafka', 'airflow',
                             'tensorflow', 'pytorch', 'react', 'java', 'nlp', 'tableau',
                             'powerbi', 'excel', 'pandas', 'kubernetes', 'mlops']}
                   and w_ not in cand_skills][:3]

        parts = []
        if relevant:
            top_assessed = sorted(relevant.items(), key=lambda x: -x[1])[:2]
            parts.append("Strong on " + ", ".join(f"{k} ({int(v)}%)" for k, v in top_assessed))
        elif matched_skills:
            parts.append("Has " + ", ".join(matched_skills[:3]))
        if isinstance(end, (int, float)) and end >= 20:
            parts.append(f"{int(end)} endorsements")
        if req.budget_max and mx and mx <= req.budget_max:
            parts.append("within budget")
        if isinstance(notice, (int, float)) and notice <= 30:
            parts.append("available soon")
        if missing:
            parts.append("missing " + ", ".join(missing))
        explanation = "; ".join(parts) if parts else "General profile match"

        # ── Strengths and Concerns (transparency on both sides) ──
        strengths, concerns = [], []
        if breakdown["text"] >= 60: strengths.append("Strong job relevance")
        elif breakdown["text"] < 35: concerns.append("Weak match to job requirements")
        if breakdown["skills"] >= 60: strengths.append("High tested skill scores")
        elif breakdown["skills"] < 25 and relevant: concerns.append("Low skill assessment scores")
        if breakdown["github"] >= 50: strengths.append("Active on GitHub")
        if breakdown["endorsements"] >= 40: strengths.append("Strong peer endorsements")
        elif breakdown["endorsements"] < 10: concerns.append("Few endorsements")
        if req.budget_max and breakdown["salary_fit"] >= 90: strengths.append("Fits budget")
        elif req.budget_max and breakdown["salary_fit"] < 30: concerns.append("Salary above budget")
        if breakdown["availability"] >= 80: strengths.append("Available soon")
        elif breakdown["availability"] < 30: concerns.append("Long notice period")
        if req.work_mode and req.work_mode.lower() != "any" and breakdown["work_pref"] < 50:
            concerns.append(f"Prefers different work mode")
        if missing: concerns.append("Missing key skills: " + ", ".join(missing))
        # Skill expansion adds a strength (shows the system understood related skills)
        if inferred_match:
            strengths.append("Related expertise: " + ", ".join(s.title() for s in inferred_match[:2]))
        # Profile quality flags become concerns (trust transparency)
        for fl in quality_flags[:2]:
            concerns.append(fl)

        if not concerns: concerns.append("No major concerns")

        scored.append((gi, final, text_score, assess_score, explanation, breakdown, strengths, concerns))

    scored.sort(key=lambda x: -x[1])

    # Distribution of ALL scores (for the chart) — buckets of 10%
    dist = [0] * 10
    for s in scored:
        b = min(int(s[1] * 100 // 10), 9)
        dist[b] += 1
    distribution = [{"range": f"{i*10}-{i*10+10}%", "count": dist[i]} for i in range(10)]
    top = scored[:req.top_n]

    # Look up which candidates this recruiter has already shortlisted
    _sl_data = _load_shortlists()
    already_ids = {c.get("id") for c in _sl_data.get(req.recruiter, [])}

    results = []
    for rank, (gi, final, text_score, assess_score, explanation, breakdown, strengths, concerns) in enumerate(top):
        summary = candidate_summary(_CANDIDATES[gi])
        summary["match_score"] = round(final * 100, 1)
        summary["strengths"] = strengths
        summary["concerns"] = concerns
        summary["text_score"] = round(text_score * 100, 1)
        summary["assessment_score"] = round(assess_score * 100, 1)
        summary["explanation"] = explanation
        summary["breakdown"] = breakdown
        summary["rank"] = rank + 1
        summary["already_shortlisted"] = summary.get("id") in already_ids
        results.append(summary)
    return {"results": results, "pool_size": len(pool_idx),
            "match_method": "semantic+keyword" if use_semantic else "keyword",
            "weights_used": w, "distribution": distribution}

@app.get("/api/plagiarism")
def plagiarism(threshold: float = 0.85, sample: int = 150):
    """Flag suspiciously similar profiles using cosine similarity."""
    if len(_CANDIDATES) < 2:
        return {"flagged": []}
    sub = _TFIDF_MATRIX[:sample]
    sim = cosine_similarity(sub)
    flagged = []
    for i in range(sim.shape[0]):
        for j in range(i + 1, sim.shape[0]):
            if sim[i, j] > threshold:
                flagged.append({
                    "c1": safe_name(_CANDIDATES[i]),
                    "c2": safe_name(_CANDIDATES[j]),
                    "similarity": round(float(sim[i, j]) * 100, 1),
                })
    flagged.sort(key=lambda x: -x["similarity"])
    return {"flagged": flagged[:50], "scanned": sample}

@app.post("/api/salary")
def salary(req: SalaryRequest):
    """Salary benchmark estimate + growth curve."""
    def est(exp, n_skills):
        base = 300000 + exp * 70000 + n_skills * 20000
        return base / 100000, (base + 250000) / 100000

    mn, mx = est(req.experience, len(req.skills))
    curve = [{"exp": e,
              "salary": round((300000 + e * 70000 + len(req.skills) * 20000) / 100000, 1)}
             for e in range(0, 16)]
    return {"min": round(mn, 1), "max": round(mx, 1), "curve": curve}

# Role skill maps for skill-gap finder
ROLE_SKILLS = {
    "Data Analyst": ["SQL", "Python", "Excel", "Power BI", "Statistics", "Tableau"],
    "Data Scientist": ["Python", "Machine Learning", "Deep Learning", "Statistics", "TensorFlow", "SQL"],
    "ML Engineer": ["Python", "TensorFlow", "Docker", "AWS", "MLOps", "PyTorch"],
    "Business Analyst": ["SQL", "Excel", "Power BI", "Communication", "JIRA", "Tableau"],
    "Software Engineer": ["Python", "Java", "AWS", "Docker", "Git", "SQL"],
    "AI Engineer": ["Python", "Deep Learning", "NLP", "TensorFlow", "MLOps", "AWS"],
    "Data Engineer": ["Python", "SQL", "Spark", "AWS", "Airflow", "Kafka"],
    "Backend Engineer": ["Python", "SQL", "Docker", "AWS", "Git", "PostgreSQL"],
}

LEARN_TIME = {
    "SQL": "1 week", "Python": "4 weeks", "Excel": "1 week", "Power BI": "2 weeks",
    "Machine Learning": "8 weeks", "TensorFlow": "6 weeks", "Docker": "2 weeks",
    "AWS": "4 weeks", "Spark": "3 weeks", "Tableau": "2 weeks", "Statistics": "4 weeks",
    "JIRA": "1 week", "PyTorch": "5 weeks", "MLOps": "4 weeks", "Airflow": "2 weeks",
    "Kafka": "3 weeks", "NLP": "5 weeks", "Deep Learning": "8 weeks", "Java": "6 weeks",
    "Git": "1 week", "Communication": "ongoing", "PostgreSQL": "2 weeks",
}

@app.get("/api/roles")
def roles():
    return {"roles": list(ROLE_SKILLS.keys())}

@app.post("/api/skillgap")
def skillgap(req: SkillGapRequest):
    required = ROLE_SKILLS.get(req.target_role, [])
    have = {s.strip().lower() for s in req.current_skills if s.strip()}
    matched = [s for s in required if s.lower() in have]
    missing = [s for s in required if s.lower() not in have]
    pct = round(len(matched) / len(required) * 100) if required else 0
    roadmap = [{"step": i + 1, "skill": s, "time": LEARN_TIME.get(s, "2-4 weeks")}
               for i, s in enumerate(missing)]
    return {"match_pct": pct, "matched": matched, "missing": missing, "roadmap": roadmap}

# Resume analysis
TECH_KEYWORDS = [
    "python", "sql", "machine learning", "deep learning", "nlp", "tensorflow",
    "pytorch", "pandas", "numpy", "scikit", "aws", "docker", "power bi", "tableau",
    "excel", "react", "fastapi", "postgresql", "git", "spark", "keras", "langchain",
    "bert", "gpt", "mongodb", "kubernetes", "airflow", "kafka", "java",
]

@app.post("/api/resume")
async def resume(file: UploadFile = File(...), jd: str = Form("")):
    import pdfplumber
    import io
    raw = await file.read()
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            for p in pdf.pages:
                t = p.extract_text()
                if t:
                    text += t + " "
    except Exception as e:
        raise HTTPException(400, f"Could not read PDF: {e}")

    text = text.strip()
    low = text.lower()
    found = [k for k in TECH_KEYWORDS if k in low]
    score = min(100, 20 + len(found) * 4)
    if len(text) > 500: score += 8
    if "github" in low: score += 5
    if "linkedin" in low: score += 4
    if any(w in low for w in ["project", "built", "developed", "deployed"]): score += 6
    if any(w in low for w in ["%", "increased", "reduced", "improved", "achieved"]): score += 7
    score = min(100, score)

    tips = []
    if len(found) < 5: tips.append("Add more technical skills relevant to your target role")
    if "github" not in low: tips.append("Include your GitHub profile URL")
    if "linkedin" not in low: tips.append("Add your LinkedIn profile URL")
    if not any(w in low for w in ["%", "increased", "reduced", "improved"]):
        tips.append("Quantify achievements (e.g. 'Improved accuracy by 15%')")
    if len(text) < 300: tips.append("Expand project descriptions with technologies and outcomes")

    match_score = 0
    if jd.strip():
        try:
            v = TfidfVectorizer(stop_words="english")
            m = v.fit_transform([jd.lower(), low])
            match_score = round(float(cosine_similarity(m[0:1], m[1:])[0][0]) * 100, 1)
        except Exception:
            pass

    return {
        "score": score,
        "words": len(text.split()),
        "found_skills": [s.title() for s in found],
        "tips": tips,
        "jd_match": match_score,
    }


# ════════════════════════════════════════════════════════════
#  EMAIL — notify shortlisted candidates
# ════════════════════════════════════════════════════════════
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import email_config as _ecfg
except Exception:
    _ecfg = None

class EmailRequest(BaseModel):
    to_email: str
    candidate_name: str
    job_title: str = "the role"
    recruiter_name: str = "the hiring team"
    company: str = "our company"

def _email_enabled():
    return bool(_ecfg and getattr(_ecfg, "GMAIL_ADDRESS", "")
                and getattr(_ecfg, "GMAIL_APP_PASSWORD", ""))

@app.get("/api/email/status")
def email_status():
    """Tells the frontend whether real email is configured."""
    return {"enabled": _email_enabled(),
            "mode": "real" if _email_enabled() else "simulated"}

@app.post("/api/email/shortlist")
def email_shortlist(req: EmailRequest):
    """Send (or simulate) a 'you've been shortlisted' email."""
    subject = f"You've been shortlisted for {req.job_title}!"
    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <div style="background:linear-gradient(110deg,#004182,#0A66C2);padding:28px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">🎉 Great news, {req.candidate_name}!</h1>
      </div>
      <div style="border:1px solid #E0DFDC;border-top:none;padding:28px;border-radius:0 0 12px 12px">
        <p>You've been <b>shortlisted</b> for <b>{req.job_title}</b> at {req.company}.</p>
        <p>Our team was impressed with your profile and skills. Someone from our
        recruiting team will reach out to you shortly with the next steps.</p>
        <p>No action is needed from you right now — just keep an eye on your inbox!</p>
        <p style="margin-top:24px">Warm regards,<br><b>{req.recruiter_name}</b><br>{req.company}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#888;font-size:12px">Sent via HireMinds AI Hiring Platform</p>
      </div>
    </div>
    """

    if not _email_enabled():
        # Simulated mode — demo-safe
        return {"sent": True, "mode": "simulated",
                "message": f"(Simulated) Shortlist email prepared for {req.to_email}"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{_ecfg.SENDER_NAME} <{_ecfg.GMAIL_ADDRESS}>"
        msg["To"] = req.to_email
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(_ecfg.GMAIL_ADDRESS, _ecfg.GMAIL_APP_PASSWORD)
            server.sendmail(_ecfg.GMAIL_ADDRESS, req.to_email, msg.as_string())

        return {"sent": True, "mode": "real",
                "message": f"Email sent to {req.to_email}"}
    except Exception as e:
        return {"sent": False, "mode": "real", "error": str(e)}


# ════════════════════════════════════════════════════════════
#  FIND JOBS — match a job seeker to job descriptions
# ════════════════════════════════════════════════════════════
# A small set of realistic job postings for the seeker to match against.
JOB_POSTINGS = [
    {"id": "JOB001", "title": "Data Analyst", "company": "Vedantu", "location": "Bangalore",
     "work_mode": "hybrid", "salary": "8-14 LPA", "experience": "1-3 years",
     "description": "Looking for a Data Analyst skilled in SQL, Python, Excel, Power BI, and statistics to build dashboards and analyse business metrics."},
    {"id": "JOB002", "title": "Data Scientist", "company": "Swiggy", "location": "Bangalore",
     "work_mode": "onsite", "salary": "14-22 LPA", "experience": "2-5 years",
     "description": "Data Scientist with Python, machine learning, deep learning, statistics, TensorFlow and SQL to build predictive models."},
    {"id": "JOB003", "title": "ML Engineer", "company": "Razorpay", "location": "Remote",
     "work_mode": "remote", "salary": "16-26 LPA", "experience": "3-6 years",
     "description": "ML Engineer experienced in Python, TensorFlow, PyTorch, Docker, AWS, MLOps to deploy models to production at scale."},
    {"id": "JOB004", "title": "Data Engineer", "company": "Flipkart", "location": "Bangalore",
     "work_mode": "hybrid", "salary": "15-24 LPA", "experience": "3-6 years",
     "description": "Data Engineer with Python, SQL, Spark, Airflow, Kafka and AWS to build large-scale data pipelines and warehouses."},
    {"id": "JOB005", "title": "AI Engineer", "company": "Fractal", "location": "Mumbai",
     "work_mode": "hybrid", "salary": "18-30 LPA", "experience": "2-5 years",
     "description": "AI Engineer specialising in NLP, LLMs, LangChain, RAG, Python, deep learning and TensorFlow for conversational AI products."},
    {"id": "JOB006", "title": "Backend Engineer", "company": "Zerodha", "location": "Bangalore",
     "work_mode": "onsite", "salary": "12-20 LPA", "experience": "2-5 years",
     "description": "Backend Engineer with Python, FastAPI, PostgreSQL, Docker, AWS and Git to build scalable financial systems."},
    {"id": "JOB007", "title": "Business Analyst", "company": "Deloitte", "location": "Hyderabad",
     "work_mode": "hybrid", "salary": "9-16 LPA", "experience": "1-4 years",
     "description": "Business Analyst with SQL, Excel, Power BI, Tableau, JIRA and strong communication for stakeholder reporting."},
    {"id": "JOB008", "title": "Full Stack Developer", "company": "Postman", "location": "Remote",
     "work_mode": "remote", "salary": "14-24 LPA", "experience": "3-6 years",
     "description": "Full Stack Developer with React, Python, FastAPI, PostgreSQL, Docker and AWS for building web platforms."},
]

class FindJobsRequest(BaseModel):
    skills: list[str]
    experience: float = 0
    top_n: int = 5

@app.get("/api/jobs")
def list_jobs():
    return {"jobs": JOB_POSTINGS}

@app.post("/api/findjobs")
def find_jobs(req: FindJobsRequest):
    """Match a seeker's skills against job postings using TF-IDF."""
    seeker_text = " ".join(req.skills).lower()
    if not seeker_text.strip():
        return {"results": []}

    job_texts = [j["description"].lower() + " " + j["title"].lower() for j in JOB_POSTINGS]
    vec = TfidfVectorizer(stop_words="english")
    matrix = vec.fit_transform([seeker_text] + job_texts)
    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    ranked = sorted(zip(JOB_POSTINGS, scores), key=lambda x: -x[1])[:req.top_n]
    results = []
    for job, score in ranked:
        # which of the seeker's skills appear in the job
        jd_words = set(job["description"].lower().replace(",", " ").split())
        matched = [s for s in req.skills if s.lower() in jd_words]
        missing_from_seeker = [w.title() for w in jd_words if w in
                               {'python','sql','spark','aws','docker','kafka','airflow',
                                'tensorflow','pytorch','react','nlp','tableau','excel',
                                'mlops','fastapi','postgresql','statistics'}
                               and w not in [s.lower() for s in req.skills]][:4]
        results.append({
            **job,
            "match_score": round(float(score) * 100, 1),
            "matched_skills": matched,
            "skills_to_learn": missing_from_seeker,
        })
    return {"results": results}


# ════════════════════════════════════════════════════════════
#  AI RESUME BUILDER — Groq-powered, ATS-friendly
# ════════════════════════════════════════════════════════════
import urllib.request as _urlreq
import urllib.error as _urlerr

try:
    import groq_config as _gcfg
except Exception:
    _gcfg = None

def _groq_enabled():
    return bool(_gcfg and getattr(_gcfg, "GROQ_API_KEY", ""))

# Smart-template fallback (same logic as standalone resume.py)
_TECH_CAPS = {
    "python": "Python", "sql": "SQL", "ml": "ML", "nlp": "NLP", "ai": "AI",
    "fastapi": "FastAPI", "react": "React", "react.js": "React.js", "reactjs": "React.js",
    "postgresql": "PostgreSQL", "pandas": "pandas", "scikit-learn": "scikit-learn",
    "tf-idf": "TF-IDF", "llm": "LLM", "aws": "AWS", "docker": "Docker", "power bi": "Power BI",
    "git": "Git", "tensorflow": "TensorFlow", "pytorch": "PyTorch", "numpy": "NumPy",
    "api": "API", "apis": "APIs", "etl": "ETL", "eda": "EDA", "kpi": "KPI",
}
_VERB_BOOST = {"made dashboards": "Built dashboards", "made": "Built", "did": "Performed",
               "worked on": "Developed", "helped": "Contributed to", "used": "Leveraged",
               "created": "Developed"}
_ACTION_VERBS = ["Built", "Developed", "Designed", "Implemented", "Analysed",
                 "Engineered", "Created", "Optimised", "Delivered"]
_EXISTING_VERBS = {"built","developed","designed","implemented","analysed","analyzed",
                   "engineered","created","optimised","optimized","delivered","made","did",
                   "used","worked","helped","led","managed","improved","reduced","increased",
                   "deployed","integrated","automated","researched","architected","owned"}

def _fix_caps(text):
    joined = text
    for k, v in _TECH_CAPS.items():
        if " " in k:
            joined = joined.replace(k, v).replace(k.title(), v)
    out = []
    for w in joined.split():
        low = w.lower().strip(".,")
        out.append(_TECH_CAPS.get(low, w) if low in _TECH_CAPS else w)
    return " ".join(out)

def _template_bullets(desc):
    if not desc:
        return []
    parts = [p.strip() for p in desc.replace("\n", ".").split(".") if p.strip()]
    bullets = []
    for i, p in enumerate(parts):
        p = _fix_caps(p)
        low = p.lower()
        boosted = None
        for weak, strong in _VERB_BOOST.items():
            if low.startswith(weak):
                boosted = strong + p[len(weak):]; break
        if boosted:
            p = boosted
        else:
            first = (p.split()[0] if p.split() else "").lower().strip(".,")
            if first and first not in _EXISTING_VERBS:
                p = _ACTION_VERBS[i % len(_ACTION_VERBS)] + " " + p
        bullets.append((p[0].upper() + p[1:]) if p else p)
    return bullets

def _groq_chat(prompt, system="You are an expert resume writer."):
    """Call Groq's OpenAI-compatible endpoint via stdlib (no extra deps)."""
    body = json.dumps({
        "model": getattr(_gcfg, "GROQ_MODEL", "llama-3.3-70b-versatile"),
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": prompt}],
        "temperature": 0.6,
        "max_tokens": 1200,
    }).encode("utf-8")
    req = _urlreq.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {_gcfg.GROQ_API_KEY}",
                 "Content-Type": "application/json"},
    )
    with _urlreq.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]

class ResumeBuildRequest(BaseModel):
    name: str = ""
    headline: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    summary: str = ""
    experiences: list = []   # [{title, company, period, desc}]
    projects: list = []      # [{name, desc}]
    education: list = []     # [{degree, institution, year}]
    skills: str = ""
    certifications: str = ""
    achievements: list = []  # [str]
    interests: str = ""
    target_role: str = ""    # optional: tailor toward this role

@app.get("/api/resume-ai/status")
def resume_ai_status():
    return {"enabled": _groq_enabled(),
            "mode": "ai" if _groq_enabled() else "template"}

@app.post("/api/resume-ai/build")
def build_resume_ai(req: ResumeBuildRequest):
    """Polish rough resume notes into ATS-friendly content."""
    if _groq_enabled():
        try:
            payload = req.model_dump()
            prompt = f"""Rewrite the following resume notes into polished, ATS-friendly content.
Rules:
- Use strong action verbs (Architected, Built, Engineered, Delivered, Analysed).
- Keep each bullet concise (one line, no fluff). Quantify where reasonable.
- Fix capitalisation of tech terms (Python, SQL, FastAPI, AWS, Power BI, etc).
- Polish the summary into 2-3 strong sentences.
- Return STRICT JSON only, no markdown, with this exact shape:
{{"summary": "...", "experiences": [{{"title":"","company":"","period":"","bullets":["",""]}}],
"projects": [{{"name":"","bullets":["",""]}}], "achievements": ["",""]}}
{f'Tailor the tone toward a {req.target_role} role.' if req.target_role else ''}

NOTES:
{json.dumps(payload, indent=2)}"""
            raw = _groq_chat(prompt)
            # strip markdown fences if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            ai = json.loads(raw)
            return {"mode": "ai", "data": _merge_ai(req, ai)}
        except Exception as e:
            # fall back to template on any failure
            return {"mode": "template", "data": _template_build(req), "note": f"AI failed: {e}"}
    else:
        return {"mode": "template", "data": _template_build(req)}

def _merge_ai(req, ai):
    """Combine AI-polished text with the structured fields we need."""
    exps = []
    ai_exps = ai.get("experiences", [])
    for i, e in enumerate(req.experiences):
        ax = ai_exps[i] if i < len(ai_exps) else {}
        exps.append({
            "title": e.get("title", ""), "company": e.get("company", ""),
            "period": e.get("period", ""),
            "bullets": ax.get("bullets") or _template_bullets(e.get("desc", "")),
        })
    projs = []
    ai_projs = ai.get("projects", [])
    for i, p in enumerate(req.projects):
        ax = ai_projs[i] if i < len(ai_projs) else {}
        projs.append({
            "name": p.get("name", ""),
            "bullets": ax.get("bullets") or _template_bullets(p.get("desc", "")),
        })
    return {
        "name": req.name, "headline": _fix_caps(req.headline), "email": req.email,
        "phone": req.phone, "location": req.location, "linkedin": req.linkedin,
        "github": req.github,
        "summary": ai.get("summary") or req.summary,
        "experiences": exps, "projects": projs,
        "education": req.education,
        "skills": [_fix_caps(s.strip()) for s in req.skills.split(",") if s.strip()],
        "certifications": req.certifications,
        "achievements": ai.get("achievements") or [_fix_caps(a) for a in req.achievements],
        "interests": [_fix_caps(s.strip()) for s in req.interests.split(",") if s.strip()],
    }

def _template_build(req):
    return {
        "name": req.name, "headline": _fix_caps(req.headline), "email": req.email,
        "phone": req.phone, "location": req.location, "linkedin": req.linkedin,
        "github": req.github, "summary": req.summary,
        "experiences": [{"title": e.get("title",""), "company": e.get("company",""),
                         "period": e.get("period",""),
                         "bullets": _template_bullets(e.get("desc",""))} for e in req.experiences],
        "projects": [{"name": p.get("name",""),
                      "bullets": _template_bullets(p.get("desc",""))} for p in req.projects],
        "education": req.education,
        "skills": [_fix_caps(s.strip()) for s in req.skills.split(",") if s.strip()],
        "certifications": req.certifications,
        "achievements": [_fix_caps(a) for a in req.achievements],
        "interests": [_fix_caps(s.strip()) for s in req.interests.split(",") if s.strip()],
    }


# ════════════════════════════════════════════════════════════
#  SHORTLIST STORAGE — persists to disk (survives restart)
# ════════════════════════════════════════════════════════════
SHORTLIST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shortlists.json")

def _load_shortlists():
    try:
        with open(SHORTLIST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_shortlists(data):
    try:
        with open(SHORTLIST_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception:
        return False

class ShortlistItem(BaseModel):
    recruiter: str = "default"   # email/id of HR user
    candidate: dict              # the candidate summary object

class ShortlistRemove(BaseModel):
    recruiter: str = "default"
    candidate_id: str

@app.get("/api/shortlist")
def get_shortlist(recruiter: str = "default"):
    """Return all shortlisted candidates for a recruiter."""
    data = _load_shortlists()
    return {"shortlist": data.get(recruiter, [])}

@app.post("/api/shortlist/add")
def add_shortlist(item: ShortlistItem):
    data = _load_shortlists()
    lst = data.get(item.recruiter, [])
    cid = item.candidate.get("id")
    if not any(c.get("id") == cid for c in lst):
        lst.append(item.candidate)
    data[item.recruiter] = lst
    _save_shortlists(data)
    return {"shortlist": lst, "saved": True}

@app.post("/api/shortlist/remove")
def remove_shortlist(req: ShortlistRemove):
    data = _load_shortlists()
    lst = [c for c in data.get(req.recruiter, []) if c.get("id") != req.candidate_id]
    data[req.recruiter] = lst
    _save_shortlists(data)
    return {"shortlist": lst, "saved": True}

@app.post("/api/shortlist/bulk")
def bulk_shortlist(items: list[ShortlistItem]):
    """Add many candidates at once (e.g. 'shortlist top 10')."""
    if not items:
        return {"shortlist": [], "saved": True}
    data = _load_shortlists()
    recruiter = items[0].recruiter
    lst = data.get(recruiter, [])
    existing = {c.get("id") for c in lst}
    for item in items:
        cid = item.candidate.get("id")
        if cid not in existing:
            lst.append(item.candidate)
            existing.add(cid)
    data[recruiter] = lst
    _save_shortlists(data)
    return {"shortlist": lst, "saved": True}

@app.get("/api/shortlist/insights")
def shortlist_insights(recruiter: str = "default"):
    """Quick analytics on the shortlisted pool."""
    lst = _load_shortlists().get(recruiter, [])
    if not lst:
        return {"count": 0}
    modes, exps, salaries = {}, [], []
    for c in lst:
        m = c.get("work_mode", "unknown")
        modes[m] = modes.get(m, 0) + 1
        if isinstance(c.get("experience"), (int, float)):
            exps.append(c["experience"])
        if c.get("salary_max"):
            salaries.append(c["salary_max"])
    return {
        "count": len(lst),
        "work_modes": modes,
        "avg_experience": round(sum(exps) / len(exps), 1) if exps else 0,
        "avg_salary_max": round(sum(salaries) / len(salaries), 1) if salaries else 0,
    }
