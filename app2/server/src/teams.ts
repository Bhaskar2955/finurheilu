import { SAMPLE_TEAMS, type TeamRow } from "./sample.js";

/** Canonical Liiga teams (name, city, colour, abbreviation). The app uses these names everywhere. */
export const TEAMS: TeamRow[] = [...SAMPLE_TEAMS];

const ALIASES: Record<string, string> = {
  "kiekko-espoo": "K-Espoo",
  "k-espoo": "K-Espoo",
  "kalpa": "KalPa",
  "saipa": "SaiPa",
  "kookoo": "KooKoo",
};

const fold = (s: string) =>
  s.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();

/**
 * Map a team name from the Liiga API ("HIFK Helsinki", "Kärpät Oulu", "TPS") to the app's team name.
 * Unknown teams are added with a neutral colour so new clubs still show up.
 */
export function teamOf(apiName: string | null | undefined): string | null {
  if (!apiName) return null;
  const n = fold(apiName);
  for (const [alias, name] of Object.entries(ALIASES)) if (n === alias || n.startsWith(alias + " ")) return name;
  const hit = TEAMS.find(([name]) => n === fold(name) || n.startsWith(fold(name) + " "));
  if (hit) return hit[0];
  const clean = apiName.trim();
  TEAMS.push([clean, "", "#5b6b84", clean.slice(0, 3).toUpperCase()]);
  return clean;
}

export const slug = (name: string) =>
  name.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
