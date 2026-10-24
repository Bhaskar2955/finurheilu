import type { Fact } from "./types";

/** Same rule as the worker (worker/app/factcheck.py): every number in the text must exist in the Liiga facts. */
export function strayNumbers(texts: string[], facts: Fact[]): string[] {
  const ok = new Set<string>(["1", "2", "3"]);
  for (const f of facts) {
    for (const s of [f.value, f.label]) for (const n of s.match(/\d+/g) ?? []) ok.add(n.replace(/^0+(?=\d)/, ""));
  }
  const found: string[] = [];
  for (const t of texts) {
    for (const n of t.match(/\d+/g) ?? []) {
      const n2 = n.replace(/^0+(?=\d)/, "");
      if (!ok.has(n2) && !found.includes(n2)) found.push(n2);
    }
  }
  return found;
}
