# LexGuard

> An adversarial AI consent firewall. Detects exploitative, ambiguous, or high-risk clauses in contracts, offer letters, privacy policies, ticketing terms, and quotations — **before** you agree. Grounded in Indian civil law, not "ChatGPT + PDF upload."

| | |
|---|---|
| **Website** | <https://lexguard-srujan0404.vercel.app> |
| **API (Cloud Run, asia-south1)** | <https://lexguard-api-ra2lq6x47q-el.a.run.app> · [Swagger](https://lexguard-api-ra2lq6x47q-el.a.run.app/docs) |
| **Source** | <https://github.com/srujan0404/lexguard> |
| **Chrome extension** | side-loaded — see [`extension/README.md`](extension/README.md) |

## What it actually does

User pastes a document (or scans a page via the extension) → a **five-agent adversarial pipeline** on Cloud Run analyzes it and returns a structured `DocumentScorecard`:

1. **Extractor** — segments raw text into discrete clauses + identifies the issuer
2. **Risk** — assigns severity (`low` → `critical`) and a fixed 19-value risk category
3. **Rights** (RAG) — cites only from a curated 24-statute Indian civil-law knowledge base; explicitly forbidden from inventing citations or referencing IPC
4. **Red-Team** — argues from the drafter's side; describes plausible exploitation
5. **Judge** (heavy model) — synthesizes the three into the user-facing verdict

Agents 2–4 run in parallel via `asyncio.gather`. Total wall time: ~45 s on Gemini 2.5 Flash with thinking disabled.

Per scan also runs in parallel:
- **RAG retrieval** against `app/knowledge/indian_laws.json` per clause
- **Firestore Risk Memory**: SHA-256 of normalized doc + each clause; counters track template recycling

## The three demo beats

1. **Statute Highlight** — every citation is clickable. The drawer shows the *actual* statute (Indian Contract Act §27, DPDP §11, etc.) so judges see grounding, not vibes.
2. **Compare Mode** — `/compare` runs the full pipeline on two documents in parallel and renders a side-by-side scorecard with a "Document A is N points safer than Document B" verdict.
3. **Risk Memory** — `seen_before` on the scorecard ("recycled template detected · issued by Acme Technologies Pvt. Ltd.") and `seen_in_n_others` on every clause ("seen in N other contracts"). Pulls from Firestore — no AI cost.

## Repo layout

```
backend/      Python 3.12, FastAPI, async multi-agent orchestrator on Cloud Run
website/      Next.js 16 App Router, React 19, Tailwind v4, "Midnight Edition" theme
extension/    Manifest V3 Chrome extension (no build step)
samples/      Fixture documents (employment offer letter)
scripts/      Backend deploy helpers (setup_gcp.sh, deploy.sh, seed_firestore.py)
PROGRESS.md   Phase-by-phase build log
```

## Google services in use

- **Cloud Run** (`asia-south1`) — backend; `min=0/max=2`, 512 Mi, 300 s timeout
- **Vertex AI** — Gemini 2.5 Flash with `thinking_budget=0`; ~$0.01 per scan
- **Firestore (Native)** — risk-memory counters; well inside free tier
- **Secret Manager** — GEMINI_API_KEY (legacy from when LLM_BACKEND=aistudio; deprecated in current deploy)
- **Cloud Build** — image build on `gcloud run deploy --source .`
- **Artifact Registry** — auto-managed by Cloud Run deploys

## Quickstart

### Backend (local)

```bash
cd backend
/Users/dharmasrujanreddy/.rye/py/cpython@3.12.5/bin/python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env  # set GCP_PROJECT_ID + GEMINI_API_KEY
.venv/bin/uvicorn app.main:app --reload
```

### Website

```bash
cd website
npm install
npm run dev  # http://localhost:3000
```

### Extension

`chrome://extensions` → Developer mode → Load unpacked → select `extension/`.

### Deploy (Cloud Run)

```bash
cd backend
bash scripts/setup_gcp.sh   # idempotent: enables APIs, mints SA, creates Firestore DB
bash scripts/deploy.sh
```

### Re-seed Firestore (no AI cost)

```bash
.venv/bin/python -m scripts.seed_firestore \
  --issuer "Acme Technologies Pvt. Ltd." \
  --target 7
```

## License

MIT. Not legal advice.
