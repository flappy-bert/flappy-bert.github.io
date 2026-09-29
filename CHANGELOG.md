# Flappy Bert - Project Enhancements Documentation

This document details the technical changes and features implemented to improve the "Flappy Bert" game.

## v0.3 — Fixes, Mobile, New Modes & Polish (September 2026)

### Leaderboard: Firebase → Supabase
- **Moved the leaderboard to Supabase** (free Postgres). Setup steps in `SETUP.md`, table and rules in `supabase-setup.sql`. Old Firebase scores are not carried over.
- **Server-verified scores.** Browsers can't write to the leaderboard at all. A game gets a one-time ticket from the database on the first flap (`start_run`), and `submit_score` checks the ticket is real and unused, that the pipes and coins claimed were possible in the time that really passed (using the game's fixed scroll speed and spawn spacing, including Turbo's acceleration), that score = pipes + coins, and that name and mode are valid. Tickets are burned even on rejection, so fake scores can't be retried lower. 30 games per minute per player (hashed IP). Nobody can edit or delete scores from the browser. Tested against a real PostgreSQL with both cheating attempts and bot-played games.
- **Fixed HTML injection in the leaderboard.** Names were written with `innerHTML`, so a crafted entry could run script on every visitor's page. Rows are now built with `textContent`, and names/scores are cleaned on read as well as on write.
- **One top 5 per mode**, with a mode picker above the table that follows the mode you're playing. Live updates via Supabase Realtime, with a 60-second refresh as a backup.
- **Fixed qualification with fewer than 5 entries.** Previously you had to beat the lowest listed score even when the table had empty spots.
- Failed saves show "Couldn't save score" instead of claiming success; the game runs normally if the leaderboard is offline or not set up yet.
- When the game runs as a published claude.ai artifact it uses that page's built-in database instead, so the preview link has a working leaderboard too.

### Bug Fixes
- **V key now works** (it was documented but missing): shows the green pixel collision mask on Bert and the pipes.
- **M (menu) now clears coins and all other round state**, so leftovers no longer carry into the next game.
- **True fixed timestep.** `setTimeout(16)` drifted and ran slow when the browser throttled it. The loop now uses `requestAnimationFrame` with a 60-steps-per-second accumulator: same speed on 60/120/144Hz screens, same physics numbers as v0.2.
- **Pipes and coins spawn by distance travelled**, not by `setInterval`, so spacing stays right in Turbo and after lag. Spawners no longer run while the tab is hidden.
- Holding the flap key no longer auto-repeats flaps; Space/↑ no longer scroll the page.
- Score is now whole numbers (1 per pipe pair instead of 0.5 per pipe).
- Terminal fall speed added so very long drops stay readable.
- Removed dead code (`tableData`, unused `coin` object, commented-out resize) and fixed the malformed viewport meta tag.

### Mobile
- **Much smoother on phones.** Images are pre-shrunk once instead of every frame (Bert and the coin were 500×500 drawn at ~50px), outlined text is drawn once and reused, the vignette is baked into the background, Night mode uses one pre-made spotlight instead of full-screen blending, the canvas is opaque, and sound effects play through Web Audio (restarting `<audio>` on every flap stutters on iPhones). On a 6× throttled CPU: Classic ~35 → ~57 fps, Night ~15 → ~57 fps.
- Canvas scales to any screen (internal resolution stays 1080×640); on phones held sideways it fits the screen height.
- **Tap a menu button to pick any mode** (was: any tap started Classic). Retry/Menu buttons on the game-over screen are tappable.
- **Name entry uses a real text field**, so phones get their keyboard. Your last name is remembered.
- Page no longer blocks scrolling/zooming outside the game (`touch-action: none` on the canvas only).
- Auto-pause when the tab is hidden or the phone is locked.
- "Turn your phone sideways" hint in portrait.
- Page text stays dark on phones in dark mode (it was turning white on the light background).

### New Gameplay
- **7: Wobble** — pipe pairs drift up and down.
- **8: Flip** — tapping flips gravity (Bert turns upside-down); floor and ceiling are both deadly. Collision uses a flipped pixel mask.
- **Get-ready state**: Bert hovers until your first flap, with the mode name and a one-line tip.
- **Pause** with P or Esc (tap to resume).
- **Personal bests per mode** saved on the device, shown in the HUD, on menu buttons, and on the game-over screen.

### Visual & Sound Polish
- Unused sounds are now wired in: `sfx_point` (pipe passed / coin collected), `sfx_die`, `sfx_swooshing` (menu transitions).
- Mute toggle (N), remembered between visits.
- Hit feedback: screen shake, white flash, and Bert tumbles off-screen before the game-over panel.
- Coin sparkles and floating "+1" text.
- New game-over panel (score, mode, best, leaderboard status, Retry/Menu buttons) over the dimmed scene instead of a blank screen.
- Menu redesigned as a two-column grid with "NEW" tags and bests; hover highlight for mouse users.
- **Pixel font** (Press Start 2P, bundled in `fonts/`, SIL Open Font License) for the game and page headings.
- **Medals** on the game-over screen: bronze 10+, silver 20+, gold 30+, platinum 50+.
- **On-screen pause and mute buttons** (top-right), plus Resume/Menu buttons on the pause screen, so phones get every control.
- Animated menu: title drops in and waves, buttons slide in, hover lift; game-over panel slides down.
- Dust puffs on every flap, score "bump" when you score, glowing coins, soft vignette, fade between screens.
- Page restyled: pixel-grid background, hard drop shadows, medal colours for the top 3, keycap-style controls.
- HUD text outlined so it's readable on any part of the background; background is now drawn on the canvas (so it shakes and dims with the scene).

---

## v0.2 — Leaderboard & Quality of Life (July 5, 2026)

### Firebase Firestore Leaderboard
- Added real-time leaderboard powered by Firebase Firestore, tracking top 5 scores across all players synced via `onSnapshot` listener. Each entry stores `name`, `score`, `mode`, and server-side `timestamp`.
- Leaderboard table displays Rank (1–5), Name, Score, and Mode columns.

### Pixel-Art Name Entry Dialog
- Replaced browser `prompt()` with a custom canvas-drawn dialog box: gold "★ NEW HIGH SCORE! ★" title, left-aligned text input with blinking cursor, max 16 characters (A-Z, 0-9, `_`, `-`).
- Enter to save score, Escape to skip. Dialog only appears if the current score qualifies for the top 5.

### Score Qualification Gate
- Name dialog suppressed when score doesn't beat any existing top 5 score. Shows "Score X didn't make the top 5!" with the qualifying threshold. R/M keys work immediately — no key-blocking limbo.

### Fixed 60fps Game Loop
- Replaced `requestAnimationFrame` (frame-rate dependent) with `setTimeout(update, 16)` for a fixed ~60fps loop regardless of display refresh rate. All physics constants unchanged: gravity = 0.4/frame, pipe speed = -2 px/frame.

### Bug Fixes
- **Game over on mode selection:** `bert.y` was `Infinity` because the first frame after menu had zero delta time from skipped frames during the welcome screen loop. Fixed by using fixed-frame approach instead of delta-time scaling.
- **Name lost before submission:** `playerNameBuffer` cleared before calling `submitScore()`, so names were always empty. Now captured before clearing and passed directly to `submitScore(name)`.
- **Controls blocked during name entry:** R/M/B keys bypass the dialog handler after score is submitted or skipped, allowing reset/menu navigation without getting stuck.
- **Rank showing NaN in leaderboard:** Firebase's `onSnapshot` iterator doesn't pass an index like a normal array — replaced with manual counter (`let i = 0`).

---

## v0.1 — Pixel-Perfect Collision & Game Modes (May 9, 2026)

## 1. Pixel-Perfect Collision Detection
The primary request was to fix the hitbox so it matches the exact shape of the figure instead of a simple square.

### Technical Implementation:
- **Alpha Masking**: Added a `getMask` function that renders each game sprite (Bert, Top Pipe, Bottom Pipe) onto a hidden temporary canvas. It then reads the `imageData` to create a `Uint8Array` mask where `1` represents a visible pixel and `0` represents transparency.
- **Two-Phase Collision**:
    1. **Phase 1 (AABB)**: Performs a fast Axis-Aligned Bounding Box check to see if the rectangles overlap.
    2. **Phase 2 (Pixel Check)**: If the rectangles overlap, the engine calculates the intersection area and iterates through the corresponding pixels in both the Bert mask and the Pipe mask. A collision is only triggered if two non-transparent pixels overlap.
- **Dynamic Masking**: Implemented `updateBertMasks()` to regenerate collision data whenever Bert's size changes (e.g., in "Bad Luck" mode).

## 2. Game Modes & Welcome Screen
Added a structured starting sequence and distinct gameplay experiences.

### Features:
- **Welcome Screen**: The game now starts in a "waiting" state, displaying a title and mode selection menu.
- **Game Modes**:
    - **Classic**: Standard skill-based gameplay.
    - **Bad Luck**: Random debuffs and luck-based mechanics.
    - **Turbo Mode**: The game speeds up gradually as you play.
    - **Night Mode**: Features a "flashlight" effect where only the area around Bert is visible.
    - **Giant Bert**: Bert is doubled in size, increasing the difficulty of navigating gaps.
    - **Zen Mode**: No pipes or collisions! Focus on collecting coins for a high score.

## 3. Debugging & Visualization Tools
Tools implemented to verify the accuracy of the new collision system.

### Features:
- **Mask Visualization (Press "V")**: Toggles a green semi-transparent overlay on the canvas. This overlay renders the actual collision mask used by the engine, allowing the user to see that the hitbox precisely follows the character's contours.
- **CORS/Security Fallback Detection**: Since pixel-reading (`getImageData`) is restricted by browser security when running via `file://` protocols, I added a detection system.
    - If the browser blocks the pixel-perfect system, the game automatically falls back to box collision to prevent a crash.
    - A red warning message appears on the screen: *"Note: Using box collision (CORS/File limit)"*, informing the user why the precision might be reduced.

## 4. Architectural Refactoring
- **Resource Management**: Refactored `window.onload` to use an image loading counter. This ensures that the game loop, intervals, and mask generation only start after every asset is successfully loaded into memory, preventing race conditions.
- **State Encapsulation**: Consolidated game reset logic into a `resetGame()` function to ensure consistent behavior across manual resets ("R" key) and mode transitions.
- **Home Screen Navigation**: Added the **"M" key** functionality to allow players to exit their current game session and return to the mode selection screen at any time.
- **Animated Coins**: Coins now feature a "spin" animation (horizontal scaling effect) across all modes (Classic and Zen) to make them more visually engaging.
- **Improved Coin Balancing**: Increased the spawn frequency and physical size (from 40px to 60px) of coins to make collection easier and more rewarding.
- **UI Improvements**: Updated the `index.html` controls list and repositioned HUD elements for better clarity (Score next to coin, smaller Passed counter).

---
*Documented on May 9, 2026*
