// Game board configuration
let board;  // Canvas element (background image set in CSS)
let boardWidth = 1080;  // Canvas width in pixels
let boardHeight = 640;  // Canvas height in pixels
let context;  // 2D drawing context for canvas rendering

// Bird (Bert) configuration
let bertWidth = 50;   // Bird width in pixels
let bertHeight = 50;  // Bird height in pixels
let bertX = boardWidth / 8;    // Initial X position
let bertY = boardHeight / 2;   // Initial Y position (centered vertically)

let bertImgs = [];          // Array of animation frames
let bertImgsIndex = 0;      // Current animation frame index

// Bird game object with dimensions and current position
let bert = {
    x: bertX,
    y: bertY,
    width: bertWidth,
    height: bertHeight
};

// Pipe configuration (top lamp, bottom coffee mug tower)
let pipeArray = [];         // Array of active pipes on screen
let pipeWidth = 64;         // Pipe width in pixels (ratio: width/height = 384/3072 ≈ 1/8)
let pipeHeight = 512;       // Pipe height in pixels
let pipeX = boardWidth;     // Initial X position (off-screen right)
let pipeY = 0;              // Base Y position

let topPipeImg;             // Image asset for top pipe
let bottomPipeImg;          // Image asset for bottom pipe

// Coin configuration (Bert Buck)
let coinWidth = 80;   // Coin width in pixels
let coinHeight = 80;  // Coin height in pixels
let coinImg;          // Coin image asset

// Coin object for score display
let coin = {
    x: 10,
    y: 5,
    width: coinWidth,
    height: coinHeight
};

// Game physics constants
let baseVelocityX = -2;  // Base horizontal speed (pipes move left)
let velocityX = -2;      // Current horizontal speed (modified by turbo mode)
let velocityY = 0;       // Vertical velocity (controls jump arc)
let gravity = 0.4;       // Gravity acceleration per frame

// Game state variables
let gameOver = false;          // True when game ends
let gameStarted = false;       // True after mode selection
let gameMode = "";             // Current mode: "classic", "badluck", "turbo", "night", "giant", "zen"
let score = 0;                 // Player's current score
let coinArray = [];            // Array of active coins on screen
let badEndCounter = 10;        // Countdown to bad ending in badluck mode (reaches 0 triggers bad end)
let isNoGapInPipes = false;    // When true, pipes have no gap between them
let pipeCrossed = 0;           // Number of pipes successfully passed
let isBadEnd = false;          // True when a bad ending effect is active
let badEnd = 0;                // Random identifier for which bad ending occurred
let badEndStr = "";            // Description of current bad ending effect
let isBordersOn = false;       // When true, draw debug borders around sprites
let scoreSubmitted = false;    // Tracks whether current game over score was submitted
// Pixel-art name entry dialog state
let playerNameBuffer = "";     // Player's typed name (max 16 chars)
const MAX_NAME_LEN = 16;

// Frame timing — removed (now using setTimeout for fixed 60fps)
// Leaderboard data
let table;        // DOM reference to leaderboard table element
let tableData = [];  // Parsed leaderboard data from HTML table

// Firebase config — replace with your project's values (see SETUP.md)
const firebaseConfig = {
    apiKey: "AIzaSyC-yQdg6OtaxvxDoxqz6tKtFxYY4aID7w8",
    authDomain: "flappy-bert-leaderboard.firebaseapp.com",
    projectId: "flappy-bert-leaderboard",
    storageBucket: "flappy-bert-leaderboard.firebasestorage.app",
    messagingSenderId: "717739585379",
    appId: "1:717739585379:web:8fadcda82042f8206e2d56"
};

// Initialize Firebase (lazy — only when game over triggers)
let db = null;
let lowestTop5Score = -Infinity;  // Lowest score among current top 5 (-Inf means any score qualifies)

function initFirebase() {
    if (!db) {
        // Only initialize if config is not the placeholder and firebase SDK loaded
        if (firebaseConfig.apiKey === "REPLACE_WITH_YOUR_API_KEY" || typeof firebase === "undefined") {
            console.warn("Firebase not configured or SDK not loaded.");
            const tbody = table.querySelector("#leaderboard-body");
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Configure Firebase to enable live leaderboard</td></tr>`;
            return false;
        }
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        // Set up real-time listener for leaderboard — top 5 scores, highest first
        const colRef = db.collection("leaderboard").orderBy("score", "desc").limit(5);
        colRef.onSnapshot(snapshot => {
            const tbody = table.querySelector("#leaderboard-body");
            tbody.innerHTML = "";

            if (snapshot.empty) {
                lowestTop5Score = -Infinity;  // No scores — any score qualifies
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No scores yet</td></tr>`;
                return;
            }

            let i = 0;
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Always update — last doc in descending order is the lowest score
                lowestTop5Score = data.score ?? -Infinity;

                const rank = i + 1;
                const modeLabel = (data.mode || "classic").toUpperCase();
                const row = document.createElement("tr");
                row.innerHTML = `<td>${rank}</td><td>${data.name}</td><td>${Math.floor(data.score)}</td><td>${modeLabel}</td>`;
                tbody.appendChild(row);
                i++;
            });

        }, err => {
            console.error("Leaderboard sync error:", err);
        });
    }
    return !!db;
}

/**
 * Draws a pixel-art styled name entry dialog box on the canvas.
 */
function drawNameDialog() {
    let bx = boardWidth / 2 - 240;
    let by = 170;
    let bw = 480;
    let bh = 165;

    // Dark semi-transparent backdrop
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(bx - 20, by - 20, bw + 40, bh + 40);

    // Outer border (white pixel-art frame)
    context.strokeStyle = "#fff";
    context.lineWidth = 6;
    context.strokeRect(bx, by, bw, bh);

    // Inner background
    context.fillStyle = "#1a1a2e";
    context.fillRect(bx + 4, by + 4, bw - 8, bh - 8);

    // Title text (centered) — big "NEW HIGH SCORE!" with smaller subtitle
    context.textAlign = "center";
    context.fillStyle = "#ffd700";
    context.font = "bold 32px 'Courier New', Courier, monospace";
    context.fillText("★ NEW HIGH SCORE! ★", boardWidth / 2, by + 38);

    // Subtitle hint
    context.fillStyle = "#ccc";
    context.font = "14px 'Courier New', Courier, monospace";
    context.fillText("Type your name & press Enter", boardWidth / 2, by + 56);

    // Input field (dark rectangle with border) — pushed down for subtitle
    let inputX = bx + 60;
    let inputY = by + 72;
    let inputW = bw - 120;
    let inputH = 38;

    context.strokeStyle = "#aaa";
    context.lineWidth = 2;
    context.strokeRect(inputX, inputY, inputW, inputH);

    // Typed name text — left-aligned inside the input box
    context.fillStyle = "white";
    context.font = "bold 24px 'Courier New', Courier, monospace";
    context.textAlign = "left";

    let cursorX = inputX + 8;
    if (playerNameBuffer) {
        context.fillText(playerNameBuffer, cursorX, inputY + 28);
        let inputTextWidth = context.measureText(playerNameBuffer).width;
        cursorX += inputTextWidth;
    }

    // Blinking cursor — right after last character
    let showCursor = Math.floor(Date.now() / 500) % 2 === 0;
    if (showCursor && playerNameBuffer.length < MAX_NAME_LEN) {
        context.fillStyle = "#fff";
        context.fillRect(cursorX, inputY + 6, 2, inputH - 12);
    }

    // Hint text — allowed characters (centered below input box)
    context.textAlign = "center";
    context.font = "14px 'Courier New', Courier, monospace";
    context.fillStyle = "#888";
    context.fillText(`Max ${MAX_NAME_LEN} chars | A-Z 0-9 _ -`, boardWidth / 2, inputY + inputH + 22);

    // Enter/Escape hint (centered at bottom)
    context.font = "14px 'Courier New', Courier, monospace";
    context.fillStyle = "#666";
    context.fillText("Enter to save | Escape to skip", boardWidth / 2, by + bh - 14);

    context.textAlign = "left";
}

/**
 * Handles keyboard input for the pixel-art name entry dialog.
 */
function handleNameDialogInput(e) {
    // Letters (A-Z), digits (0-9), and underscore
    if ((e.code >= "KeyA" && e.code <= "KeyZ") || (e.code >= "Digit0" && e.code <= "Digit9")) {
        if (playerNameBuffer.length < MAX_NAME_LEN) {
            playerNameBuffer += e.key.toUpperCase();
        }
        return;
    }

    // Underscore (_) and dash (-)
    if (e.key === "_" || e.key === "-") {
        if (playerNameBuffer.length < MAX_NAME_LEN) {
            playerNameBuffer += e.key;
        }
        return;
    }

    // Backspace: delete last character
    if (e.code === "Backspace") {
        playerNameBuffer = playerNameBuffer.slice(0, -1);
        return;
    }

    // Enter: submit score (capture name before clearing buffer)
    if (e.code === "Enter") {
        let name = playerNameBuffer.trim();
        playerNameBuffer = "";
        scoreSubmitted = true;
        submitScore(name);
        return;
    }

    // Escape: skip submission
    if (e.code === "Escape") {
        scoreSubmitted = true;
        playerNameBuffer = "";
        return;
    }
}

/**
 * Submits the current score to Firestore leaderboard.
 */
function submitScore(name) {
    if (!initFirebase()) return;
    name = (name || "").trim();
    if (!name) return;  // Skip empty names

    db.collection("leaderboard").add({
        name: name,
        score: Math.floor(score),
        mode: gameMode,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        console.log("Score submitted:", name, Math.floor(score));
    }).catch(err => {
        console.error("Failed to submit score:", err);
    });
}

// Touch input tracking for mobile tap detection
let touchStartTime = 0;
let touchEndTime = 0;
const TAP_THRESHOLD = 300;  // Maximum time in ms between touchstart and touchend to register as a tap

// Game sound effects and music
let wingSound = new Audio("./sounds/sfx_wing.wav");        // Sound when bird jumps
let collisionSound = new Audio("./sounds/sfx_hit.wav");    // Sound on collision
let backgroundMusic = new Audio("./sounds/bgm_mario.mp3");  // Background music track
backgroundMusic.loop = true;  // Loop music continuously during gameplay

// Pixel-perfect collision detection masks
let bertMasks = [];      // Array of bitmask arrays for each bird animation frame
let topPipeMask;         // Bitmask for top pipe image (transparency mask)
let bottomPipeMask;      // Bitmask for bottom pipe image (transparency mask)

let isFallbackActive = false;  // When true, fallback to AABB collision (CORS/file:// limitation)

/**
 * Generates a pixel-perfect collision mask from an image.
 * Reads the alpha channel of each pixel to determine transparency.
 * Falls back to solid mask (all pixels opaque) if CORS restrictions prevent access.
 */
function getMask(img, width, height) {
    try {
        let tempCanvas = document.createElement("canvas");
        tempCanvas.width = Math.floor(width);
        tempCanvas.height = Math.floor(height);
        let tempContext = tempCanvas.getContext("2d");
        tempContext.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        let imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        let mask = new Uint8Array(tempCanvas.width * tempCanvas.height);
        for (let i = 0; i < mask.length; i++) {
            // Store 1 for opaque pixels, 0 for transparent
            mask[i] = imageData[i * 4 + 3] > 0 ? 1 : 0;
        }
        return mask;
    } catch (e) {
        console.error("Could not generate mask (likely CORS or file:// issue):", e);
        isFallbackActive = true;
        // Return solid mask (all pixels treated as opaque) for fallback
        return new Uint8Array(Math.floor(width) * Math.floor(height)).fill(1);
    }
}

// Updates all bird collision masks when animation frames change or mode resets
function updateBertMasks() {
    bertMasks = bertImgs.map(img => getMask(img, bert.width, bert.height));
}




// Initialize game when page loads
window.onload = function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d");  // Get 2D drawing context for canvas

    let imagesLoaded = 0;
    let totalImages = 5;  // 2 bird frames + top pipe + bottom pipe + coin

    // Called when each image finishes loading (success or error)
    function checkAllImagesLoaded() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            updateBertMasks();
            topPipeMask = getMask(topPipeImg, pipeWidth, pipeHeight);
            bottomPipeMask = getMask(bottomPipeImg, pipeWidth, pipeHeight);

            requestAnimationFrame(update);  // Start game loop
            setInterval(placePipes, 1500);   // Spawn pipes every 1.5 seconds
            setInterval(placeCoins, 1000);   // Spawn coins every 1 second
            setInterval(animateBert, 100);   // Update bird animation every 100ms
        }
    }

    // Load bird animation frames (flappybert0.png, flappybert1.png)
    for (let i = 0; i < 2; i++) {
        let bertImg = new Image();
        bertImg.onload = checkAllImagesLoaded;
        bertImg.onerror = checkAllImagesLoaded;
        bertImg.src = `./img/bertAnimation/flappybert${i}.png`;
        bertImgs.push(bertImg);
    }

    // Load pipe images
    topPipeImg = new Image();
    topPipeImg.onload = checkAllImagesLoaded;
    topPipeImg.onerror = checkAllImagesLoaded;
    topPipeImg.src = "./img/top-lamp.png";

    bottomPipeImg = new Image();
    bottomPipeImg.onload = checkAllImagesLoaded;
    bottomPipeImg.onerror = checkAllImagesLoaded;
    bottomPipeImg.src = "./img/bottom-coffee-mug-tower.png";

    // Load coin image
    coinImg = new Image();
    coinImg.onload = checkAllImagesLoaded;
    coinImg.onerror = checkAllImagesLoaded;
    coinImg.src = "./img/bert_buck.png";

    // Leaderboard: get table reference; Firestore will populate it if configured
    table = document.getElementById("leaderboard");
    try { initFirebase(); } catch(err) { console.warn("Firebase init deferred:", err.message); }

    // Input event listeners
    document.addEventListener("keydown", jumpBert);  // Keyboard controls

    // Touch controls for mobile (tap detection)
    document.addEventListener("touchstart", touchStart);
    document.addEventListener("touchend", touchEnd);
};

// Draws a button with border and filled background for menu
function drawMenuButton(x, y, w, h, text, textColor, bgColor) {
    // Outer white border
    context.fillStyle = "white";
    context.fillRect(x, y, w, h);

    // Inner colored box
    context.fillStyle = bgColor;
    context.fillRect(x + 4, y + 4, w - 8, h - 8);

    // Centered text label
    context.fillStyle = textColor;
    context.font = "bold 25px 'Courier New', Courier, monospace";
    context.textAlign = "center";
    context.fillText(text, x + w / 2, y + h / 2 + 10);
}


/**
 * Main game loop - updates and renders all game elements.
 * Runs at fixed 60fps using setTimeout for consistent physics regardless of display refresh rate.
 */
function update() {
    // Schedule next frame FIRST so menu and game-over screens keep updating
    setTimeout(update, 16);

    // Show welcome screen before game starts
    if (!gameStarted) {
        context.clearRect(0, 0, board.width, board.height);

        // Dark overlay background
        context.fillStyle = "rgba(0, 0, 0, 0.4)";
        context.fillRect(0, 0, boardWidth, boardHeight);

        // Draw "FLAPPY BERT" title with shadow effect
        context.font = "bold 60px 'Courier New', Courier, monospace";
        context.textAlign = "center";

        context.fillStyle = "#000000";  // Shadow layer
        context.fillText("FLAPPY BERT", boardWidth / 2 + 4, 104);

        context.fillStyle = "aqua";  // Main title
        context.fillText("FLAPPY BERT", boardWidth / 2, 100);

        // Mode selection menu buttons
        let startY = 160;
        let spacing = 65;
        drawMenuButton(boardWidth / 2 - 250, startY, 500, 50, "1: CLASSIC", "white", "#000000");
        drawMenuButton(boardWidth / 2 - 250, startY + spacing, 500, 50, "2: BAD LUCK", "white", "#000000");
        drawMenuButton(boardWidth / 2 - 250, startY + spacing * 2, 500, 50, "3: TURBO (SPEED)", "white", "#000000");
        drawMenuButton(boardWidth / 2 - 250, startY + spacing * 3, 500, 50, "4: NIGHT (VISION)", "white", "#000000");
        drawMenuButton(boardWidth / 2 - 250, startY + spacing * 4, 500, 50, "5: GIANT BERT", "white", "#000000");
        drawMenuButton(boardWidth / 2 - 250, startY + spacing * 5, 500, 50, "6: ZEN (COINS)", "white", "#000000");

        context.font = "18px 'Courier New', Courier, monospace";
        context.fillStyle = "palegoldenrod";
        context.fillText("CHOOSE YOUR CHALLENGE", boardWidth / 2, 570);

        context.textAlign = "left";  // Reset alignment
        return;
    }

    // Skip all physics and rendering during game over (handled below)
    if (!gameOver) {

        // Turbo mode: increase speed each frame
    if (gameMode === "turbo") {
        velocityX -= 0.001;
    }

    // Clear previous frame and apply gravity
    context.clearRect(0, 0, board.width, board.height);
    velocityY += gravity;
    bert.y = Math.max(bert.y + velocityY, -40);
    context.drawImage(bertImgs[bertImgsIndex], bert.x, bert.y, bert.width, bert.height);

    // Debug border around bird
    if (isBordersOn) {
        context.strokeStyle = 'blue';
        context.lineWidth = 2;
        context.strokeRect(bert.x, bert.y, bert.width, bert.height);
    }

    // Game over conditions: hit bottom, too high (non-zen), or score < -20
    if (bert.y > boardHeight || (bert.y < -30 && gameMode !== "zen")) {
        gameOver = true;
    } else if (score < -20) {
        gameOver = true;
    }

    // Update and draw pipes
    for (let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];

        pipe.x += velocityX;

        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);

        // Debug border around pipes
        if (isBordersOn) {
            context.strokeStyle = 'red';
            context.lineWidth = 2;
            context.strokeRect(pipe.x, pipe.y, pipe.width, pipe.height);
        }

        // Increment score when bird passes pipe center
        if (!pipe.passed && bert.x > pipe.x + pipe.width) {
            score += 0.5;
            pipe.passed = true;
            pipeCrossed += 0.5;
        }

        // End game on collision (not in zen mode)
        if (gameMode !== "zen" && detectCollision(bert, pipe)) {
            collisionSound.play();
            gameOver = true;
        }
    }

    // Update and draw coins
    for (let i = 0; i < coinArray.length; i++) {
        let coinObj = coinArray[i];
        coinObj.x += velocityX;

        if (!coinObj.collected) {
            // Spin animation using sine wave
            let spinTime = Date.now() / 150;
            let spinScale = Math.sin(spinTime);
            let drawWidth = coinObj.width * Math.abs(spinScale);
            let drawX = coinObj.x + (coinObj.width - drawWidth) / 2;

            context.drawImage(coinImg, drawX, coinObj.y, drawWidth, coinObj.height);

            // AABB collision with coin
            if (bert.x < coinObj.x + coinObj.width &&
                bert.x + bert.width > coinObj.x &&
                bert.y < coinObj.y + coinObj.height &&
                bert.y + bert.height > coinObj.y) {

                coinObj.collected = true;
                score += 1;
            }
        }
    }

    // Remove off-screen coins and pipes
    while (coinArray.length > 0 && coinArray[0].x < -100) {
        coinArray.shift();
    }

    while (pipeArray.length > 0 && pipeArray[0].x < -pipeWidth) {
        pipeArray.shift();
    }

    // Night mode: flashlight effect revealing bird
    if (gameMode === "night") {
        context.save();
        context.globalCompositeOperation = 'destination-in';
        let gradient = context.createRadialGradient(
            bert.x + bert.width / 2, bert.y + bert.height / 2, 60,
            bert.x + bert.width / 2, bert.y + bert.height / 2, 220
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, boardWidth, boardHeight);
        context.restore();

        // Darken everything else
        context.save();
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = "rgba(0, 0, 0, 0.9)";
        context.fillRect(0, 0, boardWidth, boardHeight);
        context.restore();
    }

    // Draw score display (coin icon + number)
    context.drawImage(coinImg, 10, 10, 80, 80);

    context.fillStyle = "white";
    context.font = "bold 50px sans-serif";
    context.textAlign = "left";
    context.fillText(Math.floor(score), 100, 65);

    // Draw pipes passed counter (not in zen mode)
    if (gameMode !== "zen") {
        context.font = "30px sans-serif";
        context.fillText(`Passed: ${Math.floor(pipeCrossed)}`, 15, 120);
    }

    // Mode-specific HUD
    if (gameMode === "badluck") {
        context.font = "35px sans-serif";
        context.fillText(`Luck: ${badEndCounter}%`, 805, 63);
        context.fillStyle = "white";
        context.font = "24px sans-serif";
        context.fillText(`Bad Luck: ${badEndStr}`, 10, 630);
    }

    if (gameMode === "turbo") {
        context.font = "20px sans-serif";
        context.fillText(`Speed: ${Math.abs(velocityX).toFixed(2)}`, 105, 90);
    }

    // Fallback collision warning
    if (isFallbackActive) {
        context.fillStyle = "red";
        context.font = "20px sans-serif";
        context.fillText("Note: Using box collision (CORS/File limit)", 10, 600);
    }

    } // end if (!gameOver)

    // Game over rendering — redraws entire screen each frame so dialog updates with typed name
    if (gameOver) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;

        context.clearRect(0, 0, board.width, board.height);

        context.fillStyle = "white";
        context.font = "bold 60px sans-serif";
        context.fillText("GAME OVER", boardWidth / 2 - 120, 100);

        // Check if score qualifies for leaderboard (beats at least one top 5 score)
        const currentScore = Math.floor(score);
        const qualifiesForLeaderboard = db === null || lowestTop5Score === -Infinity || currentScore > lowestTop5Score;

        // If score doesn't qualify, skip name entry entirely so R/M keys work
        if (!qualifiesForLeaderboard) {
            scoreSubmitted = true;
        }

        if (!scoreSubmitted && qualifiesForLeaderboard) {
            drawNameDialog();
        } else {
            // Show instructions or message about score not qualifying
            context.font = "bold 24px 'Courier New', Courier, monospace";
            context.fillStyle = "#aaa";
            context.textAlign = "center";

            if (scoreSubmitted) {
                context.fillText("Press R to play again | M for menu", boardWidth / 2, 160);
            } else {
                context.fillStyle = "#f88";
                context.font = "bold 20px 'Courier New', Courier, monospace";
                context.fillText(`Score ${currentScore} didn't make the top 5!`, boardWidth / 2, 155);
                if (lowestTop5Score !== -Infinity) {
                    context.fillStyle = "#aaa";
                    context.font = "bold 24px 'Courier New', Courier, monospace";
                    context.fillText(`You need ${Math.floor(lowestTop5Score) + 1} or more to qualify.`, boardWidth / 2, 180);
                } else {
                    context.fillStyle = "#aaa";
                    context.font = "bold 24px 'Courier New', Courier, monospace";
                    context.fillText("Press R to play again | M for menu", boardWidth / 2, 180);
                }
            }

            context.textAlign = "left";
        }

    } // end if (gameOver)
}

// Cycle through bird animation frames (0, 1, 0, 1...)
function animateBert() {
    bertImgsIndex++;
    bertImgsIndex %= bertImgs.length;  // Modulo cycles between 0 and 1
}


/**
 * Spawns a new pair of pipes (top and bottom) with randomized vertical position.
 * Called by setInterval every 1.5 seconds during active gameplay.
 */
function placePipes() {
    if (gameOver || gameMode === "zen") {
        return;  // Don't spawn in zen mode or after game over
    }

    let randomPipeY = pipeY - pipeHeight/4 - (Math.random() * pipeHeight / 2);
    let openingSpace = board.height/4;  // Vertical gap between pipes

    let topPipe = {
        img: topPipeImg,
        x: pipeX,
        y: randomPipeY,
        width: pipeWidth,
        height: pipeHeight,
        passed: false
    };

    pipeArray.push(topPipe);

    if (isNoGapInPipes) {
        openingSpace = 1;  // No gap for badluck mode effect
    }

    let bottomPipe = {
        img: bottomPipeImg,
        x: pipeX,
        y: randomPipeY + pipeHeight + openingSpace,
        width: pipeWidth,
        height: pipeHeight,
        passed: false
    };

    pipeArray.push(bottomPipe);
}

/**
 * Spawns a coin at random vertical position.
 * Called by setInterval every 1 second.
 * Only active in "zen" and "classic" modes with 60% spawn rate in classic.
 */
function placeCoins() {
    if (gameOver) return;

    // Coins only spawn in zen and classic modes
    if (gameMode !== "zen" && gameMode !== "classic") return;

    // Reduced frequency in classic mode (40% skip = 60% spawn rate)
    if (gameMode === "classic" && Math.random() < 0.4) return;

    let randomCoinY = getRandomIntInclusive(100, boardHeight - 100);
    let newCoin = {
        x: boardWidth,
        y: randomCoinY,
        width: 60,   // Coin display size
        height: 60,
        collected: false
    };
    coinArray.push(newCoin);
}

/**
 * Handles keyboard input for game controls.
 */
function jumpBert(e) {
    // Game over name dialog — consume ALL keys only if score qualifies for leaderboard and hasn't been submitted yet
    if (gameOver && !scoreSubmitted) {
        const currentScore = Math.floor(score);
        const qualifiesForLeaderboard = db === null || lowestTop5Score === -Infinity || currentScore > lowestTop5Score;
        if (!qualifiesForLeaderboard) {
            scoreSubmitted = true;  // Skip name entry, let R/M keys through
        } else {
            return handleNameDialogInput(e);
        }
    }

    // Mode selection before game starts
    if (!gameStarted) {
        if (e.code === "Digit1" || e.code === "Numpad1") {
            gameMode = "classic";
            gameStarted = true;
            resetGame();
        } else if (e.code === "Digit2" || e.code === "Numpad2") {
            gameMode = "badluck";
            gameStarted = true;
            resetGame();
        } else if (e.code === "Digit3" || e.code === "Numpad3") {
            gameMode = "turbo";
            gameStarted = true;
            resetGame();
        } else if (e.code === "Digit4" || e.code === "Numpad4") {
            gameMode = "night";
            gameStarted = true;
            resetGame();
        } else if (e.code === "Digit5" || e.code === "Numpad5") {
            gameMode = "giant";
            gameStarted = true;
            resetGame();
        } else if (e.code === "Digit6" || e.code === "Numpad6") {
            gameMode = "zen";
            gameStarted = true;
            resetGame();
        }
        return;
    }

    // Jump controls
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyX") {
        if (!gameOver) {
            jumpLogic();
        }
    }

    // Reset game after death
    if (e.code === "KeyR") {
        if (gameOver) {
            resetGame();
        }
    }

    // Return to main menu
    if (e.code === "KeyM") {
        gameStarted = false;
        gameOver = false;
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        score = 0;
        pipeArray = [];
        bert.y = bertY;
        velocityY = 0;
        playerNameBuffer = "";
    }

    // Toggle debug borders
    if (e.code === "KeyB") {
        if (!gameOver) {
            isBordersOn = !isBordersOn;
        }
    }

}

/**
 * Detects collision between bird and pipe using pixel-perfect masking.
 * First performs AABB bounding box check for early exit, then checks
 * overlapping pixels for true transparency overlap.
 */
function detectCollision(bertRect, pipeRect) {
    // 1. AABB (Axis-Aligned Bounding Box) check - fast rejection
    let overlap = bertRect.x < pipeRect.x + pipeRect.width &&
                  bertRect.x + bertRect.width > pipeRect.x &&
                  bertRect.y < pipeRect.y + pipeRect.height &&
                  bertRect.y + bertRect.height > pipeRect.y;

    if (!overlap) return false;

    // 2. Pixel-perfect collision using masks
    let bertMask = bertMasks[bertImgsIndex];
    let pipeMask = (pipeRect.img === topPipeImg) ? topPipeMask : bottomPipeMask;

    if (!bertMask || !pipeMask) return true;  // Fallback: assume collision

    // Find overlapping rectangle
    let xOverlap = Math.max(bertRect.x, pipeRect.x);
    let yOverlap = Math.max(bertRect.y, pipeRect.y);
    let wOverlap = Math.min(bertRect.x + bertRect.width, pipeRect.x + pipeRect.width) - xOverlap;
    let hOverlap = Math.min(bertRect.y + bertRect.height, pipeRect.y + pipeRect.height) - yOverlap;

    // Check each pixel in overlap region
    for (let y = 0; y < hOverlap; y++) {
        for (let x = 0; x < wOverlap; x++) {
            let bX = Math.floor(xOverlap + x - bertRect.x);
            let bY = Math.floor(yOverlap + y - bertRect.y);
            let pX = Math.floor(xOverlap + x - pipeRect.x);
            let pY = Math.floor(yOverlap + y - pipeRect.y);

            // Collision if both pixels are non-transparent
            if (bertMask[bY * Math.floor(bertRect.width) + bX] && 
                pipeMask[pY * Math.floor(pipeRect.width) + pX]) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Returns a random integer between min and max (inclusive).
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer in range [min, max]
 */
function getRandomIntInclusive(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1)) + minCeiled;
}

// Resize canvas when window changes (currently disabled - uncomment to enable)
/*
function resizeCanvas() {
    let boardCanvas = context.getImageData(0, 0, boardWidth, boardHeight);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.putImageData(boardCanvas, 0, 0);
}
*/

/**
 * Resets game state for a new round or after game over.
 */
function resetGame() {

    // Start background music if not playing
    if (backgroundMusic.paused) {
        backgroundMusic.play();
    }
    wingSound.play();  // Play jump sound

    velocityY = -6;  // Initial upward velocity for first jump

    bert.y = bertY;
    pipeArray = [];
    coinArray = [];
    score = 0;
    gameOver = false;
    scoreSubmitted = false;
    playerNameBuffer = "";
    // Badluck mode: generate random luck counter (1-100)
    badEndCounter = (gameMode === "badluck") ? getRandomIntInclusive(1, 100) : 100;

    // Reset physics and gameplay settings
    gravity = 0.4;
    velocityX = baseVelocityX;
    isNoGapInPipes = false;
    pipeCrossed = 0;
    isBadEnd = false;
    badEnd = 0;
    badEndStr = "";

    // Giant mode: double bird size
    if (gameMode === "giant") {
        bert.height = 100;
        bert.width = 100;
    } else {
        bert.height = 50;
        bert.width = 50;
    }

    updateBertMasks();
}

/**
 * Handles touch start event for mobile tap detection.
 * Begins game in classic mode if not yet started.
 */
function touchStart(event) {
    if (!gameStarted) {
        gameMode = "classic";
        gameStarted = true;
        resetGame();
        return;
    }
    touchStartTime = new Date().getTime();  // Record start time
    event.preventDefault();  // Prevent scrolling/zooming
}

/**
 * Handles touch end event for mobile tap detection.
 * Triggers jump if touch duration is below TAP_THRESHOLD (300ms).
 */
function touchEnd(event) {
    if (!gameStarted) return;
    touchEndTime = new Date().getTime();

    const touchDuration = touchEndTime - touchStartTime;

    // Register as tap if duration < 300ms
    if (touchDuration <= TAP_THRESHOLD) {
        jumpLogic();
    }

    event.preventDefault();
}


/**
 * Implements jump logic for bird and handles game mode effects.
 * Called on key press (space/arrowUp/X) or mobile tap.
 */
function jumpLogic() {
    // Ensure music is playing
    if (backgroundMusic.paused) {
        backgroundMusic.play();
    }
    wingSound.play();  // Play sound effect

    velocityY = -6;  // Apply upward impulse

    // Reset game if over
    if (gameOver) {
        resetGame();
    } else if (gameMode === "badluck") {
        badEndCounter -= 1;  // Reduce luck counter each jump
    }

    // Trigger bad ending if luck runs out
    if (gameMode === "badluck" && badEndCounter < 1 && !isBadEnd) {
        badEnd = getRandomIntInclusive(1, 5);
        isBadEnd = true;
    }

    // Apply selected bad ending effect
    if (isBadEnd && gameMode === "badluck") {
        switch(badEnd) {
            case 1:
                gravity = 0;           // No gravity
                badEndStr = "No gravity";
                break;
            case 2:
                velocityY = 10;        // Can't jump (falling fast)
                badEndStr = "Can't jump";
                break;
            case 3:
                isNoGapInPipes = true; // No space between pipes
                badEndStr = "No gap";
                break;
            case 4:
                score -= 2;            // Negative score penalty
                badEndStr = "Score -2";
                break;
            case 5:
                let newSize = getRandomIntInclusive(45, 100);
                bert.height = newSize;
                bert.width = newSize;
                updateBertMasks();
                badEndStr = "Random size";
                break;
        }
    }
}
