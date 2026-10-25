/**
 * FinUrheilu 2.0 API server (Node.js + Express).
 *   GET  /api/health        status of Liiga data, Appwrite and AI
 *   GET  /api/data          season bundle: teams, table, upcoming games, results
 *   GET  /api/live?date=    live scores and goals for one day
 *   GET  /api/game/:id      one game: period scores and goal scorers (with Liiga goal clips)
 *   GET  /api/highlights    Liiga goal clips from recent games (?team=Kärpät&games=5)
 *   GET  /api/ai/status     which writer is active (demo or gemini)
 *   POST /api/ai/rewrite    rewrite a fact-checked story with Gemini
 *   POST /api/tts           Azure AI Speech audio (mp3) for podcast and video voices
 * In production it also serves the built React app from ../client/dist.
 */
import "./env.js";
import express, { type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aiStatus, rewrite } from "./ai.js";
import { synthesize, ttsStatus, type TtsLine } from "./tts.js";
import { APPWRITE, appwriteReady } from "./appwrite.js";
import { gameDetail, getBundle, highlights, liveDay, syncState } from "./data.js";
import { LIIGA_BASE, todayHelsinki } from "./liiga.js";

const app = express();
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (_req: Request, res: Response) => {
  const b = await getBundle();
  res.json({
    ok: true,
    data: { mode: b.mode, source: b.source, season: b.season, fetchedAt: b.fetchedAt, note: b.note ?? null, liigaApi: LIIGA_BASE },
    appwrite: { configured: appwriteReady(), endpoint: APPWRITE.endpoint || null, database: APPWRITE.db, ...syncState },
    ai: aiStatus(),
    tts: ttsStatus(),
  });
});

app.get("/api/data", async (req: Request, res: Response) => {
  res.set("cache-control", "no-store");
  res.json(await getBundle(req.query.refresh === "1"));
});

app.get("/api/live", async (req: Request, res: Response) => {
  const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : todayHelsinki();
  try {
    res.json({ date, games: await liveDay(date) });
  } catch (e) {
    res.status(502).json({ date, games: [], error: (e as Error).message });
  }
});

app.get("/api/game/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Bad game id" });
  try {
    res.json(await gameDetail(id, req.query.ended === "1"));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.get("/api/highlights", async (req: Request, res: Response) => {
  const team = typeof req.query.team === "string" && req.query.team.length < 40 ? req.query.team : null;
  const games = Math.min(10, Math.max(1, Number(req.query.games) || 5));
  try {
    res.json(await highlights(team, games));
  } catch (e) {
    res.status(502).json({ source: "error", clips: [], error: (e as Error).message });
  }
});

app.get("/api/ai/status", (_req: Request, res: Response) => res.json({ ...aiStatus(), tts: ttsStatus().provider }));

app.post("/api/ai/rewrite", async (req: Request, res: Response) => {
  const { lang, tone, text, facts } = req.body ?? {};
  if (typeof text !== "string" || !Array.isArray(facts)) return res.status(400).json({ error: "text and facts are required" });
  try {
    res.json({ text: await rewrite({ lang: String(lang || "fi"), tone: String(tone || "neutral"), text: text.slice(0, 3000), facts: facts.map(String).slice(0, 60) }) });
  } catch (e) {
    res.status(503).json({ error: (e as Error).message });
  }
});

app.post("/api/tts", async (req: Request, res: Response) => {
  const { lang, lines } = req.body ?? {};
  if (!Array.isArray(lines) || !lines.length || lines.length > 40) return res.status(400).json({ error: "lines (1–40) are required" });
  const clean: TtsLine[] = lines
    .map((l: any): TtsLine => ({ voice: l?.voice === "male" ? "male" : "female", text: String(l?.text ?? "").slice(0, 600).trim() }))
    .filter((l: TtsLine) => l.text);
  if (!clean.length || clean.reduce((n, l) => n + l.text.length, 0) > 5000) return res.status(400).json({ error: "text is empty or too long" });
  try {
    const mp3 = await synthesize(clean, ["fi", "sv", "en"].includes(lang) ? lang : "fi");
    res.set({ "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" }).send(mp3);
  } catch (e) {
    console.warn("TTS:", (e as Error).message);
    res.status(503).json({ error: (e as Error).message });
  }
});

// Serve the built React app (npm run build in app2/client) for a one-port production setup.
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => res.sendFile(join(dist, "index.html")));
}

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`FinUrheilu API on http://localhost:${port}  (Appwrite: ${appwriteReady() ? "on" : "off"}, AI: ${aiStatus().provider}, voices: ${ttsStatus().provider})`);
  getBundle().then((b) => console.log(`Liiga data: ${b.mode} (${b.source})${b.note ? " – " + b.note : ""}`));
});
