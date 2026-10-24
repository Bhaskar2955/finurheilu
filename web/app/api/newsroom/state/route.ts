import { NextResponse } from "next/server";
import { currentEditor } from "@/lib/auth";
import { loadState } from "@/lib/newsroom";

export const dynamic = "force-dynamic";

export async function GET() {
  const editor = currentEditor();
  if (!editor) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(await loadState(editor));
}
