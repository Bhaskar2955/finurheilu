import { NextResponse } from "next/server";
import { asReader } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const teams = await asReader((tx) => tx`select id, name, short, city, color from teams order by name`);
  return NextResponse.json({ teams });
}
