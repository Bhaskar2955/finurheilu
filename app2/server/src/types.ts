/** The data shapes the client uses (the same as in the 2.0 prototype). */
export interface Game { id: string; liigaId?: number; d: string; t: string; h: string; a: string; live?: boolean }
export interface Result { id: string; liigaId?: number; d: string; h: string; a: string; hs: number; as: number; x: "" | "OT" | "SO" }

export interface Bundle {
  mode: "live" | "cache" | "sample";
  /** Where the numbers came from, shown in the app. */
  source: string;
  season: number;
  fetchedAt: string;
  note?: string;
  teams: [string, string, string, string][];
  stand: [string, number, number][];
  games: Game[];
  results: Result[];
  sources: [string, string][];
}

export interface LiveGoal { min: number; period: number; home: boolean; score: string; scorer: string | null; no?: number | null }
export interface LiveGame {
  liigaId: number; h: string; a: string; hs: number; as: number;
  started: boolean; ended: boolean; min: number; x: "" | "OT" | "SO";
  periods: [number, number][]; goals: LiveGoal[];
}
