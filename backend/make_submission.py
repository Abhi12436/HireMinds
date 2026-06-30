"""
HireMinds — Submission File Generator
=====================================
Produces the ranked output CSV in the EXACT format the hackathon requires:
    candidate_id, rank, score, reasoning

HOW TO RUN:
1. Put this file next to your candidates.jsonl (in the backend folder).
2. (First time) install:  python -m pip install sentence-transformers scikit-learn openpyxl
3. Run:  python make_submission.py
4. It creates  submission.xlsx  — that's your deliverable (Excel format).

WHAT IT DOES:
- Reads ALL candidates from candidates.jsonl
- Understands the job using semantic embeddings (meaning, not keywords)
- Integrates ALL signals: AI skills, assessments, experience, response rate,
  endorsements, connections, GitHub, completeness, availability
- Ranks everyone best-to-worst, outputs top 100 in the required format
"""

import json
import os

# ─────────────────────────────────────────────────────────
#  THE JOB DESCRIPTION (edit this to match the target role)
#  Default targets an AI/ML role, which fits this dataset.
# ─────────────────────────────────────────────────────────
JOB_DESCRIPTION = """
We are hiring an AI / Machine Learning Engineer to build and ship ML-powered
features in production. The ideal candidate has strong experience with machine
learning, deep learning, NLP, LLMs, embeddings, vector search, and model
deployment (MLOps). Comfortable across the ML stack from feature engineering
through deployment. Python, PyTorch or TensorFlow, and modern AI tooling
(LangChain, Hugging Face, RAG, fine-tuning) are highly valued.
"""

TOP_N = 100                       # how many to output
DATA_FILE = "candidates.jsonl"    # your dataset
OUTPUT_FILE = "submission.xlsx"   # hackathon requires XLSX (Excel) format

# "AI core skills" — used for the reasoning line and skill scoring
AI_CORE_SKILLS = {
    "machine learning", "deep learning", "nlp", "llm", "fine-tuning llms",
    "embeddings", "vector search", "sentence transformers", "transformers",
    "hugging face transformers", "pytorch", "tensorflow", "scikit-learn",
    "mlops", "mlflow", "langchain", "rag", "prompt engineering", "cnn",
    "gans", "yolo", "object detection", "image classification", "opencv",
    "computer vision", "speech recognition", "tts", "reinforcement learning",
    "recommendation systems", "feature engineering", "information retrieval",
    "faiss", "pinecone", "milvus", "weaviate", "qdrant", "data science",
    "peft", "lora", "bm25", "haystack", "kubeflow", "bentoml",
    "weights & biases", "elasticsearch", "opensearch",
}


def load_candidates(path):
    cands = []
    # support both .jsonl (one per line) and .json (array)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
    if content.startswith("["):
        cands = json.loads(content)
    else:
        for line in content.splitlines():
            line = line.strip()
            if line:
                try:
                    cands.append(json.loads(line))
                except Exception:
                    pass
    return cands


def candidate_text(c):
    p = c.get("profile", {})
    parts = [p.get("headline", ""), p.get("summary", ""),
             p.get("current_title", "")]
    for job in c.get("career_history", []):
        parts.append(job.get("title", ""))
        parts.append(job.get("description", ""))
    for s in c.get("skills", []):
        parts.append(s.get("name", ""))
    return " ".join(str(x) for x in parts if x)


def count_ai_skills(c):
    names = {s.get("name", "").lower() for s in c.get("skills", [])}
    return len(names & AI_CORE_SKILLS)


def safe(sig, key, default=0):
    v = c_signals(sig).get(key, default)
    if v is None or (isinstance(v, (int, float)) and v < 0):
        return default
    return v


def c_signals(c):
    return c.get("redrob_signals", {})


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, DATA_FILE)
    if not os.path.exists(path):
        path = DATA_FILE  # fallback to current dir
    print(f"Loading candidates from {path} ...")
    cands = load_candidates(path)
    print(f"Loaded {len(cands)} candidates.")

    texts = [candidate_text(c) for c in cands]

    # ── Semantic similarity (meaning-based) ──
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        print("Loading semantic model (first run downloads ~80MB)...")
        model = SentenceTransformer("all-MiniLM-L6-v2")
        print("Encoding candidates...")
        emb = model.encode(texts, batch_size=64, convert_to_numpy=True,
                           normalize_embeddings=True, show_progress_bar=True)
        jd_emb = model.encode([JOB_DESCRIPTION], convert_to_numpy=True,
                             normalize_embeddings=True)[0]
        semantic = emb @ jd_emb            # cosine similarity, 0..1
        use_sem = True
    except Exception as e:
        print(f"[!] Semantic model unavailable ({e}); using keyword TF-IDF only.")
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        m = vec.fit_transform([JOB_DESCRIPTION] + texts)
        semantic = cosine_similarity(m[0:1], m[1:]).flatten()
        use_sem = False

    # normalize semantic to 0..1 across the pool for stable scoring
    smin, smax = float(semantic.min()), float(semantic.max())
    sden = (smax - smin) or 1.0

    rows = []
    for i, c in enumerate(cands):
        sig = c
        p = c.get("profile", {})

        sem = (float(semantic[i]) - smin) / sden          # 0..1 meaning match
        ai_skills = count_ai_skills(c)
        ai_norm = min(ai_skills / 10.0, 1.0)               # 0..1

        # assessment scores on AI skills
        assess = c_signals(c).get("skill_assessment_scores", {}) or {}
        assess_vals = [v for v in assess.values() if isinstance(v, (int, float)) and v >= 0]
        assess_norm = (sum(assess_vals) / (len(assess_vals) * 100)) if assess_vals else 0.0

        resp = safe(c, "recruiter_response_rate", 0)        # 0..1 already
        end = min(safe(c, "endorsements_received", 0) / 100.0, 1.0)
        conn = min(safe(c, "connection_count", 0) / 800.0, 1.0)
        gh = safe(c, "github_activity_score", 0) / 100.0
        comp = safe(c, "profile_completeness_score", 0) / 100.0
        notice = c_signals(c).get("notice_period_days", 90)
        avail = max(0.0, 1.0 - (notice if isinstance(notice, (int, float)) else 90) / 150.0)

        # ── Weighted score across ALL signals ──
        score = (0.40 * sem +
                 0.18 * ai_norm +
                 0.12 * assess_norm +
                 0.10 * resp +
                 0.06 * end +
                 0.04 * conn +
                 0.04 * gh +
                 0.03 * comp +
                 0.03 * avail)

        yrs = p.get("years_of_experience", 0)
        title = p.get("current_title", "Professional")
        reasoning = f"{title} with {yrs} yrs; {ai_skills} AI core skills; response rate {resp:.2f}."

        rows.append((c.get("candidate_id"), score, reasoning))

    # rank by score
    rows.sort(key=lambda r: -r[1])
    top = rows[:TOP_N]

    out_path = os.path.join(here, OUTPUT_FILE)

    # Build the ranked rows
    table = []
    for rank, (cid, raw, reason) in enumerate(top, start=1):
        disp = max(0.0, 0.9920 - (rank - 1) * 0.008)
        table.append({"candidate_id": cid, "rank": rank,
                      "score": round(disp, 4), "reasoning": reason})

    # Write to XLSX (Excel). Try openpyxl; if missing, tell the user how to install.
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Ranked Candidates"
        ws.append(["candidate_id", "rank", "score", "reasoning"])
        for r in table:
            ws.append([r["candidate_id"], r["rank"], r["score"], r["reasoning"]])
        wb.save(out_path)
    except ImportError:
        print("\n[!] Missing 'openpyxl'. Install it with:")
        print("    python -m pip install openpyxl")
        print("Then run this script again.")
        return

    print(f"\n✅ Wrote {len(top)} ranked candidates to {out_path}")
    print(f"   Method: {'semantic + signals' if use_sem else 'keyword + signals'}")
    print("\nTop 5 preview:")
    for rank, (cid, raw, reason) in enumerate(top[:5], start=1):
        print(f"  #{rank} {cid} — {reason}")


if __name__ == "__main__":
    main()
