export type Lang = "fi" | "sv" | "en";
export type Style = "quick" | "full" | "fan";
export type Kind = "summary" | "podcast" | "highlight";
export type Status = "draft" | "needs_review" | "flagged" | "approved" | "scheduled" | "published" | "rejected";

export interface Team { id: string; name: string; short: string; city: string; color: string }

export interface ScriptLine { host: "A" | "B"; text: string }

export interface FeedItem {
  id: string;
  kind: Kind;
  title: string;
  text?: string;          // summary in the reader's language and style
  headline?: string;
  audio_url?: string | null;
  script?: ScriptLine[];
  duration_s?: number | null;
  video_url?: string;
  clips?: { label: string; start_s: number; end_s: number }[];
}

export interface FeedGame {
  id: string;
  home_id: string;
  away_id: string;
  home_score: number;
  away_score: number;
  status: string;
  ended_in: string | null;
  starts_at: string;
  venue: string | null;
  items: FeedItem[];
}

export interface Fact { key: string; value: string; label: string }

export interface NrClaim { id: string; text: string; fact_key: string | null; ai_value: string | null; source_value: string | null; check_status: "ok" | "mismatch" | "unverified" }
export interface NrVariant { language: Lang; style: Style; text: string }
export interface NrEpisode { language: Lang; script: ScriptLine[]; audio_url: string | null; duration_s: number | null }
export interface NrClip { id: string; label: string; start_s: number; end_s: number; rank: number; included: boolean }

export interface NrItem {
  id: string;
  game_id: string;
  kind: Kind;
  status: Status;
  title: string;
  depends_on: string | null;
  approved_by: string | null;
  publish_at: string | null;
  published_at: string | null;
  updated_at: string;
  version: number | null;
  author: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  home_id: string;
  away_id: string;
  game_status: string;
  variants: NrVariant[];
  claims: NrClaim[];
  episodes: NrEpisode[];
  clips: NrClip[];
  reach: Record<string, number>;   // "fi/quick" -> readers, or "all"
  log: { editor: string; action: string; reason: string | null; created_at: string }[];
}

export interface NrGame {
  id: string; home_id: string; away_id: string; home_score: number; away_score: number;
  status: string; starts_at: string; venue: string | null; event_count: number;
}

export interface NrJob {
  id: string; game_id: string | null; kind: string; status: string; model: string | null;
  input_tokens: number; output_tokens: number; note: string | null; error: string | null;
  created_at: string; started_at: string | null; finished_at: string | null;
}

export interface NrState { editor: string; items: NrItem[]; games: NrGame[]; jobs: NrJob[]; teams: Team[] }
