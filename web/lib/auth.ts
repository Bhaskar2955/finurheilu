import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "nr_session";
const NAME = "nr_editor";

function token(): string {
  const pw = process.env.NEWSROOM_PASSWORD ?? "";
  return createHmac("sha256", pw).update("finurheilu-newsroom-v1").digest("hex");
}

export function passwordOk(input: string): boolean {
  const pw = process.env.NEWSROOM_PASSWORD ?? "";
  if (!pw) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(pw);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function startSession(editor: string): void {
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 };
  cookies().set(COOKIE, token(), opts);
  cookies().set(NAME, editor.slice(0, 60), opts);
}

export function endSession(): void {
  cookies().delete(COOKIE);
  cookies().delete(NAME);
}

/** Returns the editor's name, or null if not signed in. */
export function currentEditor(): string | null {
  if (!process.env.NEWSROOM_PASSWORD) return null;
  const c = cookies().get(COOKIE)?.value;
  if (!c || c !== token()) return null;
  return cookies().get(NAME)?.value || "Editor";
}
