# 🦅 FLAPPY BERT - v0.1: "The Great Hitbox Debacle"

*“I used to think my hitbox was a square... then I realized my whole life is a circle of misfortune.” — Bert*

Welcome to the **v0.1 Release** of Flappy Bert. We’ve been working hard to make sure your experience is as polished as possible, even if Bert's luck is still at rock bottom. 

## 🛠 WHAT'S NEW (Technical Stuff for Nerds)

### 1. Pixel-Perfect Agony
We fired the guy who made the hitbox a giant invisible square. Bert is now exactly as aerodynamic as he looks.
*   **The Tech:** We implemented **Alpha-Masking Collision**. The game now checks the actual non-transparent pixels of Bert against the pipes.
*   **Visual Proof:** Press **"V"** in-game to see the green "Misery Mask." If it’s green, you’re safe (mostly).

### 2. Six Ways to Fail (New Game Modes)
Choose your flavor of disaster from our brand-new **Pixel-Art Welcome Screen**:
1.  **Classic:** The way nature intended. Just you, the pipes, and impending doom.
2.  **Bad Luck Mode:** Bert’s natural state. Random debuffs like "No Gravity" or "Giant Growth" will trigger when your luck runs out.
3.  **Turbo Mode:** For those who want to get to the "Game Over" screen faster. Speed ramps up over time.
4.  **Night Mode:** Bert forgot his glasses. Fly in the dark with a 220px radial "flashlight" gradient. Silhouettes are 90% obscured for maximum anxiety.
5.  **Giant Bert:** Twice the bird, twice the surface area for collisions. Good luck.
6.  **Zen Mode:** No pipes, no death. Just collect **60px Animated Bert Bucks** and pretend everything is okay.

### 3. Shiny Distractions
*   **Animated Coins:** Coins now spin horizontally using a `sin(Date.now())` scaling effect. They are now **60px** because Bert’s ego needed a boost.
*   **HUD Revamp:** Score is now next to the coin icon (top-left). "Passed Pipes" counter moved to the left side in a smaller, humbler font.

## 🕹 CONTROLS (Don't forget them like Bert forgot his rent)
- **1 - 6:** Select your Mode at the start.
- **Space / X / Up:** Defy gravity briefly.
- **R:** Restart your failure.
- **M:** Go back to the Menu to pick a different disaster.
- **V:** Toggle the Hitbox Mask (only works if served via a real web server like GitHub Pages).
- **B:** Toggle Box Borders (for that retro "I'm about to hit something" feeling).

## ⚠️ A NOTE ON LOCAL PLAY
If you open this file directly from your computer, you might see a red warning about **CORS/File limits**. This is because browsers are scared of Bert's transparency. Upload this to **GitHub Pages**, and the pixel-perfect collision will work flawlessly!

---
*“I’m not unlucky, I’m just technically challenged.”*
— **v0.1 Stable Release**
