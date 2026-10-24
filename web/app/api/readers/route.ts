import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save a reader's preferences (anonymous, by device id). Used to show editors who gets which variant. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.device_id !== "string" || b.device_id.length < 8) {
    return NextResponse.json({ error: "device_id is required" }, { status: 400 });
  }
  const language = ["fi", "sv", "en"].includes(b.language) ? b.language : "fi";
  const style = ["quick", "full", "fan"].includes(b.style) ? b.style : "quick";
  const teams: string[] = Array.isArray(b.team_ids) ? b.team_ids.filter((t: unknown) => typeof t === "string").slice(0, 4) : [];
  const formats: string[] = Array.isArray(b.formats)
    ? b.formats.filter((f: unknown) => f === "summary" || f === "podcast" || f === "highlight")
    : ["summary"];
  await sql`
    insert into reader_profiles (device_id, language, team_ids, style, formats, updated_at)
    values (${b.device_id.slice(0, 64)}, ${language}, ${sql.array(teams)}::text[], ${style}, ${sql.array(formats)}::text[], now())
    on conflict (device_id) do update set language = excluded.language, team_ids = excluded.team_ids,
      style = excluded.style, formats = excluded.formats, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
