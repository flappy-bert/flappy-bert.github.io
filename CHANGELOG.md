# Flappy Bert - Project Enhancements Documentation

This document details the technical changes and features implemented to improve the "Flappy Bert" game.

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
