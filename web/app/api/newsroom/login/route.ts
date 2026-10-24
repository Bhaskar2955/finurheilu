import { NextResponse, type NextRequest } from "next/server";
import { endSession, passwordOk, startSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!process.env.NEWSROOM_PASSWORD) {
    return NextResponse.json({ error: "NEWSROOM_PASSWORD is not set on the server" }, { status: 500 });
  }
  if (!passwordOk(String(b.password ?? ""))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const name = String(b.name ?? "").trim() || "Editor";
  startSession(name);
  return NextResponse.json({ ok: true, editor: name });
}

export async function DELETE() {
  endSession();
  return NextResponse.json({ ok: true });
}
