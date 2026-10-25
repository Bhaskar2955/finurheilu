# FinUrheilu 2.0 — React + TypeScript + Node.js + Appwrite

This is the FinUrheilu 2.0 prototype rebuilt as a real, responsive app. It works on phones, tablets and desktops (desktops get a side menu and two-column layouts).

| Part | Tech | Folder |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | `client/` |
| Backend API | Node.js 20 + Express + TypeScript | `server/` |
| Database + accounts | **Appwrite Cloud (free plan)** | set up by `npm run setup:appwrite` |
| Liiga data | liiga.fi JSON API → server → Appwrite → app | `server/src/liiga.ts` |
| AI writer | built-in demo writer (free), optional Google Gemini (free key) | `server/src/ai.ts` |

**Round 1 (this folder) includes:**
- onboarding (register/login, plans, team picker, personal details);
- home feed: summaries, podcast, video and reels;
- matches, results and pick'em;
- live game detail with analytics, box score and player cards;
- calendar, teams and profile;
- Premium gating (free = 4 teams, summary only);
- Finnish, English and Swedish;
- light/dark/system mode.

**Round 2** will add Community (chat, polls, quiz, meetups) and the Newsroom.

---

## 1. What you need

- **Node.js 20 or newer**. Check with `node -v`. Download it from <https://nodejs.org> (choose the LTS version).
- A free **Appwrite Cloud** account. This is optional: the app also runs without it, in demo mode (see step 4).

## 2. Set up Appwrite Cloud (free)

1. Go to <https://cloud.appwrite.io> and sign up. The Free plan is enough.
2. **Create project.**
   - Name: `FinUrheilu`.
   - Pick a region, for example *Frankfurt*.
   - Open **Settings** and copy the **Project ID** and the **API Endpoint** (for example `https://fra.cloud.appwrite.io/v1`).
3. **Add a Web platform** so the browser app is allowed to talk to Appwrite.
   - Go to **Overview → Add platform → Web**.
   - Name: `Local`. Hostname: `localhost`.
   - Skip the code snippets.
4. **Create an API key** for the Node.js server.
   - Go to **Overview → Integrations → API keys → Create API key**.
   - Name: `finurheilu-server`. Expiration: *Never*.
   - Scopes: open **Database** and tick `databases.read`, `databases.write`, `tables.read`, `tables.write`, `rows.read`, `rows.write`. In older consoles these are named `collections.*` / `documents.*`; tick those instead.
   - Copy the **secret**. It is shown only once.
5. **Turn on email/password login.** This is on by default; check under **Auth → Settings → Email/Password**.

> The API key is a secret. It goes only into `server/.env`, which git ignores. Never put it in `client/.env` or commit it.

## 3. Configure the two `.env` files

```bash
cd app2/server && cp .env.example .env     # Windows: copy .env.example .env
cd ../client   && cp .env.example .env
```

`server/.env`:
```
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=<your project id>
APPWRITE_API_KEY=<the secret from step 2.4>
APPWRITE_DATABASE_ID=finurheilu
GEMINI_API_KEY=
# GEMINI_API_KEY is optional, see section 7
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=northeurope
# The two AZURE values are optional, see section 8
```

`client/.env` (same endpoint and project, **no key**):
```
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=<your project id>
VITE_APPWRITE_DATABASE_ID=finurheilu
```

## 4. Install, create the database, load Liiga data

```bash
cd app2/server
npm install
npm run setup:appwrite     # creates the database "finurheilu" and its 4 tables (safe to run again)
npm run sync               # downloads the Liiga season from liiga.fi and stores it in Appwrite

cd ../client
npm install
```

`setup:appwrite` creates these tables. You can see them in the Appwrite console under **Databases → finurheilu**.

| Table | What is in it | Who can read |
|---|---|---|
| `liiga_games` | every regular-season game: date, time, teams, score, OT/SO | everyone |
| `liiga_standings` | the league table: team, rank, games, points | everyone |
| `liiga_meta` | when the data was last fetched, and from where | everyone |
| `profiles` | each user's settings (teams, language, plan, formats…) as JSON | only that user |

Users are stored in Appwrite **Auth**: Register creates the account, and Login creates a session.

**No Appwrite yet?** Skip `setup:appwrite` and `sync`, and leave the Appwrite values empty. The app still runs: it uses live liiga.fi data, or the built-in sample season, and keeps your account on this device only.

## 5. Run it locally

You need two terminals.

```bash
# Terminal 1 – API on http://localhost:4000
cd app2/server
npm run dev

# Terminal 2 – app on http://localhost:5173
cd app2/client
npm run dev
```

Open **http://localhost:5173**. To try it on your phone, use the same Wi-Fi and run `npm run dev -- --host` in the client folder, then open the "Network" address it prints.

**One-port production mode:**

```bash
cd app2/client && npm run build      # makes client/dist
cd ../server  && npm run build && npm start
```

Then open **http://localhost:4000**. The server also serves the built app.

## 6. How the Liiga data flows

```
liiga.fi API ──► Node server (server/src/liiga.ts) ──► Appwrite tables (liiga_games, liiga_standings)
                       │                                        │
                       └──────────► /api/data ◄─── fallback ────┘ ◄─── fallback: built-in sample season
                                         │
                                  React app (client/src/lib/data.ts)
```

- **`/api/data`** returns the whole season: teams, table, upcoming games and results.
  - The server asks liiga.fi first and keeps the answer for 10 minutes (`DATA_TTL_MINUTES`).
  - It then saves a copy into Appwrite in the background.
  - If liiga.fi is down, it serves the copy stored in Appwrite.
  - If that is also missing, it serves the sample season.
- The **Profile → Liiga data** section shows which source is in use, and its **Refresh** button forces a new fetch.
- **`/api/live?date=YYYY-MM-DD`**: today's scores and goals. The app polls it every 30 seconds, so real games in progress show "LIVE" scores.
- **`/api/game/:id`**: period scores and goal scorers for one game, shown in the game detail, with a ▶ button on goals that have a Liiga clip.
- **`/api/highlights?team=Kärpät`**: Liiga's own goal clips from the team's last 5 games, shown under the video in the Video section (Premium). The team's latest goal clip from its last game also plays, muted, as scene 2 of the data video itself. Liiga publishes them as `videoClipUrl` and `videoThumbnailUrl` on each goal, usually a few hours after the game. MP4 clips play directly; HLS streams play natively in Safari, and in other browsers through hls.js, loaded from a CDN. If a clip can't play, the app links to it on Liiga's server. Clips are streamed from Liiga's server and never copied or stored. In sample mode there are no clips.
- **`npm run sync`**: refreshes Appwrite on demand, for example once a day.
- `DATA_MODE` in `server/.env` sets where the data comes from:
  - `auto` (default): live, then Appwrite, then sample;
  - `appwrite`: use only the stored copy;
  - `sample`: offline demo.

The liiga.fi API is public but **unofficial**: it has no key and no guarantee, and its fields may change. Season `2027` means the 2026–27 season. The "Start live demo" button on Home simulates a game round with the same engine as the prototype, so the demo works even when no real games are on.

## 7. Optional: Gemini AI rewrite (free)

The summaries, podcast scripts and reels are written by the built-in demo writer, which needs no key. Every sentence is checked against the game facts.

To let Gemini rewrite a summary in a more natural voice:

1. Get a free key at <https://aistudio.google.com/app/apikey>.
2. Put it in `server/.env` as `GEMINI_API_KEY=…`.
3. Restart the server.

A **Rewrite with Gemini** button then appears in the game summary. The rewritten text is fact-checked again, and if it changes any facts it is rejected.

## 8. Optional: Azure AI Speech voices (free tier)

Without a key, podcasts and video voice-overs use the device's own voices. With Azure AI Speech, the app uses natural neural voices, one female and one male per language:

| Language | Female | Male |
|---|---|---|
| Finnish | fi-FI-SelmaNeural | fi-FI-HarriNeural |
| Swedish | sv-SE-SofieNeural | sv-SE-MattiasNeural |
| English | en-GB-SoniaNeural | en-GB-RyanNeural |

1. Sign in at <https://portal.azure.com>. A free Azure account works.
2. Choose **Create a resource**, search for **Speech** and pick **Speech service** (under Azure AI services). Click **Create**.
3. Fill in the form:
   - Subscription: yours.
   - Resource group: create one, for example `finurheilu`.
   - Region: **North Europe**.
   - Name: for example `finurheilu-speech`.
   - Pricing tier: **Free F0**. It includes 0.5 million characters of neural voices a month.
4. Click **Review + create**, then **Create**. When it's done, choose **Go to resource → Keys and Endpoint**.
5. Copy **KEY 1** and the **Location/Region** (for example `northeurope`) into `server/.env`:
   ```
   AZURE_SPEECH_KEY=<KEY 1>
   AZURE_SPEECH_REGION=northeurope
   ```
6. Restart the server. The log says `voices: azure`, and **Profile → Podcast voice** says "Natural voices by Azure AI Speech".

The key stays on the server. The browser calls `POST /api/tts`, and the server asks Azure for an MP3 and keeps a small cache, so replaying the same podcast doesn't use characters again. If Azure fails, the app falls back to device voices.

## 9. Your own videos (from this computer)

Put video files in `app2/server/media/videos/<team>/` and they appear under **Team videos** in that team's Video section after a page refresh. You don't need to restart.

```
app2/server/media/videos/
  karpat/kooste-24-10.mp4     ← shown for Kärpät
  karpat/kooste-24-10.jpg     ← optional thumbnail (same name)
  karpat/videos.json          ← optional titles: { "kooste-24-10.mp4": { "title": "Kärpät – HIFK: maalikooste" } }
  league/viikon-parhaat.mp4   ← shown for every team
```

- **Folder names:** the team name in lower case, with ä/ö as a/o and spaces as `-`: `karpat`, `tappara`, `hifk`, `assat`, `k-espoo`, `kookoo`, `jyp`…
- **Formats:** `.mp4` (H.264 plays everywhere), `.webm`, `.m4v` and `.mov` (Safari only).
- **Storage:** files stay on your computer and are not committed to git. Use `VIDEOS_DIR=/path/to/folder` in `server/.env` to keep them somewhere else.

## 10. Playoff chances

**Home → Playoff chances** shows each team's chance to make the playoffs (top 12), reach the quarter-finals, the semi-finals and the final. Your teams are shown first, and **Show all** lists the whole league.

- **How it's worked out:** the model (`client/src/lib/odds.ts`) plays the rest of the season 4,000 times. It uses points per game from the Liiga table and the remaining schedule, a small home advantage, and overtime games worth 2–1 points.
- **Playoff format it uses:** places 1–4 go straight to the quarter-finals, 5–12 play best-of-5 qualifiers, and the later rounds are best of 7.
- **Labels:** the card says it's a model estimate and not betting advice.

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `Appwrite: off` in the server log | `server/.env` is missing the endpoint, project ID or API key |
| Register says "network/CORS" error | Add the **Web platform** with hostname `localhost` (step 2.3) |
| `setup:appwrite` says *unauthorized scope* | The API key is missing a Database scope; edit the key and tick all of them |
| Profile shows "Built-in sample data" | liiga.fi was not reachable and nothing is stored in Appwrite yet. Run `npm run sync`, or check your internet |
| Port 4000 or 5173 is busy | Change `PORT` in `server/.env`, or run `npm run dev -- --port 5174` |
| Podcast still uses the robot/device voice | `AZURE_SPEECH_KEY` or `AZURE_SPEECH_REGION` is wrong (the region must be the resource's, e.g. `northeurope`). The server log shows the Azure error |
| A free account can't open podcast/video/community | That is intended: these are Premium. Choose Premium in Profile → Plan (demo payment) |
