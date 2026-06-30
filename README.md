# 🧠 HireMinds Pro — React + Python AI Hiring Platform

A premium AI hiring ecosystem with a **React frontend** (animations, dark/light mode, cursor effects) and a **Python FastAPI backend** (TF-IDF matching, resume analysis, plagiarism detection) running on your real 2,000-candidate dataset.

Built for **INDIA RUNS Hackathon · Redrob × Hack2Skill** by Abhiya & Jaswanth.

---

## 📦 What's inside

```
hireminds-pro/
├── backend/              ← Python FastAPI (the AI engine)
│   ├── main.py
│   ├── requirements.txt
│   └── candidates.jsonl  ← PUT YOUR REAL DATASET HERE
└── frontend/             ← React + Vite (the UI)
    ├── src/
    └── package.json
```

---

## 🚀 How to run (two terminals)

You need **two terminals open at the same time** — one for the backend, one for the frontend.

### Terminal 1 — Backend (Python)

```bash
cd hireminds-pro/backend

# Copy your real dataset into this folder:
# (place candidates.jsonl right next to main.py)

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Wait until you see: `[OK] Loaded 2000 candidates`

Leave this terminal running.

### Terminal 2 — Frontend (React)

```bash
cd hireminds-pro/frontend

npm install
npm run dev
```

It will print a URL like `http://localhost:5173` — open it in your browser.

---

## ✅ How it works

- The React frontend (port 5173) calls the Python API (port 8000) automatically — Vite proxies all `/api` requests to the backend.
- **First time?** Click "Create account", pick HR or Job Seeker, sign up. Your account is saved in the browser.
- **Returning?** Just sign in with the same email/password.

---

## 🎨 Features

**Landing / Auth**
- Animated hero with cursor-following glow
- Real signup + login (saved per browser)
- Light / Dark / System theme toggle

**HR Dashboard**
1. AI Matching — paste a JD, rank candidates 0–100%, expandable cards with GitHub score, connections, salary, skill assessment bars
2. Talent Analytics — live charts from real recruiter signals
3. Fraud Check — cosine-similarity plagiarism scan
4. Salary Benchmarks — range + growth curve

**Candidate Portal**
1. Resume Analyser — PDF upload, score, skills, tips, market value
2. Skill Gap Finder — radial match gauge + learning roadmap

---

## 🔧 Troubleshooting

**"Failed to fetch" / data not loading**
→ The backend (Terminal 1) isn't running. Start it first.

**Backend says "candidates.jsonl not found"**
→ Move your dataset file into the `backend/` folder, next to `main.py`.

**Port already in use**
→ Backend: change `--port 8000` to `--port 8001` (and update `frontend/vite.config.js` proxy target).

---

## 🏆 Why this wins

The judges in Track 1 (Data & AI) test whether the **AI actually works on real data**. Here it does — every match, score, and chart is computed live by scikit-learn on your 2,000 real records. The premium React UI is the wow factor on top of a genuinely working engine.
