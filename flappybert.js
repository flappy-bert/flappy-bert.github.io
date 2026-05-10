// Board
let board;  //, background img is set in css file
let boardWidth = 1080; //pixels
let boardHeight = 640;
let context; //used for drawing in the canvas

// Bird / bert
let bertWidth = 50;
let bertHeight = 50;
let bertX = boardWidth / 8;
let bertY = boardHeight / 2;

let bertImgs = [];
let bertImgsIndex = 0;

let bert = {
    x : bertX,
    y : bertY,
    width : bertWidth,
    height : bertHeight
}

//pipes  
let pipeArray = [];
let pipeWidth = 64; //pixels - pipe ratio   width/height 384/3072  equivalent to 1/8
let pipeHeight = 512; 
let pipeX = boardWidth;
let pipeY = 0;

let topPipeImg;
let bottomPipeImg;

// coin
let coinWidth = 80;
let coinHeight = 80;
let coinImg;

let coin = {
    x : 10,
    y : 5,
    width : coinWidth,
    height : coinHeight
}

// Game physics
let baseVelocityX = -2; //pipes moving left speed
let velocityX = -2; 
let velocityY = 0;  //bert jump speed
let gravity = 0.4;  // gravity

// Game Variables
let gameOver = false;
let gameStarted = false;
let gameMode = ""; // "classic", "badluck", "turbo", "night", "giant", "zen"
let score = 0;
let coinArray = [];
let badEndCounter = 10; //after this reaches 0, a bad end happens
let isNoGapInPipes = false;  // no space between pipes
let pipeCrossed = 0;
let isBadEnd = false;
let badEnd = 0;
let badEndStr = "";
let isBordersOn = false;
let table;
let tableData = [];

let touchStartTime = 0;
let touchEndTime = 0;
const TAP_THRESHOLD = 300; // Max time in ms between touchstart and touchend to be considered a tap

// Game sounds
let wingSound = new Audio("./sounds/sfx_wing.wav");
let collisionSound = new Audio("./sounds/sfx_hit.wav");
let backgroundMusic = new Audio("./sounds/bgm_mario.mp3");
backgroundMusic.loop = true; //play music on repeat

// Hitbox Masks
let bertMasks = [];
let topPipeMask;
let bottomPipeMask;
let isMaskVisible = false;
let isFallbackActive = false;

function getMask(img, width, height) {
    try {
        let tempCanvas = document.createElement("canvas");
        tempCanvas.width = Math.floor(width);
        tempCanvas.height = Math.floor(height);
        let tempContext = tempCanvas.getContext("2d");
        tempContext.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        let imageData = tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        let mask = new Uint8Array(tempCanvas.width * tempCanvas.height);
        let hasTransparent = false;
        for (let i = 0; i < mask.length; i++) {
            mask[i] = imageData[i * 4 + 3] > 0 ? 1 : 0;
            if (mask[i] === 0) hasTransparent = true;
        }
        // If the entire image is solid or we couldn't read transparency, it might be a silent failure or just a solid sprite
        return mask;
    } catch (e) {
        console.error("Could not generate mask (likely CORS or file:// issue):", e);
        isFallbackActive = true;
        // Return a solid mask as fallback (effectively box collision)
        return new Uint8Array(Math.floor(width) * Math.floor(height)).fill(1);
    }
}

function updateBertMasks() {
    bertMasks = bertImgs.map(img => getMask(img, bert.width, bert.height));
}




window.onload = function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d"); //used for drawing on the board

    let imagesLoaded = 0;
    let totalImages = 5; // 2 bert imgs, topPipe, bottomPipe, coin

    function checkAllImagesLoaded() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            updateBertMasks();
            topPipeMask = getMask(topPipeImg, pipeWidth, pipeHeight);
            bottomPipeMask = getMask(bottomPipeImg, pipeWidth, pipeHeight);

            requestAnimationFrame(update);
            // create pipes on board ever 1.5 secs
            setInterval(placePipes, 1500);
            // create coins every 1 sec
            setInterval(placeCoins, 1000);
            //set bert animation to be 1/10 of a sec
            setInterval(animateBert, 100);
        }
    }

    //load bert img animation
    for (let i = 0; i < 2; i++) {  //2 is the total number of imgs used in the animation
        let bertImg = new Image();
        bertImg.onload = checkAllImagesLoaded;
        bertImg.onerror = checkAllImagesLoaded;
        bertImg.src = `./img/bertAnimation/flappybert${i}.png`;
        bertImgs.push(bertImg);
    }
    
    //load images
    topPipeImg = new Image();
    topPipeImg.onload = checkAllImagesLoaded;
    topPipeImg.onerror = checkAllImagesLoaded;
    topPipeImg.src = "./img/top-lamp.png";

    bottomPipeImg = new Image();
    bottomPipeImg.onload = checkAllImagesLoaded;
    bottomPipeImg.onerror = checkAllImagesLoaded;
    bottomPipeImg.src = "./img/bottom-coffee-mug-tower.png";   

    coinImg = new Image();
    coinImg.onload = checkAllImagesLoaded;
    coinImg.onerror = checkAllImagesLoaded;
    coinImg.src = "./img/bert_buck.png";
    
    // Game LeaderBoards
    table = document.getElementById("leaderboard");
    tableData = [];

    // Skip the first row if it's the header
    console.log(tableData);
    const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.innerText.trim());
    const rows = table.querySelectorAll("tbody tr");

    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const rowData = {};

        cells.forEach((cell, index) => {
            const key = headers[index].toLowerCase(); // e.g., "Name" → "name"
            let value = cell.innerText.trim();
            //rowData[key] = cell.innerText.trim();

            //convert string score to int
            if (key == "score" || key == "rank") {
                value = Number(value);
            }

            rowData[key] = value;
            
        });
        
        tableData.push(rowData);
        
    });

    
    //}

    console.log(tableData);

    // event listener for jumping using key
    document.addEventListener("keydown", jumpBert);
    // Resize canvas when the window is resized
    //window.addEventListener('resize', resizeCanvas);

    document.addEventListener("touchstart", touchStart);
    document.addEventListener('touchend', touchEnd);

}

function drawMenuButton(x, y, w, h, text, textColor, bgColor) {
    // Outer border
    context.fillStyle = "white";
    context.fillRect(x, y, w, h);
    
    // Inner box
    context.fillStyle = bgColor;
    context.fillRect(x + 4, y + 4, w - 8, h - 8);
    
    // Text
    context.fillStyle = textColor;
    context.font = "bold 25px 'Courier New', Courier, monospace";
    context.textAlign = "center";
    context.fillText(text, x + w / 2, y + h / 2 + 10);
}

function drawMask(mask, x, y, width, height, color) {
    if (!mask) return;
    context.fillStyle = color;
    let mw = Math.floor(width);
    let mh = Math.floor(height);
    // Optimization: Draw in chunks or only every few pixels if performance is an issue,
    // but for debugging 50x50 or 64x512 it should be okay if not done for every pipe simultaneously
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
            let mx = i % mw;
            let my = Math.floor(i / mw);
            context.fillRect(x + mx, y + my, 1, 1);
        }
    }
}

//update the animation
function update() {
    requestAnimationFrame(update);

    // Draw Welcome Screen
    if (!gameStarted) {
        // ... (welcome screen code)
        context.clearRect(0, 0, board.width, board.height);
        
        // Draw background shadow/overlay
        context.fillStyle = "rgba(0, 0, 0, 0.4)";
        context.fillRect(0, 0, boardWidth, boardHeight);

        // Title with "Pixel" shadow
        context.font = "bold 60px 'Courier New', Courier, monospace";
        context.textAlign = "center";
        
        // Shadow layer
        context.fillStyle = "#000000";
        context.fillText("FLAPPY BERT", boardWidth / 2 + 4, 104);
        
        // Main Title layer
        context.fillStyle = "aqua";
        context.fillText("FLAPPY BERT", boardWidth / 2, 100);
        
        // Mode Selection Grid (smaller buttons to fit)
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
        
        context.textAlign = "left"; // Reset for other text
        return;
    }

    //Stop updating screen if its game over
    if (gameOver) {
        return;
    }

    // Turbo Mode Speed Increment
    if (gameMode === "turbo") {
        velocityX -= 0.001;
    }

    //clear previous frame
    context.clearRect(0, 0, board.width, board.height);

    //draw bert
    velocityY += gravity; //implement gravity
    // bert.y += velocityY;  no limit for the canvas when jumping
    bert.y = Math.max(bert.y + velocityY, -40); //apply gravity to current bert.y, limit the bert.y top of the canvas
    context.drawImage(bertImgs[bertImgsIndex], bert.x, bert.y, bert.width, bert.height);
    
    // Draw Mask Visualization
    if (isMaskVisible) {
        drawMask(bertMasks[bertImgsIndex], bert.x, bert.y, bert.width, bert.height, "rgba(0, 255, 0, 0.5)");
    }

    // Add a border around the BERT image
    if (isBordersOn) {
        context.strokeStyle = 'blue';  // Border color
        context.lineWidth = 2;        // Border thickness
        context.strokeRect(bert.x, bert.y, bert.width, bert.height); // Draw rectangle around image
    }
        

    // if bert goes under or above the canvas's height , its game over
    if (bert.y > boardHeight || (bert.y < -30 && gameMode !== "zen")) {
        gameOver = true;
    } else if (score < -20) {
        gameOver = true;
    }

    //draw pipes
    for (let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];
         
        pipe.x += velocityX;

        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);
        
        // Draw Mask Visualization
        if (isMaskVisible) {
            let pMask = (pipe.img === topPipeImg) ? topPipeMask : bottomPipeMask;
            drawMask(pMask, pipe.x, pipe.y, pipe.width, pipe.height, "rgba(0, 255, 0, 0.5)");
        }

        // Add a border around the PIPE image
        if (isBordersOn) {           
            context.strokeStyle = 'red';  // Border color
            context.lineWidth = 2;        // Border thickness
            context.strokeRect(pipe.x, pipe.y, pipe.width, pipe.height); // Draw rectangle around image 
        }
        


        //if bert passed the pipes, increase the score
        if (!pipe.passed && bert.x > pipe.x + pipe.width) {
            score += 0.5;  //since it passes 2 pipes at a time it would be 1 point per pass
            pipe.passed = true;
            pipeCrossed += 0.5;
        }

        //detect collision and end game
        if (gameMode !== "zen" && detectCollision(bert, pipe)) {
            collisionSound.play();
            gameOver = true;
        }
    }

    // Draw and handle Coins
    for (let i = 0; i < coinArray.length; i++) {
        let coinObj = coinArray[i];
        coinObj.x += velocityX;

        if (!coinObj.collected) {
            // Spin Animation: oscillate the width using sin
            let spinTime = Date.now() / 150;
            let spinScale = Math.sin(spinTime);
            let drawWidth = coinObj.width * Math.abs(spinScale);
            let drawX = coinObj.x + (coinObj.width - drawWidth) / 2;

            context.drawImage(coinImg, drawX, coinObj.y, drawWidth, coinObj.height);
            
            // Simple AABB for coins (doesn't need pixel-perfect)
            if (bert.x < coinObj.x + coinObj.width &&
                bert.x + bert.width > coinObj.x &&
                bert.y < coinObj.y + coinObj.height &&
                bert.y + bert.height > coinObj.y) {
                
                coinObj.collected = true;
                score += 1;
                // Add a sound if possible or just visual feedback
            }
        }
    }

    //clear coins off screen
    while (coinArray.length > 0 && coinArray[0].x < -100) {
        coinArray.shift();
    }

    //clear pipes passed that are off the canvas
    while (pipeArray.length > 0 && pipeArray[0].x < - pipeWidth) {
        pipeArray.shift(); //removes first element from the array
    }

    // Night Mode Flashlight Effect
    if (gameMode === "night") {
        context.save();
        context.globalCompositeOperation = 'destination-in';
        let gradient = context.createRadialGradient(
            bert.x + bert.width / 2, bert.y + bert.height / 2, 60,
            bert.x + bert.width / 2, bert.y + bert.height / 2, 220
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)'); // Allow a tiny bit of ambient light
        context.fillStyle = gradient;
        context.fillRect(0, 0, boardWidth, boardHeight);
        context.restore();

        // Dark background overlay for everything else
        context.save();
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = "rgba(0, 0, 0, 0.9)"; // 90% dark instead of 100%
        context.fillRect(0, 0, boardWidth, boardHeight);
        context.restore();
    }

    // draw coin icon for score
    context.drawImage(coinImg, 10, 10, 80, 80);
    
    //draw Score next to coin
    context.fillStyle = "white";  //font color
    context.font = "bold 50px sans-serif"; // Slightly larger and bold
    context.textAlign = "left";
    context.fillText(Math.floor(score), 100, 65); 

    // draw Passed counter
    if (gameMode !== "zen") {
        context.font = "30px sans-serif"; // Smaller font for passed
        context.fillText(`Passed: ${Math.floor(pipeCrossed)}`, 15, 120);
    }
    
    if (gameMode === "badluck") {
        context.font = "35px sans-serif";
        context.fillText(`Luck ${badEndCounter}%`, 805, 63); 
        context.fillText(`Bad Luck: ${badEndStr}`, 10, 630); 
    }
    
    if (gameMode === "turbo") {
        context.font = "20px sans-serif";
        context.fillText(`Speed: ${Math.abs(velocityX).toFixed(2)}`, 105, 90);
    }
    
    if (isFallbackActive) {
        context.fillStyle = "red";
        context.font = "20px sans-serif";
        context.fillText("Note: Using box collision (CORS/File limit)", 10, 600);
    }
    
    // game over message
    if (gameOver) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;  //reset music from the start
        context.fillText("GAME OVER", 360, 65); //variable with text, position on canvas x, y
    }
}

function animateBert() {
    bertImgsIndex++; //increment to next frame
    bertImgsIndex %= bertImgs.length; // circle back with modulus, max frame is 1
    // // 0 1 0 1 0 1....
}


function placePipes() {
    //Stop if its game over or Zen mode
    if (gameOver || gameMode === "zen") {
        return;
    }

    let randomPipeY = pipeY - pipeHeight/4 - (Math.random() * pipeHeight / 2);
    let openingSpace = board.height/4; //space between top and bottom pipes

    let topPipe = {
        img : topPipeImg,
        x : pipeX,
        y : randomPipeY,
        width : pipeWidth,
        height : pipeHeight,
        passed : false
    }

    pipeArray.push(topPipe);

    if (isNoGapInPipes) {
        openingSpace = 1;
    }

    let bottomPipe = {
        img : bottomPipeImg,
        x : pipeX,
        y : randomPipeY + pipeHeight + openingSpace,
        width : pipeWidth,
        height : pipeHeight,
        passed : false
    }

    pipeArray.push(bottomPipe);

}

function placeCoins() {
    if (gameOver) return;
    
    // Coins spawn in Zen and Classic modes
    if (gameMode !== "zen" && gameMode !== "classic") return;
    
    // Increased frequency for classic mode (was 0.7 skip)
    if (gameMode === "classic" && Math.random() < 0.4) return;

    let randomCoinY = getRandomIntInclusive(100, boardHeight - 100);
    let newCoin = {
        x: boardWidth,
        y: randomCoinY,
        width: 60,   // Increased from 40
        height: 60,  // Increased from 40
        collected: false
    };
    coinArray.push(newCoin);
}

// param e , is the key press event
function jumpBert(e) {

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

    //key press is space or arrowUp or "X"
    if (e.code == "Space" || e.code == "ArrowUp" || e.code == "KeyX") {
        
        if (!gameOver) {
            jumpLogic();
        }
     }

     if (e.code == "KeyR") {
        
        if (gameOver) {
            resetGame();
        }
                
    }

    if (e.code == "KeyM") {
        // Return to Menu
        gameStarted = false;
        gameOver = false;
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        // Reset basic stats so the screen looks clean if we go back
        score = 0;
        pipeArray = [];
        bert.y = bertY;
        velocityY = 0;
    }

    if ( e.code == "KeyB") {        
        if (!gameOver) {
            isBordersOn = isBordersOn ? false : true;
        }
     }

    if (e.code == "KeyV") {
        isMaskVisible = !isMaskVisible;
    }

    
}

//create 2 rectangles comparing the positions and detecting the collision between the bert and the pipe
function detectCollision(bertRect, pipeRect) {
    // 1. AABB (Axis-Aligned Bounding Box) check
    let overlap = bertRect.x < pipeRect.x + pipeRect.width &&
                  bertRect.x + bertRect.width > pipeRect.x &&
                  bertRect.y < pipeRect.y + pipeRect.height &&
                  bertRect.y + bertRect.height > pipeRect.y;

    if (!overlap) return false;

    // 2. Pixel-perfect collision check
    // Get the current mask for bert and the pipe
    let bertMask = bertMasks[bertImgsIndex];
    let pipeMask = (pipeRect.img === topPipeImg) ? topPipeMask : bottomPipeMask;

    // Fallback if masks aren't ready for some reason
    if (!bertMask || !pipeMask) return true;

    // Find the overlapping rectangle
    let xOverlap = Math.max(bertRect.x, pipeRect.x);
    let yOverlap = Math.max(bertRect.y, pipeRect.y);
    let wOverlap = Math.min(bertRect.x + bertRect.width, pipeRect.x + pipeRect.width) - xOverlap;
    let hOverlap = Math.min(bertRect.y + bertRect.height, pipeRect.y + pipeRect.height) - yOverlap;

    // Check pixels within the overlapping area
    for (let y = 0; y < hOverlap; y++) {
        for (let x = 0; x < wOverlap; x++) {
            // Calculate relative coordinates in both sprites
            let bX = Math.floor(xOverlap + x - bertRect.x);
            let bY = Math.floor(yOverlap + y - bertRect.y);
            let pX = Math.floor(xOverlap + x - pipeRect.x);
            let pY = Math.floor(yOverlap + y - pipeRect.y);

            // If both pixels are non-transparent, we have a collision
            if (bertMask[bY * Math.floor(bertRect.width) + bX] && 
                pipeMask[pY * Math.floor(pipeRect.width) + pX]) {
                return true;
            }
        }
    }

    return false;
}

function getRandomIntInclusive(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled); // The maximum is inclusive and the minimum is inclusive
}

 // Function to resize the canvas
 function resizeCanvas() {
    let boardCanvas = context.getImageData(0,0,boardWidth, boardHeight); //to grab the whole canvas
    canvas.width = window.innerWidth;  // Set canvas width to window's width
    canvas.height = window.innerHeight; // Set canvas height to window's height
    context.putImageData(boardCanvas, 0, 0); //to redraw it at the new scale.  // Redraw the content after resizing
}

function resetGame() {
    //Game music
    if (backgroundMusic.paused) {
        backgroundMusic.play();
    }
    // play sound
    wingSound.play();

    // jump
    velocityY = -6;

    bert.y = bertY;
    pipeArray = [];
    coinArray = [];
    score = 0;
    gameOver = false;
    badEndCounter = (gameMode === "badluck") ? getRandomIntInclusive(1, 100) : 100;
    
    // game original settings
    gravity = 0.4;
    velocityX = baseVelocityX;
    isNoGapInPipes = false;
    pipeCrossed = 0;
    isBadEnd = false;
    badEnd = 0;
    badEndStr = "";
    
    if (gameMode === "giant") {
        bert.height = 100;
        bert.width = 100;
    } else {
        bert.height = 50;
        bert.width = 50;
    }
    
    updateBertMasks();
}

function touchStart(event) {
    if (!gameStarted) {
        // For mobile, maybe just default to classic if they tap the screen
        gameMode = "classic";
        gameStarted = true;
        resetGame();
        return;
    }
    touchStartTime = new Date().getTime(); // Store the time when touch starts
    event.preventDefault(); // Prevent default behavior (like scrolling)
}

function touchEnd(event) {
    if (!gameStarted) return;
    touchEndTime = new Date().getTime(); // Store the time when touch ends

    const touchDuration = touchEndTime - touchStartTime;

    // If the touch duration is below the threshold (e.g., 300ms), consider it a tap
    if (touchDuration <= TAP_THRESHOLD) {
        console.log("Tap detected anywhere on the screen!");
        jumpLogic();
    }

    event.preventDefault(); // Prevent default behavior on touch end
}


function jumpLogic() {
    
        // Game music
        if (backgroundMusic.paused) {
            backgroundMusic.play();
        }
        
        // play sound
        wingSound.play();

        // jump
        velocityY = -6;

        // reset game
        if (gameOver) {
            resetGame();
        } else if (gameMode === "badluck") {
            badEndCounter -= 1;
        }


        // ran out of luck, randomly select bad ending
        if (gameMode === "badluck" && badEndCounter < 1 && !isBadEnd) {
            badEnd = getRandomIntInclusive(1,5);
            isBadEnd = true;
        }

        if (isBadEnd && gameMode === "badluck") {

            switch(badEnd) {
                case 1:
                    // no gravity
                    gravity = 0;
                    badEndStr = "No gravity.";
                    break;
                case 2:
                    // jumping doesnt work anymore
                    velocityY = 10;
                    badEndStr = "No jump.";
                    break;
                case 3:
                    // no space between pipes
                    isNoGapInPipes = true;
                    badEndStr = "No gap.";
                    break;
                case 4:
                    // negative score
                    score -= 2;
                    badEndStr = "Neg score.";
                    break;
                case 5:
                    // bert changes to random size
                    let newSize = getRandomIntInclusive(45, 100);
                    bert.height = newSize;
                    bert.width = newSize;
                    updateBertMasks();
                    badEndStr = "Random size.";
                    break;
            }
        }
}
