import { sql } from "./db";
import type { NrItem, NrState } from "./types";

/** Everything the editor dashboard shows, in one call. Runs with full rights (editors only). */
export async function loadState(editor: string): Promise<NrState> {
  const items = (await sql`
    select i.id, i.game_id, i.kind, i.status, i.title, i.depends_on, i.approved_by, i.publish_at, i.published_at,
           i.updated_at, i.current_version_id, v.version, v.author, v.note, v.payload,
           g.home_id, g.away_id, g.status as game_status
    from content_items i
    join games g on g.id = i.game_id
    left join content_versions v on v.id = i.current_version_id
    order by i.updated_at desc
    limit 60`) as unknown as (NrItem & { current_version_id: string | null })[];

  const vids = items.map((i) => i.current_version_id).filter((x): x is string => !!x);
  const iids = items.map((i) => i.id);
  const [variants, claims, episodes, clips, log, readers, games, jobs, teams] = await Promise.all([
    vids.length ? sql`select version_id, language, style, text from summary_variants where version_id = any(${sql.array(vids)}::uuid[])` : [],
    vids.length ? sql`select id, version_id, text, fact_key, ai_value, source_value, check_status from claims where version_id = any(${sql.array(vids)}::uuid[]) order by check_status desc, text` : [],
    vids.length ? sql`select version_id, language, script, audio_url, duration_s from podcast_episodes where version_id = any(${sql.array(vids)}::uuid[])` : [],
    vids.length ? sql`select id, version_id, label, start_s, end_s, rank, included from video_clips where version_id = any(${sql.array(vids)}::uuid[]) order by position` : [],
    iids.length ? sql`select item_id, editor, action, reason, created_at from review_actions where item_id = any(${sql.array(iids)}::uuid[]) order by created_at desc` : [],
    sql`select language, style, team_ids, formats from reader_profiles`,
    sql`select g.id, g.home_id, g.away_id, g.home_score, g.away_score, g.status, g.starts_at, g.venue,
               (select count(*)::int from game_events e where e.game_id = g.id) as event_count
        from games g order by g.starts_at desc limit 30`,
    sql`select id, game_id, kind, status, model, input_tokens, output_tokens, note, error, created_at, started_at, finished_at
        from ai_jobs order by created_at desc limit 40`,
    sql`select id, name, short, city, color from teams order by name`,
  ]);

  for (const it of items) {
    const vid = it.current_version_id;
    it.variants = variants.filter((v) => v.version_id === vid) as unknown as NrItem["variants"];
    it.claims = claims.filter((c) => c.version_id === vid) as unknown as NrItem["claims"];
    it.episodes = episodes.filter((e) => e.version_id === vid) as unknown as NrItem["episodes"];
    it.clips = (clips.filter((c) => c.version_id === vid) as unknown as NrItem["clips"]).map((c) => ({
      ...c, start_s: Number(c.start_s), end_s: Number(c.end_s), rank: Number(c.rank),
    }));
    it.log = log.filter((l) => l.item_id === it.id) as unknown as NrItem["log"];
    it.payload = (it.payload ?? {}) as Record<string, unknown>;
    // Who would receive this: readers following either team who want this format.
    const fmt = it.kind;
    const reach: Record<string, number> = {};
    for (const r of readers) {
      const teamsR = r.team_ids as string[];
      if (!teamsR.includes(it.home_id) && !teamsR.includes(it.away_id)) continue;
      if (!(r.formats as string[]).includes(fmt)) continue;
      const key = fmt === "summary" ? `${r.language}/${r.style}` : String(r.language);
      reach[key] = (reach[key] ?? 0) + 1;
      reach.all = (reach.all ?? 0) + 1;
    }
    it.reach = reach;
    delete (it as Partial<typeof it>).current_version_id;
  }

  return {
    editor,
    items,
    games: games as unknown as NrState["games"],
    jobs: jobs as unknown as NrState["jobs"],
    teams: teams as unknown as NrState["teams"],
  };
}
