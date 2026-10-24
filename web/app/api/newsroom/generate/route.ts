import { NextResponse, type NextRequest } from "next/server";
import { currentEditor } from "@/lib/auth";
import { callWorker } from "@/lib/worker";

export const dynamic = "force-dynamic";

/** Ask the AI worker to make content for a game. */
export async function POST(req: NextRequest) {
  const editor = currentEditor();
  if (!editor) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const kinds = Array.isArray(b.kinds) ? b.kinds : ["summary", "highlight", "podcast"];
  const r = await callWorker("/jobs", { game_id: String(b.game_id ?? ""), kinds });
  return NextResponse.json(r.data, { status: r.ok ? 200 : r.status });
}
