import type { Lang } from "./types";

const T = {
  fi: {
    hero: "Sinun joukkueesi. Sinun tarinasi.",
    sub: "Otteluyhteenvedot, videot ja podcastit Liigasta. Tekoäly kirjoittaa, Kalevan toimittaja tarkistaa.",
    lang: "Kieli", teams: "Valitse enintään 4 joukkuetta", style: "Lukutapa",
    quick: "Pikaluku", full: "Koko juttu", fan: "Fanin ääni",
    formats: "Muodot", summary: "Tiivistelmä", podcast: "Podcast", highlight: "Video",
    start: "Aloita", settings: "Asetukset", save: "Tallenna",
    empty: "Ei vielä julkaistua sisältöä joukkueillesi. Toimittaja tarkistaa uudet jutut ennen julkaisua.",
    checked: "Tekoälyn tekemä · toimittajan tarkistama", listen: "Kuuntele", stop: "Pysäytä",
    final: "Lopputulos", live: "Käynnissä", ot: "jatkoaika", so: "voittolaukaukset", max: "Enintään 4 joukkuetta",
    loading: "Ladataan…", error: "Syötettä ei saatu ladattua. Yritä hetken päästä uudelleen.",
  },
  sv: {
    hero: "Ditt lag. Din berättelse.",
    sub: "Sammanfattningar, videor och poddar från Liiga. AI skriver, en redaktör på Kaleva granskar.",
    lang: "Språk", teams: "Välj upp till 4 lag", style: "Läsform",
    quick: "Snabbläsning", full: "Hela storyn", fan: "Fanröst",
    formats: "Format", summary: "Sammanfattning", podcast: "Podd", highlight: "Video",
    start: "Börja", settings: "Inställningar", save: "Spara",
    empty: "Inget publicerat för dina lag än. En redaktör granskar nya texter innan de publiceras.",
    checked: "Gjord av AI · granskad av redaktör", listen: "Lyssna", stop: "Stoppa",
    final: "Slutresultat", live: "Pågår", ot: "förlängning", so: "straffar", max: "Högst 4 lag",
    loading: "Laddar…", error: "Flödet kunde inte laddas. Försök igen om en stund.",
  },
  en: {
    hero: "Your team. Your story.",
    sub: "Match summaries, videos and podcasts from Liiga. AI writes, a Kaleva editor checks.",
    lang: "Language", teams: "Pick up to 4 teams", style: "Reading style",
    quick: "Quick read", full: "Full story", fan: "Fan voice",
    formats: "Formats", summary: "Summary", podcast: "Podcast", highlight: "Video",
    start: "Start", settings: "Settings", save: "Save",
    empty: "Nothing published for your teams yet. An editor checks new stories before they go out.",
    checked: "Made by AI · checked by an editor", listen: "Listen", stop: "Stop",
    final: "Final", live: "Live", ot: "overtime", so: "shootout", max: "Up to 4 teams",
    loading: "Loading…", error: "Couldn't load your feed. Try again in a moment.",
  },
} as const;

export type Strings = (typeof T)["en"];
export const t = (l: Lang): Strings => T[l] as unknown as Strings;
