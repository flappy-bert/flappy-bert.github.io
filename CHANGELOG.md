# Flappy Bert - Project Enhancements Documentation

This document details the technical changes and features implemented to improve the "Flappy Bert" game.

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
