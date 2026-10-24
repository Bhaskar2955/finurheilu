import { NextResponse, type NextRequest } from "next/server";
import { currentEditor } from "@/lib/auth";
import { sql } from "@/lib/db";
import { strayNumbers } from "@/lib/factcheck";
import { loadState } from "@/lib/newsroom";
import type { Fact } from "@/lib/types";
import { callWorker } from "@/lib/worker";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Editor actions on one item:
 * approve (now or scheduled), reject, unpublish, reopen, edit_variant, accept_claim, fix_with_ai, rewrite.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const editor = currentEditor();
  if (!editor) return fail("Sign in first", 401);
  if (!UUID.test(params.id)) return fail("Bad item id");
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");

  const [item] = await sql`select i.*, v.payload from content_items i
                           left join content_versions v on v.id = i.current_version_id where i.id = ${params.id}`;
  if (!item) return fail("Item not found", 404);
  const vid = item.current_version_id as string | null;
  const log = (a: string, reason: string | null = null) =>
    sql`insert into review_actions (item_id, editor, action, reason) values (${item.id}, ${editor}, ${a}, ${reason})`;

  switch (action) {
    case "approve": {
      if (!vid) return fail("Nothing to approve yet");
      const [{ open }] = await sql`select count(*)::int as open from claims where version_id = ${vid} and check_status <> 'ok'`;
      if (open > 0) return fail(`Resolve ${open} flagged fact${open > 1 ? "s" : ""} first`);
      if (item.status === "flagged") return fail("Resolve the flagged facts first");
      if (item.depends_on) {
        const [dep] = await sql`select status from content_items where id = ${item.depends_on}`;
        if (!dep || !["approved", "scheduled", "published"].includes(dep.status)) {
          return fail("Approve the match report first: this is built from it");
        }
      }
      if (b.publish_at) {
        const when = new Date(String(b.publish_at));
        if (Number.isNaN(when.getTime())) return fail("Bad publish time");
        await sql`update content_items set status = 'scheduled', publish_at = ${when}, approved_by = ${editor},
                  published_at = ${when}, updated_at = now() where id = ${item.id}`;
        await log("schedule", when.toISOString());
      } else {
        await sql`update content_items set status = 'published', publish_at = null, approved_by = ${editor},
                  published_at = now(), updated_at = now() where id = ${item.id}`;
        await log("publish");
      }
      break;
    }
    case "reject": {
      const reason = String(b.reason ?? "").slice(0, 200) || null;
      await sql`update content_items set status = 'rejected', updated_at = now() where id = ${item.id}`;
      await log("reject", reason);
      break;
    }
    case "unpublish":
    case "reopen": {
      await sql`update content_items set status = 'needs_review', publish_at = null, published_at = null,
                approved_by = null, updated_at = now() where id = ${item.id}`;
      await log(action);
      break;
    }
    case "edit_variant": {
      if (!vid || item.kind !== "summary") return fail("Only summaries can be edited here");
      const text = String(b.text ?? "").trim();
      if (!text) return fail("Text can't be empty");
      const r = await sql`update summary_variants set text = ${text}
                          where version_id = ${vid} and language = ${String(b.language)} and style = ${String(b.style)}`;
      if (r.count === 0) return fail("Variant not found");
      // Re-run the number check across all variants of this version.
      const facts = ((item.payload ?? {}) as { facts?: Fact[] }).facts ?? [];
      const texts = (await sql`select text from summary_variants where version_id = ${vid}`).map((x) => x.text as string);
      const strays = strayNumbers(texts, facts);
      await sql`delete from claims where version_id = ${vid} and fact_key is null and check_status = 'unverified'`;
      for (const n of strays) {
        await sql`insert into claims (version_id, item_id, text, fact_key, ai_value, check_status)
                  values (${vid}, ${item.id}, ${`The number ${n} is in the text but not in the Liiga data`}, null, ${n}, 'unverified')`;
      }
      const [{ open }] = await sql`select count(*)::int as open from claims where version_id = ${vid} and check_status <> 'ok'`;
      const next = open > 0 ? "flagged" : "needs_review";
      await sql`update content_items set status = ${next}, published_at = null, publish_at = null, updated_at = now() where id = ${item.id}`;
      await log("edit", `${b.language}/${b.style}`);
      break;
    }
    case "accept_claim": {
      if (!UUID.test(String(b.claim_id))) return fail("Bad claim id");
      await sql`update claims set check_status = 'ok' where id = ${String(b.claim_id)} and item_id = ${item.id}`;
      const [{ open }] = await sql`select count(*)::int as open from claims where version_id = ${vid} and check_status <> 'ok'`;
      if (open === 0 && item.status === "flagged") {
        await sql`update content_items set status = 'needs_review', updated_at = now() where id = ${item.id}`;
      }
      await log("fix_claim", "Editor checked it by hand");
      break;
    }
    case "fix_with_ai":
    case "rewrite": {
      let instruction = String(b.instruction ?? "").slice(0, 500);
      if (action === "fix_with_ai") {
        const [c] = await sql`select text, ai_value, source_value, fact_key from claims where id = ${String(b.claim_id)} and item_id = ${item.id}`;
        if (!c) return fail("Claim not found");
        instruction = c.source_value
          ? `Correct this: "${c.text}". The Liiga value for ${c.fact_key} is ${c.source_value}, not ${c.ai_value}.`
          : `Remove or correct this, it is not in the Liiga data: "${c.text}".`;
      }
      if (!instruction.trim()) return fail("Write what the AI should change");
      const r = await callWorker("/jobs/rewrite", { item_id: item.id, instruction });
      if (!r.ok) return fail(((r.data as { error?: string; detail?: string }).error ?? (r.data as { detail?: string }).detail ?? "Worker error"), r.status);
      await log("rewrite", instruction);
      break;
    }
    default:
      return fail(`Unknown action "${action}"`);
  }
  return NextResponse.json(await loadState(editor));
}
