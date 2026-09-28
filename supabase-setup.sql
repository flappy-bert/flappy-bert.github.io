-- =============================================================================
-- Flappy Bert leaderboard (Supabase)
-- Run once: Dashboard > SQL Editor > New query > paste this whole file > Run.
-- Safe to run again after changes; it replaces the functions and keeps scores.
--
-- How cheating is blocked:
--   * Browsers can READ the leaderboard but can't write to it directly.
--   * When a game starts, start_run() issues a one-time ticket stamped with the
--     database's own clock.
--   * submit_score() only accepts a score with an unused ticket, and only if that
--     score was physically possible in the time that really passed. Editing the
--     request to send 9999 gets rejected.
--   * Each player (by IP) can start at most 30 games a minute.
-- =============================================================================

-- ---- Tables ------------------------------------------------------------------

-- Private schema: NOT exposed through the API, so browsers can't read or touch it.
create schema if not exists game;

create table if not exists game.runs (
    id           uuid primary key default gen_random_uuid(),
    mode         text        not null,
    started_at   timestamptz not null default now(),
    player_hash  text        not null,          -- hashed IP, for rate limiting only
    submitted    boolean     not null default false
);
create index if not exists runs_player_started_idx on game.runs (player_hash, started_at);
create index if not exists runs_started_idx on game.runs (started_at);

create table if not exists public.leaderboard (
    id          bigint generated always as identity primary key,
    name        text        not null check (name ~ '^[A-Z0-9_-]{1,16}$'),
    score       integer     not null check (score between 1 and 100000),
    mode        text        not null check (mode in ('classic','badluck','turbo','night','giant','zen','wobble','flip')),
    created_at  timestamptz not null default now(),
    run_id      uuid        unique                  -- each ticket can post once
);
alter table public.leaderboard add column if not exists run_id uuid unique;

create index if not exists leaderboard_mode_score_idx
    on public.leaderboard (mode, score desc, created_at);

-- ---- Who can do what -----------------------------------------------------------

alter table public.leaderboard enable row level security;

drop policy if exists "Anyone can read scores" on public.leaderboard;
create policy "Anyone can read scores"
    on public.leaderboard for select
    to anon, authenticated
    using (true);

-- No insert/update/delete policies: browsers can't write rows directly.
drop policy if exists "Anyone can add a score" on public.leaderboard;

revoke all on public.leaderboard from anon, authenticated;
grant select (id, name, score, mode, created_at) on public.leaderboard to anon, authenticated;

revoke all on schema game from anon, authenticated;
revoke all on all tables in schema game from anon, authenticated;

-- ---- start_run: issue a ticket when a game starts -----------------------------

create or replace function public.start_run(p_mode text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_headers json;
    v_ip      text;
    v_player  text;
    v_recent  integer;
    v_id      uuid;
begin
    if p_mode is null or p_mode not in ('classic','badluck','turbo','night','giant','zen','wobble','flip') then
        raise exception 'Unknown mode' using errcode = '22023';
    end if;

    -- Identify the player by IP (hashed; the IP itself is never stored)
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    v_ip := coalesce(
        nullif(v_headers ->> 'cf-connecting-ip', ''),
        nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
        'unknown');
    v_player := md5('flappy-bert:' || v_ip);

    select count(*) into v_recent
    from game.runs
    where player_hash = v_player and started_at > now() - interval '1 minute';
    if v_recent >= 30 then
        raise exception 'Too many games started. Wait a minute.' using errcode = '54000';
    end if;

    -- Housekeeping: tickets older than a day are useless (see 'expired' below)
    delete from game.runs where started_at < now() - interval '1 day';

    insert into game.runs (mode, player_hash)
    values (p_mode, v_player)
    returning id into v_id;

    return v_id;
end;
$$;

-- ---- submit_score: the only way onto the leaderboard ---------------------------
--
-- Game facts the limits are based on (see flappybert.js):
--   * scroll speed 2 px per frame at 60 frames/s = 120 px/s; the game can't run
--     faster than real time. Turbo adds 0.001 px/frame every frame
--     (distance = 120t + 1.8t² px after t seconds).
--   * a pipe pair every 180 px; the first can't be passed before 1069 px.
--   * a coin chance every 120 px; the first can't be reached before 965 px.
--   * score = pipes + coins in every mode except Bad Luck, which can only lose points.

drop function if exists public.submit_score(uuid, text, integer, integer, integer);
create function public.submit_score(
    p_run   uuid,
    p_name  text,
    p_score integer,
    p_pipes integer,
    p_coins integer
)
returns text            -- 'ok', or the reason the score was rejected
language plpgsql
security definer
set search_path = ''
as $$
declare
    r           game.runs%rowtype;
    v_secs      double precision;
    v_dist      double precision;
    v_max_pipes integer;
    v_max_coins integer;
begin
    -- Lock the ticket so two submissions can't race
    select * into r from game.runs where id = p_run for update;
    if not found then
        return 'unknown game';
    end if;
    if r.submitted then
        return 'this game was already submitted';
    end if;

    -- Use the ticket up now. Rejections below RETURN instead of raising an error,
    -- so this stays saved and a rejected score can't be retried with other numbers.
    update game.runs set submitted = true where id = p_run;

    v_secs := extract(epoch from (now() - r.started_at));
    if v_secs > 3600 then
        return 'game expired';
    end if;

    if p_name is null or p_name !~ '^[A-Z0-9_-]{1,16}$' then
        return 'bad name';
    end if;
    if p_score is null or p_pipes is null or p_coins is null
       or p_score < 1 or p_pipes < 0 or p_coins < 0 then
        return 'bad score';
    end if;

    -- Furthest the game could possibly have scrolled, with a small allowance for
    -- network delay and clock differences
    v_secs := v_secs * 1.02 + 3;
    v_dist := 120 * v_secs + case when r.mode = 'turbo' then 1.8 * v_secs * v_secs else 0 end;

    v_max_pipes := case
        when r.mode = 'zen' or v_dist < 1069 then 0
        else floor((v_dist - 1069) / 180)::integer + 1
    end;
    v_max_coins := case
        when r.mode not in ('classic', 'zen', 'wobble') or v_dist < 965 then 0
        else floor((v_dist - 965) / 120)::integer + 1
    end;

    if p_pipes > v_max_pipes or p_coins > v_max_coins then
        return 'score not possible in that time';
    end if;

    if r.mode = 'badluck' then
        if p_score > p_pipes then
            return 'score does not add up';
        end if;
    elsif p_score <> p_pipes + p_coins then
        return 'score does not add up';
    end if;

    insert into public.leaderboard (name, score, mode, run_id)
    values (p_name, p_score, r.mode, p_run);
    return 'ok';
end;
$$;

-- Only these two functions are callable from the browser
revoke all on function public.start_run(text) from public;
revoke all on function public.submit_score(uuid, text, integer, integer, integer) from public;
grant execute on function public.start_run(text) to anon, authenticated;
grant execute on function public.submit_score(uuid, text, integer, integer, integer) to anon, authenticated;

-- ---- Live updates ---------------------------------------------------------------

do $$
begin
    alter publication supabase_realtime add table public.leaderboard;
exception when duplicate_object then null;
end $$;
