# 🦅 FLAPPY BERT - v0.2: "Score or Go Home"

*"I finally beat a score... now what? Oh right, more pipes." — Bert*

Welcome to the **v0.2 Release** of Flappy Bert. We've added a leaderboard that actually matters, a name entry system that doesn't look like it was coded by someone who's never seen an HTML prompt, and some critical bug fixes so you can finally play without hitting a pipe before the game even starts.

## 🛠 WHAT'S NEW (Technical Stuff for Nerds)

### 1. Firebase Leaderboard Integration
Bert's failures are now permanently recorded in the cosmos. A real-time leaderboard powered by **Firebase Firestore** tracks the top 5 scores across all players, synced instantly without refreshing.
*   **The Tech:** Real-time `onSnapshot` listener on a `leaderboard` collection ordered by score descending, limited to 5 entries. Each entry stores `name`, `score`, `mode`, and a server-side `timestamp`.

### 2. Pixel-Art Name Dialog
No more ugly browser `prompt()` popups when you die. A custom pixel-art styled dialog box draws directly on the canvas with:
*   **"★ NEW HIGH SCORE! ★"** gold title — only appears if your score qualifies for the top 5
*   **Left-aligned text input** with a blinking cursor, proper character spacing (no more off-by-one cursor drift)
*   **Allowed characters:** A-Z, 0-9, `_` and `-` — max 16 characters
*   **Enter to save**, **Escape to skip**

### 3. Score Qualification Gate
The name dialog no longer pops up for every death. It only appears if your score beats at least one of the top 5 scores (or if the leaderboard is empty). If you don't qualify, it shows: *"Score X didn't make the top 5! You need Y or more to qualify."* and lets you press R/M immediately — no key-blocking limbo.

### 4. Fixed 60fps Physics Engine
The game loop now runs at a **fixed 60fps** using `setTimeout(update, 16)` instead of the frame-rate-dependent `requestAnimationFrame`. This means:
*   Pipes move at exactly -2 px/frame regardless of your display's refresh rate (no more 120Hz turbo mode)
*   Gravity is consistently 0.4 per frame
*   No delta-time math, no floating-point drift

## 🐛 BUG FIXES
*   **Fixed:** Game over on mode selection — `bert.y` was `Infinity` because the first frame after menu had a zero delta time from skipped frames in the welcome screen loop
*   **Fixed:** Name lost before submission — `playerNameBuffer` was cleared before calling `submitScore()`, so names were always empty
*   **Fixed:** Controls blocked during name entry — R/M/B keys now bypass the dialog handler and work normally after score is submitted or skipped
*   **Fixed:** Rank showing NaN — Firebase's `onSnapshot` iterator doesn't pass an index like a normal array, replaced with manual counter

## 🕹 CONTROLS (Same as always)
- **1 - 6:** Select your Mode at the start.
- **Space / X / Up:** Defy gravity briefly.
- **R:** Restart after game over.
- **M:** Go back to the Menu.
- **B:** Toggle Box Borders.
- **Enter/Escape (name dialog):** Save or skip when you qualify for the leaderboard.

## ⚠️ A NOTE ON THE LEADERBOARD
The leaderboard requires a Firebase project. If not configured, scores won't save and the leaderboard shows a placeholder message. Set up is free — go to https://console.firebase.google.com, create a project, enable Firestore in test mode, and paste your config into `firebaseConfig` in `flappybert.js`.

---
*"I'm not unlucky, I'm just technically challenged."*
— **v0.2 Stable Release**
