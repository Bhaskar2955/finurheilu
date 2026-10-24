/**
 * Optional real AI for summaries, using Google Gemini's free tier.
 * Without GEMINI_API_KEY the app keeps its built-in demo writer (rule-based, fact-checked).
 * The AI only rewrites a draft that already passed the fact check; the client checks the
 * rewrite again and throws it away if any number or name doesn't match the data.
 */
const KEY = process.env.GEMINI_API_KEY || "";
let model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API = "https://generativelanguage.googleapis.com/v1beta";

export const aiStatus = () => ({ provider: KEY ? "gemini" : "demo", model: KEY ? model : "demo-writer" });

function pickFlash(names: string[]): string | null {
  const ok = names.filter((n) => n.includes("flash") && !/lite|image|tts|live|audio|exp/.test(n));
  const pool = ok.length ? ok : names.filter((n) => n.includes("flash"));
  return pool.sort().reverse()[0] ?? null;
}

async function call(body: unknown): Promise<Response> {
  return fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(KEY)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

const LANG: Record<string, string> = { fi: "Finnish", en: "English", sv: "Swedish" };
const TONE: Record<string, string> = {
  fan: "warm and excited, written for fans of the team, never insulting the opponent",
  neutral: "neutral news style",
  analyst: "analytical, focused on numbers and form",
  kids: "simple words for children aged 8–12",
};

export async function rewrite(input: { lang: string; tone: string; text: string; facts: string[] }): Promise<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY is not set");
  const prompt =
    `Rewrite this ice hockey news story in natural ${LANG[input.lang] ?? "Finnish"}. Tone: ${TONE[input.tone] ?? TONE.neutral}.\n` +
    `Rules: keep every fact. Use ONLY these exact values for numbers, scores, dates, positions and team names: ${input.facts.join(" | ")}.\n` +
    `Do not add any other numbers, names, quotes, streaks or standings. Return only the story text, 2–6 sentences.\n\nStory:\n${input.text}`;
  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5 } };
  let r = await call(body);
  if (r.status === 404) {
    // The configured model was retired: pick a current Flash model and retry once.
    const list = await fetch(`${API}/models?pageSize=200&key=${encodeURIComponent(KEY)}`).then((x) => x.json()).catch(() => ({}));
    const names = ((list as { models?: { name: string; supportedGenerationMethods?: string[] }[] }).models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    const better = pickFlash(names);
    if (better && better !== model) {
      model = better;
      r = await call(body);
    }
  }
  if (!r.ok) throw new Error(`Gemini error ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text");
  return text;
}
