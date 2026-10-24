-- FinUrheilu: database schema
-- Liiga data, AI jobs, editorial content and reader preferences.
-- Readers (the anon key) can only read sports data and PUBLISHED content.
-- Everything else is written by the server with the service-role key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Liiga data
create table public.teams (
  id          text primary key,              -- slug, e.g. 'karpat'
  name        text not null,
  short       text not null,
  city        text not null,
  color       text not null default '#1F6FEB'
);

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references public.teams(id),
  name        text not null,
  number      int,
  position    text check (position in ('G','D','F'))
);

create table public.games (
  id               text primary key,
  liiga_game_id    text unique,
  home_id          text not null references public.teams(id),
  away_id          text not null references public.teams(id),
  starts_at        timestamptz not null,
  status           text not null default 'scheduled' check (status in ('scheduled','live','final')),
  ended_in         text check (ended_in in ('regulation','overtime','shootout')),
  home_score       int not null default 0,
  away_score       int not null default 0,
  shots_home       int,
  shots_away       int,
  venue            text,
  video_source_url text,                       -- licensed stream/VOD; null = make a data video instead
  updated_at       timestamptz not null default now()
);

create table public.game_events (
  id              bigserial primary key,
  game_id         text not null references public.games(id) on delete cascade,
  period          int not null,                -- 1,2,3, 4 = overtime
  clock           text not null,               -- 'mm:ss' inside the period
  game_seconds    int not null,                -- seconds from puck drop
  type            text not null check (type in ('goal','shot','save','penalty','fight','period_end')),
  team_id         text references public.teams(id),
  player_id       uuid references public.players(id),
  detail          text,                        -- 'PP', 'SH', 'EN', 'OT winner' …
  score_after     text,                        -- '1–0' for goals
  video_offset_s  int,                         -- position in the stored video
  created_at      timestamptz not null default now()
);
create index on public.game_events (game_id, game_seconds);

-- ---------------------------------------------------------------- AI + editorial
create table public.ai_jobs (
  id             uuid primary key default gen_random_uuid(),
  game_id        text references public.games(id) on delete cascade,
  kind           text not null check (kind in ('summary','podcast','highlight','rewrite')),
  status         text not null default 'queued' check (status in ('queued','running','done','failed')),
  model          text,
  input_tokens   int default 0,
  output_tokens  int default 0,
  note           text,
  error          text,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

create table public.content_items (
  id                  uuid primary key default gen_random_uuid(),
  game_id             text not null references public.games(id) on delete cascade,
  kind                text not null check (kind in ('summary','podcast','highlight')),
  status              text not null default 'draft'
                        check (status in ('draft','needs_review','flagged','approved','scheduled','published','rejected')),
  title               text not null,
  current_version_id  uuid,
  depends_on          uuid references public.content_items(id),
  fan_team_id         text references public.teams(id),
  approved_by         text,
  publish_at          timestamptz,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (game_id, kind)
);

create table public.content_versions (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.content_items(id) on delete cascade,
  version     int not null,
  author      text not null,                   -- 'ai:<model>' or editor name
  note        text,
  job_id      uuid references public.ai_jobs(id),
  payload     jsonb not null default '{}'::jsonb, -- headline, video url, etc.
  created_at  timestamptz not null default now(),
  unique (item_id, version)
);
alter table public.content_items
  add constraint content_items_current_version_fk
  foreign key (current_version_id) references public.content_versions(id) on delete set null;

create table public.summary_variants (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.content_versions(id) on delete cascade,
  item_id     uuid not null references public.content_items(id) on delete cascade,
  language    text not null check (language in ('fi','sv','en')),
  style       text not null check (style in ('quick','full','fan')),
  text        text not null,
  unique (version_id, language, style)
);

create table public.claims (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.content_versions(id) on delete cascade,
  item_id       uuid not null references public.content_items(id) on delete cascade,
  text          text not null,
  fact_key      text,
  ai_value      text,
  source_value  text,
  check_status  text not null default 'unverified' check (check_status in ('ok','mismatch','unverified'))
);

create table public.video_clips (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.content_versions(id) on delete cascade,
  item_id     uuid not null references public.content_items(id) on delete cascade,
  event_id    bigint references public.game_events(id),
  label       text not null,
  start_s     numeric not null,
  end_s       numeric not null,
  rank        numeric not null default 0,
  included    boolean not null default true,
  position    int not null default 0
);

create table public.podcast_episodes (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.content_versions(id) on delete cascade,
  item_id     uuid not null references public.content_items(id) on delete cascade,
  language    text not null check (language in ('fi','sv','en')),
  script      jsonb not null,                  -- [{host:'A'|'B', text:'…'}]
  audio_url   text,                            -- null = app reads the script with the device voice
  duration_s  int,
  unique (version_id, language)
);

create table public.review_actions (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.content_items(id) on delete cascade,
  editor      text not null,
  action      text not null check (action in ('approve','publish','schedule','reject','unpublish','edit','fix_claim','rewrite','reopen','toggle_clip')),
  reason      text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- Readers
create table public.reader_profiles (
  id          uuid primary key default gen_random_uuid(),
  device_id   text unique not null,
  language    text not null default 'fi' check (language in ('fi','sv','en')),
  team_ids    text[] not null default '{}',
  style       text not null default 'quick' check (style in ('quick','full','fan')),
  formats     text[] not null default '{summary}',
  updated_at  timestamptz not null default now()
);
create index on public.reader_profiles using gin (team_ids);

-- What readers see: is this item live in the app right now?
create or replace function public.is_live(i public.content_items)
returns boolean language sql stable as $$
  select i.status = 'published' or (i.status = 'scheduled' and i.publish_at <= now())
$$;

-- ---------------------------------------------------------------- Row-level security
alter table public.teams            enable row level security;
alter table public.players          enable row level security;
alter table public.games            enable row level security;
alter table public.game_events      enable row level security;
alter table public.ai_jobs          enable row level security;
alter table public.content_items    enable row level security;
alter table public.content_versions enable row level security;
alter table public.summary_variants enable row level security;
alter table public.claims           enable row level security;
alter table public.video_clips      enable row level security;
alter table public.podcast_episodes enable row level security;
alter table public.review_actions   enable row level security;
alter table public.reader_profiles  enable row level security;

-- Sports data is public.
create policy "public read teams"   on public.teams       for select using (true);
create policy "public read players" on public.players     for select using (true);
create policy "public read games"   on public.games       for select using (true);
create policy "public read events"  on public.game_events for select using (true);

-- Content: only what an editor has published (or scheduled and now due), and only its current version.
create policy "readers see live items" on public.content_items
  for select using (public.is_live(content_items));

create policy "readers see live versions" on public.content_versions
  for select using (exists (select 1 from public.content_items i
    where i.current_version_id = content_versions.id and public.is_live(i)));

create policy "readers see live variants" on public.summary_variants
  for select using (exists (select 1 from public.content_items i
    where i.current_version_id = summary_variants.version_id and public.is_live(i)));

create policy "readers see live clips" on public.video_clips
  for select using (included and exists (select 1 from public.content_items i
    where i.current_version_id = video_clips.version_id and public.is_live(i)));

create policy "readers see live episodes" on public.podcast_episodes
  for select using (exists (select 1 from public.content_items i
    where i.current_version_id = podcast_episodes.version_id and public.is_live(i)));

-- ai_jobs, claims, review_actions and reader_profiles have no public policy:
-- only the server (service role) can read or write them.

-- ---------------------------------------------------------------- Storage for audio and video
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
