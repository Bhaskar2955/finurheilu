/**
 * Your own videos from this computer, shown in each team's Video section.
 *
 * Put video files in a folder per team under app2/server/media/videos/ (or VIDEOS_DIR):
 *   media/videos/karpat/kooste-24-10.mp4
 *   media/videos/karpat/kooste-24-10.jpg      ← optional thumbnail (same name, .jpg/.png/.webp)
 *   media/videos/league/...                   ← shown for every team
 * Optional media/videos/<team>/videos.json gives titles: { "kooste-24-10.mp4": { "title": "Kärpät – HIFK highlights" } }
 * Files are read on every request, so a new video shows up after a page refresh. No restart needed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { slug } from "./teams.js";

export const VIDEOS_DIR = resolve(process.env.VIDEOS_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "media", "videos"));
const VIDEO = new Set([".mp4", ".m4v", ".webm", ".mov"]);
const IMG = [".jpg", ".jpeg", ".png", ".webp"];

export interface LocalVideo { key: string; team: string; folder: string; title: string; url: string; thumb: string | null; d: string; size: number; type: string }

export function ensureVideoDir() {
  try { mkdirSync(VIDEOS_DIR, { recursive: true }); } catch { /* read-only disk: listing just returns nothing */ }
}

const nice = (file: string) => file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const mime = (ext: string) => (ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : "video/mp4");

function listFolder(folder: string, team: string): LocalVideo[] {
  const dir = join(VIDEOS_DIR, folder);
  if (!existsSync(dir)) return [];
  let meta: Record<string, { title?: string; date?: string }> = {};
  try { meta = JSON.parse(readFileSync(join(dir, "videos.json"), "utf8")); } catch { /* optional */ }
  const files = readdirSync(dir);
  const out: LocalVideo[] = [];
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (!VIDEO.has(ext) || f.startsWith(".")) continue;
    const st = statSync(join(dir, f));
    if (!st.isFile()) continue;
    const base = f.slice(0, -ext.length);
    const img = files.find((x) => x.startsWith(base + ".") && IMG.includes(extname(x).toLowerCase()));
    const enc = (s: string) => encodeURIComponent(s);
    out.push({
      key: `${folder}/${f}`, team, folder,
      title: meta[f]?.title || nice(f),
      url: `/media/videos/${enc(folder)}/${enc(f)}`,
      thumb: img ? `/media/videos/${enc(folder)}/${enc(img)}` : null,
      d: meta[f]?.date || st.mtime.toISOString().slice(0, 10),
      size: st.size, type: mime(ext),
    });
  }
  return out;
}

/** Videos for one team (its folder plus the shared "league" folder), newest first. */
export function localVideos(team: string | null): LocalVideo[] {
  const list = team ? [...listFolder(slug(team), team), ...listFolder("league", "")] : listFolder("league", "");
  return list.sort((a, b) => b.d.localeCompare(a.d) || a.title.localeCompare(b.title));
}
