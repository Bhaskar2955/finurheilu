# FinUrheilu

Liiga hockey news your way, for the JunctionX Oulu 2026 Kaleva Media challenge.
AI writes match summaries (Finnish, Swedish, English), makes highlight videos and two-host podcasts.
**A human editor approves everything before readers see it.**

> **New: [`app2/`](app2/README.md)** is the full FinUrheilu 2.0 app in React + TypeScript + Node.js, with Appwrite Cloud (free) as the database and live liiga.fi data. It is responsive (phone, tablet, desktop). Setup guide: [app2/README.md](app2/README.md).

```
Liiga data ──► Python AI worker ──► drafts in Postgres ──► Newsroom (editor) ──► approved ──► Reader app
               Claude, FFmpeg,      (readers can't          approve / fix /        row-level security:
               Azure voices          see drafts)            reject / schedule      only published content
```

| Part | Folder | Tech | Hosted on |
|---|---|---|---|
| Reader app `/` and Newsroom `/newsroom` | `web/` | Next.js 14, TypeScript, React | Vercel |
| AI worker | `worker/` | Python, FastAPI, Claude API, FFmpeg, Azure AI Speech | Render (Docker) |
| Database + file storage | `supabase/` | PostgreSQL with row-level security, Supabase Storage | Supabase |
| Tests | `worker/tests`, `web/tests` | Python unittest, Playwright | GitHub Actions |

## What works today

- **Summaries:** Claude Sonnet writes 9 versions per game (3 languages × quick / full / fan voice) from a fact sheet built from Liiga events.
- **Fact check:** code (not AI) compares every claim and every number with the Liiga data. A wrong number blocks approval. The editor can press **Fix with AI** or confirm it by hand.
- **Highlights:** with a licensed video URL, FFmpeg cuts clips around goals and saves and ranks them by crowd noise. Without footage (the default) it builds a vertical data video from the events.
- **Podcast:** Claude writes a two-host script (female + male). Azure neural voices read it; without an Azure key, the app reads it with the phone's voice.
- **Newsroom:** review queue, fact check, variants with "who gets which", edit text, ask the AI to change something, approve now or schedule, reject, unpublish, audit log, AI job list.
- **Reader app:** pick language, up to 4 teams, reading style and formats; the feed shows only approved content in the reader's language and style.

**Sample data:** teams are the real Liiga clubs, but the players and results in `supabase/seed.sql` are invented for the demo.
To use real games, send them to the worker's `/import/game` endpoint (format in `worker/app/liiga.py`).
Liiga video belongs to the league and its broadcasters: only set `video_source_url` for footage you have rights to.

## No AI credit? Pick a free writer

The worker's `AI_PROVIDER` setting decides who writes the texts:

| `AI_PROVIDER` | Cost | Key needed | Quality |
|---|---|---|---|
| `demo` (default in render.yaml) | Free forever | None | Plain template texts from the Liiga data, in fi/sv/en. Every fact is real. The first draft has one deliberate shot-count mistake so the fact check has something to catch (`DEMO_MISTAKE=0` turns it off). |
| `gemini` | Free tier | `GEMINI_API_KEY` from aistudio.google.com (no card) | Real AI writing. Free-tier limits apply; check Google's current terms. If the default model has been retired, the worker switches to a current Flash model by itself (or set `GEMINI_MODEL`). |
| `claude` | Paid (a few cents per game) | `ANTHROPIC_API_KEY` | Best Finnish and Swedish. |

You can switch any time in Render → Environment; the worker restarts in a minute. `/health` shows which one is active.
Hackathons often hand out AI credits, so ask the JunctionX organisers too.

## Put it online (about 20 minutes)

You need free accounts on GitHub, Supabase, Render and Vercel. An AI key is optional (see above). Azure Speech is optional.

### 1. Supabase (database)
1. Create a project, region **EU North (Stockholm)**. Save the database password.
2. **SQL Editor → New query**: paste all of `supabase/migrations/20261025000000_schema.sql`, run it. Then paste `supabase/seed.sql`, run it.
3. **Project settings → Database → Connection string → URI, "Transaction pooler"** (port 6543). Put your password in it. This is your `DATABASE_URL`.
4. **Project settings → API**: copy the **Project URL** (`SUPABASE_URL`) and the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`). Keep the service key secret.

### 2. Make one shared secret
Make a long random string, for example at https://www.random.org/strings/ or `openssl rand -hex 32`. This is `WORKER_TOKEN`; the web app and the worker both use it.

### 3. Render (AI worker)
1. **New → Blueprint**, pick this repo. Render reads `render.yaml`.
2. Fill in: `DATABASE_URL`, `WORKER_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Leave the AI keys empty to use the free demo writer, or add `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` and set `AI_PROVIDER`. `AZURE_SPEECH_KEY` is optional.
3. When it's live, open `https://<your-worker>.onrender.com/health`. You should see `"ok": true` and `"ai": "demo"` (or `gemini` / `claude`).

The free plan sleeps after 15 minutes without traffic; the first request then takes ~1 minute. Open `/health` before a demo.

### 4. Vercel (app + newsroom)
1. **Add New → Project**, import this repo. Set **Root Directory** to `web`.
2. Environment variables: `DATABASE_URL` (same as above), `NEWSROOM_PASSWORD` (anything you choose), `WORKER_URL` (your Render URL), `WORKER_TOKEN`.
3. Deploy. Open `https://<your-app>.vercel.app` for readers and `/newsroom` for editors.

### 5. First run
1. Open `/newsroom`, sign in with your name and `NEWSROOM_PASSWORD`.
2. **Games and AI → Run AI** on *Kärpät 3–2 Tappara*. Drafts appear in **Review queue** in about a minute.
3. Check the facts, approve, and open the reader app: the content is there.

## Run it on your own computer (one command)

1. Install **Docker Desktop** (docker.com/products/docker-desktop) and start it.
2. Download this repo: GitHub → **Code → Download ZIP**, and unzip it (or `git clone`).
3. Open a terminal in the `finurheilu` folder and run:

   ```bash
   docker compose up --build
   ```

   The first start takes 5–10 minutes (it downloads Postgres, Python and Node and builds everything). Later starts take seconds.
4. Open **http://localhost:3000** for the reader app and **http://localhost:3000/newsroom** for the newsroom (password `kaleva`).
5. In the newsroom: **Games and AI → Run AI** on Kärpät–Tappara, then review and publish.

Stop it with `Ctrl+C`. `docker compose down -v` also wipes the database so you can start fresh.
It uses the free demo writer. For real AI, create a file named `.env` in the same folder with `AI_PROVIDER=gemini` and `GEMINI_API_KEY=your-key`, then run `docker compose up` again.

## Run the parts by hand (no Docker)

Install: **PostgreSQL 16**, **Python 3.12**, **Node.js 20 LTS** and **FFmpeg** (Windows: `winget install Gyan.FFmpeg`; Mac: `brew install ffmpeg`).

```bash
# 1. Database (use the password you chose when installing PostgreSQL)
psql -U postgres -c "create database fu"
psql -U postgres -d fu -f dev/local_setup.sql

# 2. AI worker  (terminal 1)
cd worker
cp .env.local.example .env            # Windows: copy .env.local.example .env   -> edit the password
python -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 3. App + newsroom  (terminal 2)
cd web
cp .env.local.example .env.local      # Windows: copy .env.local.example .env.local -> edit the password
npm install
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/newsroom (password `kaleva`).
End-to-end test with a fresh database: `cd web && npx playwright install chromium && npx playwright test`.

## Security model

- Readers' queries run as Postgres role `anon` (`web/lib/db.ts`), so row-level security in the schema decides what they see: published items only, current version only.
- The worker and newsroom routes use the privileged connection; newsroom routes require the editor session cookie.
- API keys live only in Render and Vercel environment variables, never in the browser or the repo.

## Next steps
- Live updates during games (Claude Haiku after each goal) and the community chat from the 2.0 prototype (Supabase Realtime).
- Real Liiga feed adapter, plus Whisper captions for licensed footage.
- Proper editor accounts with Supabase Auth instead of one shared password.
