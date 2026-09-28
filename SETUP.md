# Leaderboard setup (Supabase, free)

The leaderboard uses a free [Supabase](https://supabase.com) project. Setup takes about 5 minutes.
Without it, the game still works; the leaderboard just says "Leaderboard offline".

## 1. Create the project
1. Sign up at supabase.com and click **New project** (the Free plan is fine).
2. Pick a name and a database password (you won't need the password for this), then create it.

## 2. Create the table
1. In your project, open **SQL Editor** → **New query**.
2. Paste everything from `supabase-setup.sql` and click **Run**. It should say "Success".

This creates the `leaderboard` table and the two functions the game uses to submit scores,
and turns on live updates. Browsers can read the leaderboard but can't write to it directly:
every score goes through a server check (see "How scores are protected" below).
If you already ran an older version of this file, just run the new one; it upgrades in place.

## 3. Connect the game
1. Open **Project Settings → API Keys** (or the **Connect** button at the top of the dashboard).
2. Copy the **Project URL** and the **publishable key** (older projects call it the `anon` `public` key).
3. Paste them at the top of the leaderboard section in `flappybert.js`:
   ```js
   const SUPABASE_URL = "https://abcdefgh.supabase.co";
   const SUPABASE_KEY = "sb_publishable_...";
   ```
   The publishable key is meant to be public. **Never** use the `secret` / `service_role` key.
4. Commit and push. GitHub Pages picks it up in a minute or two.

## Good to know
- **Free projects pause after about a week with no activity.** Supabase emails you first. Open the
  project in the dashboard and click **Restore** to wake it. Scores are kept while paused.
- To wipe or fix scores, use **Table Editor → leaderboard** in the dashboard.

## How scores are protected
- When a game starts, the database issues a **one-time ticket** stamped with its own clock.
- A score is only accepted with an unused ticket, and only if it was **possible in the time that
  really passed**: pipes and coins arrive at a fixed pace, so the database knows the maximum.
  It also checks that score = pipes + coins, and that names and modes are valid.
- A ticket is used up even when a score is rejected, so a cheater can't keep retrying lower numbers.
- Each player (by IP address, stored only as a hash) can start at most 30 games a minute.
- Browsers can't add, edit or delete rows, can't see the ticket table, and can't forge tickets.

What this can't stop: someone who writes a bot that actually plays the game, or who waits the
real amount of time and then claims a score that fits within it. Fully stopping that would mean
re-running every game on the server. If a suspicious score appears, delete it in
**Table Editor → leaderboard**.
