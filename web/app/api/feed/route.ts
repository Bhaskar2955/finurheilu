import { NextResponse, type NextRequest } from "next/server";
import { asReader } from "@/lib/db";
import type { FeedGame, FeedItem, Lang, ScriptLine, Style } from "@/lib/types";

export const dynamic = "force-dynamic";

const LANGS = ["fi", "sv", "en"];
const STYLES = ["quick", "full", "fan"];

/** The reader's feed: only content an editor has published (enforced by row-level security). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const teams = (p.get("teams") ?? "").split(",").filter(Boolean).slice(0, 8);
  const lang = (LANGS.includes(p.get("lang") ?? "") ? p.get("lang") : "fi") as Lang;
  const style = (STYLES.includes(p.get("style") ?? "") ? p.get("style") : "quick") as Style;
  if (!teams.length) return NextResponse.json({ games: [] });

  const games = await asReader(async (tx) => {
    const gs = await tx`
      select id, home_id, away_id, home_score, away_score, status, ended_in, starts_at, venue
      from games
      where (home_id = any(${tx.array(teams)}::text[]) or away_id = any(${tx.array(teams)}::text[]))
        and status <> 'scheduled'
      order by starts_at desc limit 20`;
    if (!gs.length) return [] as FeedGame[];
    const items = await tx`
      select i.id, i.kind, i.title, i.game_id, v.payload
      from content_items i join content_versions v on v.id = i.current_version_id
      where i.game_id = any(${tx.array(gs.map((g) => g.id as string))}::text[])
      order by case i.kind when 'highlight' then 0 when 'summary' then 1 else 2 end`;
    const ids = items.map((i) => i.id as string);
    const variants = ids.length ? await tx`select item_id, language, style, text from summary_variants where item_id = any(${tx.array(ids)}::uuid[])` : [];
    const episodes = ids.length ? await tx`select item_id, language, script, audio_url, duration_s from podcast_episodes where item_id = any(${tx.array(ids)}::uuid[])` : [];
    const clips = ids.length ? await tx`select item_id, label, start_s, end_s from video_clips where item_id = any(${tx.array(ids)}::uuid[]) order by position` : [];

    return gs.map((g) => {
      const its: FeedItem[] = [];
      for (const i of items.filter((x) => x.game_id === g.id)) {
        const payload = (i.payload ?? {}) as Record<string, unknown>;
        const base: FeedItem = { id: i.id, kind: i.kind, title: i.title };
        if (i.kind === "summary") {
          const vs = variants.filter((v) => v.item_id === i.id);
          const pick = vs.find((v) => v.language === lang && v.style === style)
            ?? vs.find((v) => v.language === lang && v.style === "quick")
            ?? vs.find((v) => v.language === lang) ?? vs[0];
          if (!pick) continue;
          const hl = (payload.headline ?? {}) as Record<string, string>;
          its.push({ ...base, text: pick.text, headline: hl[lang] ?? hl.fi });
        } else if (i.kind === "podcast") {
          const ep = episodes.find((e) => e.item_id === i.id && e.language === lang) ?? episodes.find((e) => e.item_id === i.id);
          if (!ep) continue;
          its.push({ ...base, audio_url: ep.audio_url, script: ep.script as ScriptLine[], duration_s: ep.duration_s });
        } else if (i.kind === "highlight" && typeof payload.video_url === "string") {
          its.push({ ...base, video_url: payload.video_url,
            clips: clips.filter((c) => c.item_id === i.id).map((c) => ({ label: c.label, start_s: Number(c.start_s), end_s: Number(c.end_s) })) });
        }
      }
      return { ...(g as unknown as Omit<FeedGame, "items">), items: its };
    });
  });
  return NextResponse.json({ games });
}
