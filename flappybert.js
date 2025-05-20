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
let velocityX = -2; //pipes moving left speed
let velocityY = 0;  //bert jump speed
let gravity = 0.4;  // gravity

// Game Variables
let gameOver = false;
let score = 0;
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

// Game Sounds
let wingSound = new Audio("./sounds/sfx_wing.wav");
let collisionSound = new Audio("./sounds/sfx_hit.wav");
let backgroundMusic = new Audio("./sounds/bgm_mario.mp3");
backgroundMusic.loop = true; //play music on repeat




window.onload = function() {
    board = document.getElementById("board");
    board.height = boardHeight;
    board.width = boardWidth;
    context = board.getContext("2d"); //used for drawing on the board

    //load bert img animation
    for (let i = 0; i < 2; i++) {  //2 is the total number of imgs used in the animation
        let bertImg = new Image();
        bertImg.src = `./img/bertAnimation/flappybert${i}.png`;
        //bertImg.style.border("5px solid red");
        bertImgs.push(bertImg);
    }
    
    //load images
    topPipeImg = new Image();
    topPipeImg.src = "./img/top-lamp.png";
    //topPipeImg.style.border = '2px solid black';
    bottomPipeImg = new Image();
    bottomPipeImg.src = "./img/bottom-coffee-mug-tower.png";   
    //bottomPipeImg.style.border = '5px solid black'; 
    coinImg = new Image();
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

    requestAnimationFrame(update);
    // create pipes on board ever 1.5 secs
    setInterval(placePipes, 1500);
    //set bert animation to be 1/10 of a sec
    setInterval(animateBert, 100);
    // event listener for jumping using key
    document.addEventListener("keydown", jumpBert);
    // Resize canvas when the window is resized
    //window.addEventListener('resize', resizeCanvas);

    document.addEventListener("touchstart", touchStart);
    document.addEventListener('touchend', touchEnd);

}

//update the animation
function update() {
    requestAnimationFrame(update);
    //Stop updating screen if its game over
    if (gameOver) {
        return;
    }

    //clear previous frame
    context.clearRect(0, 0, board.width, board.height);

    //draw bert
    velocityY += gravity; //implement gravity
    // bert.y += velocityY;  no limit for the canvas when jumping
    bert.y = Math.max(bert.y + velocityY, -40); //apply gravity to current bert.y, limit the bert.y top of the canvas
    context.drawImage(bertImgs[bertImgsIndex], bert.x, bert.y, bert.width, bert.height);
    // Add a border around the BERT image
    if (isBordersOn) {
        context.strokeStyle = 'blue';  // Border color
        context.lineWidth = 2;        // Border thickness
        context.strokeRect(bert.x, bert.y, bert.width, bert.height); // Draw rectangle around image
    }
        

    // if bert goes under or above the canvas's height , its game over
    if (bert.y > boardHeight || bert.y < -30) {
        gameOver = true;
    } else if (score < -20) {
        gameOver = true;
    }

    //draw pipes
    for (let i = 0; i < pipeArray.length; i++) {
        let pipe = pipeArray[i];
         
        pipe.x += velocityX;

        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);
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
        if (detectCollision(bert, pipe)) {
            collisionSound.play();
            gameOver = true;
        }
    }

    //clear pipes passed that are off the canvas
    while (pipeArray.length > 0 && pipeArray[0].x < - pipeWidth) {
        pipeArray.shift(); //removes first element from the array
    }

    //draw Score
    context.fillStyle = "white";  //font color
    context.font = "45px sans-serif"; //font size and type
    context.fillText(score, 105, 63); //variable with text, position on canvas x, y    
    context.fillText(`Luck ${badEndCounter}%`, 805, 63); //variable with text, position on canvas x, y
    context.fillText(`Passed: ${pipeCrossed}`, 805, 105); //variable with text, position on canvas x, y
    context.fillText(`Bad Luck: ${badEndStr}`, 10, 630); //variable with text, position on canvas x, y
    

    // draw coin
    context.drawImage(coinImg, coin.x, coin.y, coin.width, coin.height);
    
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
    //Stop if its game over
    if (gameOver) {
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

// param e , is the key press event
function jumpBert(e) {

    //key press is space or arrowUp or "X"
    if (e.code == "Space" || e.code == "ArrowUp" || e.code == "KeyX") {
        
        if (!gameOver) {
            jumpLogic();
        }
     }

     if (e.code == "KeyR") {
        
        if (gameOver) {
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
            score = 0;
            gameOver = false;
            badEndCounter = getRandomIntInclusive(1, 100);;
            //isBordersOn = false;
            // game original settings
            gravity = 0.4;
            velocityY = -6;
            isNoGapInPipes = false;
            pipeCrossed = 0;
            isBadEnd = false;
            badEnd = 0;
            badEndStr = "";
            bert.height = 50;
            bert.width = 50;

        }
                
    }

    if ( e.code == "KeyB") {        
        if (!gameOver) {
            isBordersOn = isBordersOn ? false : true;
        }
     }

    
}

//create 2 rectangles comparing the positions and detecting the collision between the bert and the pipe
function detectCollision(bertRect, pipeRect) {
    return bertRect.x < pipeRect.x + pipeRect.width &&
           bertRect.x + bertRect.width > pipeRect.x &&
           bertRect.y < pipeRect.y + pipeRect.height &&
           bertRect.y + bertRect.height > pipeRect.y;
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

function touchStart(event) {
    touchStartTime = new Date().getTime(); // Store the time when touch starts
    event.preventDefault(); // Prevent default behavior (like scrolling)
}

function touchEnd(event) {
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
            bert.y = bertY;
            pipeArray = [];
            score = 0;
            gameOver = false;
            badEndCounter = getRandomIntInclusive(1, 100);;
            // game original settings
            gravity = 0.4;
            velocityY = -6;
            isNoGapInPipes = false;
            pipeCrossed = 0;
            isBadEnd = false;
            badEnd = 0;
            badEndStr = "";
            bert.height = 50;
            bert.width = 50;
        } else {
            badEndCounter -= 1;
        }


        // ran out of luck, randomly select bad ending
        if (badEndCounter < 1 && !isBadEnd) {
            badEnd = getRandomIntInclusive(1,5);
            isBadEnd = true;
        }

        if (isBadEnd) {

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
                    badEndStr = "Random size.";
                    break;
            }
        }
}
