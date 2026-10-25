/**
 * Podcast and video voices with Azure AI Speech (neural voices, one female and one male per language).
 * Without AZURE_SPEECH_KEY the app falls back to the device's own voices (browser speech).
 * Free tier (F0): 0.5 million characters a month of neural voices.
 */
import { createHash } from "node:crypto";

const KEY = process.env.AZURE_SPEECH_KEY || "";
const REGION = process.env.AZURE_SPEECH_REGION || "northeurope";

/** Calm, polite neural voices (same as the newsroom worker). */
export const VOICES: Record<string, { female: string; male: string; lang: string }> = {
  fi: { female: "fi-FI-SelmaNeural", male: "fi-FI-HarriNeural", lang: "fi-FI" },
  sv: { female: "sv-SE-SofieNeural", male: "sv-SE-MattiasNeural", lang: "sv-SE" },
  en: { female: "en-GB-SoniaNeural", male: "en-GB-RyanNeural", lang: "en-GB" },
};

export const ttsStatus = () => ({ provider: KEY ? "azure" : "device", region: KEY ? REGION : null });

export interface TtsLine { voice: "female" | "male"; text: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function ssml(lines: TtsLine[], lang: string): string {
  const v = VOICES[lang] ?? VOICES.fi;
  const body = lines
    .map((l) => `<voice name="${l.voice === "male" ? v.male : v.female}"><prosody rate="-4%">${esc(l.text)}</prosody><break time="350ms"/></voice>`)
    .join("");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.lang}">${body}</speak>`;
}

// Small in-memory cache so replaying a podcast doesn't use characters twice.
const cache = new Map<string, Buffer>();
const MAX_CACHE = 80;

export async function synthesize(lines: TtsLine[], lang: string): Promise<Buffer> {
  if (!KEY) throw new Error("AZURE_SPEECH_KEY is not set");
  const doc = ssml(lines, lang);
  const key = createHash("sha1").update(doc).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "finurheilu-app2",
    },
    body: doc,
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Azure Speech ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  cache.set(key, buf);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return buf;
}
