# 🦅 FLAPPY BERT - v0.3: "Trust Issues"

*"I finally got on the leaderboard. Then someone named XXXHACKERXXX scored 9,999 in four seconds. Not anymore." — Bert*

Welcome to the **v0.3 Release** of Flappy Bert. This is the big one. We moved the leaderboard to a new database that doesn't believe a word you say, made the game playable on phones, added two new ways to fail, and gave the whole thing a glow-up so shiny Bert had to put his glasses back on.

## 🛠 WHAT'S NEW (Technical Stuff for Nerds)

### 1. The Leaderboard Now Has Trust Issues
In v0.2, the leaderboard believed anything you told it. Tell it you scored a million? "Wow, great job!" Those days are over.
*   **Moved from Firebase to Supabase**, a free database that works on GitHub Pages. Setup instructions are in `SETUP.md`.
*   **Physics doesn't lie:** pipes and coins show up at a fixed pace, so the server knows the most anyone could score in the time that passed. Claim 500 pipes after 20 seconds and you'll be politely escorted out.
*   **No second chances:** a ticket is used up even if your score gets rejected, so you can't keep lowering your fake score until one sticks.
*   **The Tech:** Browsers can only read the table. All writes go through `submit_score()`, a Postgres function that checks the ticket, the elapsed time (including Turbo's acceleration), and that score = pipes + coins. There's also a limit of 30 games a minute per player.

### 2. Each Mode Gets Its Own Podium
Zen players were collecting coins in peace and taking over the whole leaderboard. Now **every mode has its own top 5**, with a mode picker above the table. Zen players can be smug among themselves.

### 3. Bert Goes Mobile
*   **Tap a mode to play it.** Before, tapping anywhere started Classic, whether you liked it or not.
*   **A real text box for your name**, so your phone's keyboard actually shows up.
*   **Pause and mute buttons** in the corner, for when your boss walks by.
*   **Auto-pause** when you switch apps. Bert will wait. Bert has nowhere to be.
*   The game scales to fit any screen. Turn your phone sideways for the full kitchen experience.

### 4. Two New Ways to Fail
7.  **Wobble:** the pipes won't hold still. Neither will your nerves.
8.  **Flip:** tapping flips gravity and Bert hangs upside down. The floor wants you, and so does the ceiling.

### 5. The Glow-Up
*   **Pixel font** everywhere, because Courier New was holding us back.
*   **Medals:** bronze at 10, silver at 20, gold at 30, platinum at 50. Finally, something to show your mom.
*   **Crashes feel like crashes:** screen shake, a white flash, and Bert tumbling off-screen in shame.
*   **Get Ready screen:** Bert hovers politely until your first flap, instead of plummeting while you're still reading the menu.
*   Dust puffs when you flap, sparkles when you grab coins, "+1" pop-ups, a bouncing score, a new game-over panel, and **personal bests for every mode** saved on your device.
*   **Sound effects finally hired:** three sounds had been sitting in the `sounds` folder since forever, collecting a paycheck and doing nothing. They now play when you score, when you die, and when you change screens.

## 🐛 BUG FIXES
*   **Fixed:** The leaderboard could run someone else's code on your screen. A crafted "name" could inject code into every visitor's page. Names are now just names.
*   **Fixed:** The **V** key. The v0.1 notes promised a green "Misery Mask." It never existed. We're sorry. It exists now.
*   **Fixed:** The "fixed 60fps" loop from v0.2 was not, in fact, fixed. `setTimeout(16)` drifted and slowed down whenever the browser felt like it. Now it's a real 60 physics steps per second, on any screen.
*   **Fixed:** Pressing **M** left coins floating around to haunt your next game.
*   **Fixed:** Pipes spawned on a timer, so Turbo mode stretched the gaps. Pipes now spawn by distance.
*   **Fixed:** With fewer than 5 scores on the board, you still had to beat the lowest one. An empty spot is now yours for the taking.
*   **Fixed:** Holding Space fired flaps like a machine gun and scrolled the page.
*   **Fixed:** Dark-mode phones turned the page text white on a light background, which is a bold choice.
*   **Fixed:** Scores went up by 0.5 per pipe, meaning Bert had been passing half-pipes this whole time. Scores are now whole numbers.

## 🕹 CONTROLS (Now With Buttons for Phone People)
- **1 - 8 or tap:** Pick your disaster.
- **Space / X / Up / tap:** Defy gravity briefly.
- **P / Esc / ⏸:** Pause and question your choices.
- **N / 🔊:** Mute Bert's suffering.
- **R:** Restart your failure.
- **M:** Back to the menu.
- **V:** The Misery Mask (it's real now, we promise).
- **B:** Box borders, for that retro "I'm about to hit something" feeling.

---
*"They said I couldn't cheat death. Turns out I can't cheat the leaderboard either."*
— **v0.3 Stable Release**
