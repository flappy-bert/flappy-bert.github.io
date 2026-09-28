// =============================================================================
// Flappy Bert v0.3
// Canvas keeps a fixed 1080x640 internal resolution; CSS scales it to the screen.
// =============================================================================

// ---- Board ------------------------------------------------------------------
const boardWidth = 1080;
const boardHeight = 640;
let board, context;

// ---- Physics (per 60fps step — same numbers as v0.2 so the game feels the same)
const STEP_MS = 1000 / 60;      // one fixed physics step
const BASE_VELOCITY_X = -2;     // pipe/coin scroll speed
const BASE_GRAVITY = 0.4;
const JUMP_VELOCITY = -6;
const MAX_FALL = 12;            // terminal velocity so long drops stay readable
const PIPE_SPACING = 180;       // px between pipe pairs (= old 1.5s timer at speed 2)
const COIN_SPACING = 120;       // px between coin spawn attempts (= old 1s timer)

// ---- Sprites ----------------------------------------------------------------
const BERT_START_X = boardWidth / 8;
const BERT_START_Y = boardHeight / 2;
const PIPE_WIDTH = 64;
const PIPE_HEIGHT = 512;
const COIN_SIZE = 60;

const images = {};              // loaded Image objects
let bertImgs = [];
let bertFrame = 0;

let bert = { x: BERT_START_X, y: BERT_START_Y, width: 50, height: 50 };

// ---- Modes ------------------------------------------------------------------
// Adding a mode: add it here, then handle it wherever `gameMode` is checked.
const MODES = [
    { id: "classic", label: "CLASSIC",     tip: "Pipes, coins, glory." },
    { id: "badluck", label: "BAD LUCK",    tip: "Every flap spends luck. Run out and something breaks." },
    { id: "turbo",   label: "TURBO",       tip: "It only gets faster." },
    { id: "night",   label: "NIGHT",       tip: "Bring a flashlight. You have one." },
    { id: "giant",   label: "GIANT BERT",  tip: "Twice the Bert, same gaps." },
    { id: "zen",     label: "ZEN (COINS)", tip: "No pipes. Just coins." },
    { id: "wobble",  label: "WOBBLE",      tip: "The pipes won't hold still.", isNew: true },
    { id: "flip",    label: "FLIP",        tip: "Tapping flips gravity. Floor and ceiling both bite.", isNew: true },
];
const MODE_IDS = MODES.map(m => m.id);
const COIN_MODES = ["classic", "zen", "wobble"];

function modeInfo(id) { return MODES.find(m => m.id === id) || { id, label: id.toUpperCase(), tip: "" }; }

// ---- Game state -------------------------------------------------------------
// state: "menu" -> "ready" -> "playing" -> "dying" -> "over"
let state = "menu";
let paused = false;
let gameMode = "classic";

let velocityX = BASE_VELOCITY_X;
let velocityY = 0;              // positive = moving in the direction of gravity
let gravity = BASE_GRAVITY;
let gravityDir = 1;             // flip mode: 1 = down, -1 = up

let pipeArray = [];
let coinArray = [];
let particles = [];             // sparkles & floating "+1" text
let distSincePipe = 0;
let distSinceCoin = 0;
let score = 0;
let pipeCrossed = 0;
let coinsCollected = 0;
let frameCount = 0;
let dyingFrames = 0;
let shake = 0;                  // screen shake strength (px)
let flash = 0;                  // white flash alpha
let fade = 0;                   // black fade-in alpha after screen changes
let scorePop = 0;               // HUD score "bump" when you score
let screenT = 0;                // frames since the current screen appeared (for slide-ins)

// Bad luck mode
let badEndCounter = 100;
let badEndType = 0;             // 0 = none yet, 1-5 = which bad end hit
let badEndStr = "";
let isNoGapInPipes = false;

// Debug views
let isBordersOn = false;        // B
let isMaskViewOn = false;       // V

// Game-over / leaderboard flow
let isNewBest = false;
let madeLeaderboard = false;
let nameDialogOpen = false;
let hoveredButton = null;

// ---- Collision masks --------------------------------------------------------
let bertMasks = [];             // [frame] -> { mask, flipped, view, flippedView }
let topPipeMask, bottomPipeMask;
let topPipeView, bottomPipeView;  // green overlay canvases for the V key
let isFallbackActive = false;

// ---- Persistence (per-device bests + mute) ----------------------------------
const store = {
    get(key, fallback) {
        try { const v = localStorage.getItem("flappybert." + key); return v === null ? fallback : JSON.parse(v); }
        catch (e) { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem("flappybert." + key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
    }
};
let bests = store.get("bests", {});
let muted = store.get("muted", false);

// ---- Sound ------------------------------------------------------------------
const sounds = {
    wing: new Audio("./sounds/sfx_wing.wav"),
    hit: new Audio("./sounds/sfx_hit.wav"),
    die: new Audio("./sounds/sfx_die.wav"),
    point: new Audio("./sounds/sfx_point.wav"),
    swoosh: new Audio("./sounds/sfx_swooshing.wav"),
};
const backgroundMusic = new Audio("./sounds/bgm_mario.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;

function playSound(name) {
    if (muted || !sounds[name]) return;
    const s = sounds[name];
    s.currentTime = 0;
    s.play().catch(() => {});   // browsers reject play() before the first user gesture
}

function startMusic() {
    if (!muted && backgroundMusic.paused) backgroundMusic.play().catch(() => {});
}

function stopMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
}

function toggleMute() {
    muted = !muted;
    store.set("muted", muted);
    if (muted) backgroundMusic.pause();
    else if (state === "playing" && !paused) startMusic();
}

// =============================================================================
// Leaderboard — one top 5 per mode
//
// Two backends behind the same small interface ({ watch, add }):
//  - "supabase": the real site (GitHub Pages). Free Supabase project, see SETUP.md.
//  - "artifact": when the game runs as a published claude.ai artifact.
// =============================================================================

// Paste your Supabase project's values here (Dashboard > Project Settings > API Keys).
// The publishable (anon) key is meant to be public; the database rules in
// supabase-setup.sql decide what it can do. Never put the secret/service_role key here.
const SUPABASE_URL = "https://xnydwfyiwegafphkbidl.supabase.co";
const SUPABASE_KEY = "sb_publishable_wdJ02Lo_LTw6jc5fo-BYfA_lGT9mI4f";

const MAX_NAME_LEN = 16;
const NAME_PATTERN = /^[A-Z0-9_-]{1,16}$/;

let db = null;                      // the active backend, or null when offline
let canWrite = true;                // false for view-only artifact viewers
let saveFailed = false;
let rejectReason = "";              // why the server refused a score, if it did
let currentRun = null;              // Promise of this game's server ticket (Supabase)
let watchedMode = "classic";
let leaderboardEntries = [];        // current top 5 for the watched mode
let leaderboardReady = false;       // true once the first result arrived
let stopWatching = null;
let refreshLeaderboard = () => {};

/** Supabase backend (real site). */
function createSupabaseBackend() {
    if (typeof supabase === "undefined" || SUPABASE_URL.includes("YOUR-PROJECT")) return null;
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return {
        name: "supabase",
        watch(mode, onRows, onError) {
            let alive = true;
            const fetchTop = async () => {
                const { data, error } = await client.from("leaderboard")
                    .select("name, score")
                    .eq("mode", mode)
                    .order("score", { ascending: false })
                    .order("created_at", { ascending: true })   // ties: first to get there ranks higher
                    .limit(5);
                if (!alive) return;
                if (error) onError(error);
                else onRows(data || []);
            };
            fetchTop();
            // Live updates when other people post (needs Realtime on the table, see SETUP.md)…
            const channel = client.channel(`leaderboard-${mode}-${Date.now()}`)
                .on("postgres_changes",
                    { event: "INSERT", schema: "public", table: "leaderboard", filter: `mode=eq.${mode}` },
                    fetchTop)
                .subscribe();
            // …and a slow poll as a backup if Realtime isn't switched on
            const poll = setInterval(fetchTop, 60000);
            return {
                refresh: fetchTop,
                stop() { alive = false; clearInterval(poll); client.removeChannel(channel); },
            };
        },
        // The database hands out a one-time ticket when a game starts and checks
        // every score against it (see supabase-setup.sql). Browsers can't insert rows.
        async startRun(mode) {
            const { data, error } = await client.rpc("start_run", { p_mode: mode });
            if (error) throw error;
            return data;
        },
        async add(entry) {
            const runId = await entry.run;
            if (!runId) throw new Error("no ticket for this game");
            const { data, error } = await client.rpc("submit_score", {
                p_run: runId, p_name: entry.name, p_score: entry.score,
                p_pipes: entry.pipes, p_coins: entry.coins,
            });
            if (error) throw error;
            if (data !== "ok") {
                const err = new Error(data);
                err.rejected = true;
                throw err;
            }
        },
    };
}

/** claude.ai artifact database backend (published preview). */
async function createArtifactBackend() {
    if (!window.claude || typeof window.claude.use !== "function") return null;
    const store = await window.claude.use("db");
    if (!store) return null;
    const user = await window.claude.use("user");
    if (user) canWrite = (await user.can("data.write")) !== false;   // null = unknown: try anyway
    return {
        name: "artifact",
        watch(mode, onRows, onError) {
            const unsubscribe = store.collection("leaderboard")
                .where("mode", "==", mode).orderBy("score", "desc").limit(5)
                .onSnapshot(snap => onRows(snap.docs.map(d => d.data())), onError);
            return { refresh() {}, stop: unsubscribe };
        },
        async add(entry) {
            try {
                const { name, score, mode } = entry;
                await store.collection("leaderboard").add({ name, score, mode, created_at: Date.now() });
            } catch (err) {
                if (err && err.code === "invalid_argument") canWrite = false;   // view-only viewer
                throw err;
            }
        },
    };
}

/** Picks whichever backend is available, then shows the watched mode. */
async function connectLeaderboard() {
    setLeaderboardMessage("Connecting...");
    try {
        db = createSupabaseBackend() || await createArtifactBackend();
    } catch (err) {
        console.warn("Leaderboard unavailable:", err);
        db = null;
    }
    if (db) watchLeaderboard(watchedMode);
    else setLeaderboardMessage("Leaderboard offline");
}

function setLeaderboardMessage(text) {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;
    tbody.replaceChildren();
    const cell = tbody.insertRow().insertCell();
    cell.colSpan = 3;
    cell.textContent = text;
}

// Entries come from the network, so never trust them: clean before display.
function cleanName(name) {
    return String(name ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, MAX_NAME_LEN);
}

function renderLeaderboard() {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;
    if (leaderboardEntries.length === 0) return setLeaderboardMessage("No scores yet. Be first!");
    tbody.replaceChildren();
    leaderboardEntries.forEach((entry, i) => {
        const row = tbody.insertRow();
        row.insertCell().textContent = i + 1;
        const nameCell = row.insertCell();
        nameCell.className = "name";
        nameCell.textContent = cleanName(entry.name) || "???";   // textContent: no HTML injection
        row.insertCell().textContent = Math.max(0, Math.floor(Number(entry.score) || 0));
    });
}

/** Point the table (and the qualification check) at one mode's top 5. */
function watchLeaderboard(mode) {
    watchedMode = mode;
    const select = document.getElementById("leaderboard-mode");
    if (select) select.value = mode;
    if (!db) return;                  // connectLeaderboard() calls back once connected

    if (stopWatching) stopWatching();
    leaderboardReady = false;
    leaderboardEntries = [];
    setLeaderboardMessage("Loading...");

    try {
        const watcher = db.watch(mode, rows => {
            if (mode !== watchedMode) return;
            leaderboardEntries = rows;
            leaderboardReady = true;
            renderLeaderboard();
        }, err => {
            console.error("Leaderboard error:", err);
            if (mode === watchedMode) setLeaderboardMessage("Leaderboard offline");
        });
        stopWatching = watcher.stop;
        refreshLeaderboard = watcher.refresh;
    } catch (err) {                   // never let the leaderboard break the game
        console.error("Leaderboard error:", err);
        setLeaderboardMessage("Leaderboard offline");
    }
}

function lowestTop5() {
    if (leaderboardEntries.length < 5) return 0;
    return Math.min(...leaderboardEntries.map(e => Number(e.score) || 0));
}

/** Does this score earn a spot in the current mode's top 5? */
function qualifiesForLeaderboard(s) {
    if (!db || !canWrite || !leaderboardReady || s < 1) return false;
    if (db.startRun && !currentRun) return false;      // no ticket, nothing to submit with
    return leaderboardEntries.length < 5 || s > lowestTop5();
}

function submitScore(name) {
    if (!db) return;
    name = cleanName(name);
    if (!NAME_PATTERN.test(name)) return;

    madeLeaderboard = true;
    saveFailed = false;
    rejectReason = "";
    db.add({ name: name, score: Math.floor(score), mode: gameMode,
             pipes: pipeCrossed, coins: coinsCollected, run: currentRun })
        .then(() => refreshLeaderboard())
        .catch(err => {
            console.error("Failed to submit score:", err);
            madeLeaderboard = false;
            saveFailed = true;
            if (err && err.rejected) rejectReason = err.message;
        });
}

// ---- Name dialog (HTML overlay so phones get their keyboard) ----------------
function openNameDialog() {
    const dialog = document.getElementById("name-dialog");
    const input = document.getElementById("name-input");
    // Title says what actually happened: a new #1, or a spot further down the top 5
    const s = Math.floor(score);
    const rank = 1 + leaderboardEntries.filter(e => (Number(e.score) || 0) >= s).length;
    document.querySelector(".name-title").textContent =
        rank === 1 ? "★ NEW HIGH SCORE! ★" : `★ YOU'RE #${rank} ★`;
    document.getElementById("name-sub").textContent =
        rank === 1 ? `${s} in ${modeInfo(gameMode).label}. Enter your name:`
                   : `${s} made the ${modeInfo(gameMode).label} top 5. Enter your name:`;
    input.value = store.get("lastName", "");
    dialog.hidden = false;
    nameDialogOpen = true;
    // Focus a moment later so the key that ended the game isn't typed into the box
    setTimeout(() => { input.focus(); input.select(); }, 50);
}

function closeNameDialog(save) {
    const input = document.getElementById("name-input");
    if (save) {
        const name = cleanName(input.value);
        if (name) {
            store.set("lastName", name);
            submitScore(name);
        }
    }
    input.blur();
    document.getElementById("name-dialog").hidden = true;
    nameDialogOpen = false;
}

function setupNameDialog() {
    const dialog = document.getElementById("name-dialog");
    const input = document.getElementById("name-input");
    input.addEventListener("input", () => {
        const cleaned = cleanName(input.value);
        if (cleaned !== input.value) input.value = cleaned;
    });
    dialog.addEventListener("submit", e => { e.preventDefault(); closeNameDialog(true); });
    document.getElementById("name-skip").addEventListener("click", () => closeNameDialog(false));
    input.addEventListener("keydown", e => {
        e.stopPropagation();                  // typing R or M shouldn't restart the game
        if (e.key === "Escape") closeNameDialog(false);
    });
}

// =============================================================================
// Collision masks
// =============================================================================

/** Alpha mask of an image at a given size. 1 = opaque pixel. */
function getMask(img, width, height, flipY = false) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    try {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (flipY) { ctx.translate(0, h); ctx.scale(1, -1); }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const mask = new Uint8Array(w * h);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
        return mask;
    } catch (e) {
        console.error("Could not generate mask (likely CORS or file:// issue):", e);
        isFallbackActive = true;
        return new Uint8Array(w * h).fill(1);
    }
}

/** Green see-through canvas of a mask, drawn when V is on. */
function maskToCanvas(mask, width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) { img.data[i * 4 + 1] = 255; img.data[i * 4 + 3] = 140; }
    }
    ctx.putImageData(img, 0, 0);
    return c;
}

function updateBertMasks() {
    bertMasks = bertImgs.map(img => {
        const mask = getMask(img, bert.width, bert.height);
        const flipped = getMask(img, bert.width, bert.height, true);
        return {
            mask, flipped,
            view: maskToCanvas(mask, bert.width, bert.height),
            flippedView: maskToCanvas(flipped, bert.width, bert.height),
        };
    });
}

/** AABB check first, then a pixel-perfect check inside the overlap. */
function detectCollision(b, pipe) {
    const overlap = b.x < pipe.x + pipe.width && b.x + b.width > pipe.x &&
                    b.y < pipe.y + pipe.height && b.y + b.height > pipe.y;
    if (!overlap) return false;

    const m = bertMasks[bertFrame];
    const bMask = m && (gravityDir < 0 ? m.flipped : m.mask);
    const pMask = pipe.isTop ? topPipeMask : bottomPipeMask;
    if (!bMask || !pMask) return true;

    const bw = Math.floor(b.width), bh = Math.floor(b.height);
    const pw = Math.floor(pipe.width), ph = Math.floor(pipe.height);
    const x0 = Math.floor(Math.max(b.x, pipe.x)), x1 = Math.ceil(Math.min(b.x + b.width, pipe.x + pipe.width));
    const y0 = Math.floor(Math.max(b.y, pipe.y)), y1 = Math.ceil(Math.min(b.y + b.height, pipe.y + pipe.height));

    for (let y = y0; y < y1; y++) {
        const bY = Math.floor(y - b.y), pY = Math.floor(y - pipe.y);
        if (bY < 0 || bY >= bh || pY < 0 || pY >= ph) continue;
        for (let x = x0; x < x1; x++) {
            const bX = Math.floor(x - b.x), pX = Math.floor(x - pipe.x);
            if (bX < 0 || bX >= bw || pX < 0 || pX >= pw) continue;
            if (bMask[bY * bw + bX] && pMask[pY * pw + pX]) return true;
        }
    }
    return false;
}

// =============================================================================
// Setup
// =============================================================================
window.onload = function () {
    board = document.getElementById("board");
    board.width = boardWidth;
    board.height = boardHeight;
    context = board.getContext("2d");

    const toLoad = {
        bert0: "./img/bertAnimation/flappybert0.png",
        bert1: "./img/bertAnimation/flappybert1.png",
        topPipe: "./img/top-lamp.png",
        bottomPipe: "./img/bottom-coffee-mug-tower.png",
        coin: "./img/bert_buck.png",
        background: "./img/kitchen.png",
    };
    const keys = Object.keys(toLoad);
    let loaded = 0;
    const onDone = () => {
        if (++loaded < keys.length) return;
        bertImgs = [images.bert0, images.bert1];
        buildEffects();
        updateBertMasks();
        topPipeMask = getMask(images.topPipe, PIPE_WIDTH, PIPE_HEIGHT);
        bottomPipeMask = getMask(images.bottomPipe, PIPE_WIDTH, PIPE_HEIGHT);
        topPipeView = maskToCanvas(topPipeMask, PIPE_WIDTH, PIPE_HEIGHT);
        bottomPipeView = maskToCanvas(bottomPipeMask, PIPE_WIDTH, PIPE_HEIGHT);
        requestAnimationFrame(loop);
    };
    for (const k of keys) {
        const img = new Image();
        img.onload = onDone;
        img.onerror = onDone;
        img.src = toLoad[k];
        images[k] = img;
    }

    // Leaderboard mode picker
    const select = document.getElementById("leaderboard-mode");
    for (const m of MODES) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label;
        select.appendChild(opt);
    }
    select.addEventListener("change", () => watchLeaderboard(select.value));
    connectLeaderboard();

    setupNameDialog();
    if (document.fonts) document.fonts.load(`20px 'Press Start 2P'`).catch(() => {});

    document.addEventListener("keydown", onKeyDown);
    board.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);

    // Pause automatically when the tab is hidden (phone locked, app switched)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && state === "playing") setPaused(true);
    });
};

// =============================================================================
// Main loop: fixed 60 physics steps per second, drawn once per display frame.
// Same speed on 60Hz, 120Hz and 144Hz screens.
// =============================================================================
let lastTime = 0;
let accumulator = 0;

function loop(time) {
    requestAnimationFrame(loop);
    if (!lastTime) lastTime = time;
    accumulator += Math.min(time - lastTime, 250);   // don't fast-forward after a stall
    lastTime = time;

    while (accumulator >= STEP_MS) {
        step();
        accumulator -= STEP_MS;
    }
    render();
}

function step() {
    frameCount++;
    if (frameCount % 6 === 0) bertFrame = (bertFrame + 1) % Math.max(1, bertImgs.length);
    if (paused) return;

    updateParticles();
    screenT++;
    if (shake > 0) shake = Math.max(0, shake - 0.6);
    if (flash > 0) flash = Math.max(0, flash - 0.05);
    if (fade > 0) fade = Math.max(0, fade - 0.06);
    if (scorePop > 0) scorePop = Math.max(0, scorePop - 0.08);

    if (state === "ready") {
        bert.y = BERT_START_Y + Math.sin(frameCount / 10) * 8;   // hover until the first flap
        return;
    }

    if (state === "dying") {
        // Bert tumbles out of the scene, then the game-over panel shows
        velocityY = Math.min(velocityY + BASE_GRAVITY, MAX_FALL);
        bert.y += velocityY;
        if (++dyingFrames > 50 || bert.y > boardHeight + 50) finishGame();
        return;
    }

    if (state !== "playing") return;

    if (gameMode === "turbo") velocityX -= 0.001;

    velocityY = Math.min(velocityY + gravity, MAX_FALL);
    bert.y += velocityY * gravityDir;
    if (gameMode !== "flip") bert.y = Math.max(bert.y, -40);

    // Out of bounds
    const tooLow = bert.y > boardHeight;
    const tooHigh = gameMode === "flip" ? bert.y < -bert.height : (bert.y < -30 && gameMode !== "zen");
    if (tooLow || tooHigh || score < -20) return die(false);

    // Spawn by distance travelled, so spacing stays right at any speed
    const moved = Math.abs(velocityX);
    distSincePipe += moved;
    distSinceCoin += moved;
    if (distSincePipe >= PIPE_SPACING) { distSincePipe -= PIPE_SPACING; placePipes(); }
    if (distSinceCoin >= COIN_SPACING) { distSinceCoin -= COIN_SPACING; placeCoins(); }

    for (const pipe of pipeArray) {
        pipe.x += velocityX;
        if (gameMode === "wobble") pipe.y = pipe.baseY + Math.sin(frameCount / 40 + pipe.phase) * 70;

        if (pipe.isTop && !pipe.passed && bert.x > pipe.x + pipe.width) {
            pipe.passed = true;
            score += 1;
            scorePop = 1;
            pipeCrossed += 1;
            playSound("point");
            addFloatingText("+1", bert.x + bert.width / 2, bert.y - 10, "white");
        }
        if (gameMode !== "zen" && detectCollision(bert, pipe)) return die(true);
    }

    for (const c of coinArray) {
        c.x += velocityX;
        if (c.collected) continue;
        if (bert.x < c.x + c.width && bert.x + bert.width > c.x &&
            bert.y < c.y + c.height && bert.y + bert.height > c.y) {
            c.collected = true;
            coinsCollected += 1;
            score += 1;
            scorePop = 1;
            playSound("point");
            addSparkles(c.x + c.width / 2, c.y + c.height / 2);
            addFloatingText("+1", c.x + c.width / 2, c.y, "#ffd700");
        }
    }

    while (coinArray.length && coinArray[0].x < -100) coinArray.shift();
    while (pipeArray.length && pipeArray[0].x < -PIPE_WIDTH) pipeArray.shift();
}

// =============================================================================
// Rendering
// =============================================================================
const FONT = "'Press Start 2P', 'Courier New', monospace";

function fillScreen(color) {
    context.fillStyle = color;
    context.fillRect(-20, -20, boardWidth + 40, boardHeight + 40);   // overscan for shake
}

function render() {
    context.save();
    context.clearRect(0, 0, boardWidth, boardHeight);
    if (shake > 0) context.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);

    if (images.background && images.background.naturalWidth) {
        context.drawImage(images.background, -20, -20, boardWidth + 40, boardHeight + 40);
    }

    if (state === "menu") {
        drawMenu();
    } else {
        drawWorld();
        if (gameMode === "night") drawNightMask();
        drawParticles();
        drawHud();
        if (vignette) context.drawImage(vignette, -20, -20);
        if (state === "ready") drawReadyHint();
        if (paused) drawPaused();
        if (state === "over") drawGameOver();
        if (flash > 0) fillScreen(`rgba(255,255,255,${flash})`);
    }
    drawCornerButtons();
    if (fade > 0) fillScreen(`rgba(0,0,0,${fade})`);
    context.restore();
}

function drawWorld() {
    for (const pipe of pipeArray) {
        context.drawImage(pipe.isTop ? images.topPipe : images.bottomPipe, pipe.x, pipe.y, pipe.width, pipe.height);
        if (isMaskViewOn) context.drawImage(pipe.isTop ? topPipeView : bottomPipeView, pipe.x, pipe.y);
        if (isBordersOn) {
            context.strokeStyle = "red";
            context.lineWidth = 2;
            context.strokeRect(pipe.x, pipe.y, pipe.width, pipe.height);
        }
    }

    const spin = Math.abs(Math.sin(Date.now() / 150));
    for (const c of coinArray) {
        if (c.collected) continue;
        const w = c.width * spin;
        if (coinGlow) context.drawImage(coinGlow, c.x - 30, c.y - 30);
        context.drawImage(images.coin, c.x + (c.width - w) / 2, c.y, w, c.height);
    }

    const img = bertImgs[bertFrame];
    if (img) {
        context.save();
        if (gravityDir < 0) {                     // upside-down while gravity is flipped
            context.translate(bert.x, bert.y + bert.height);
            context.scale(1, -1);
            context.drawImage(img, 0, 0, bert.width, bert.height);
        } else {
            context.drawImage(img, bert.x, bert.y, bert.width, bert.height);
        }
        context.restore();
        const m = bertMasks[bertFrame];
        if (isMaskViewOn && m) context.drawImage(gravityDir < 0 ? m.flippedView : m.view, bert.x, bert.y);
    }
    if (isBordersOn) {
        context.strokeStyle = "blue";
        context.lineWidth = 2;
        context.strokeRect(bert.x, bert.y, bert.width, bert.height);
    }
}

function drawNightMask() {
    const cx = bert.x + bert.width / 2, cy = bert.y + bert.height / 2;
    context.save();
    context.globalCompositeOperation = "destination-in";
    const g = context.createRadialGradient(cx, cy, 60, cx, cy, 220);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0.1)");
    fillScreen(g);
    context.globalCompositeOperation = "destination-over";
    fillScreen("rgba(0,0,0,0.95)");
    context.restore();
}

function outlinedText(text, x, y, fill, font, align = "left") {
    context.font = font;
    context.textAlign = align;
    context.lineWidth = 6;
    context.lineJoin = "round";
    context.strokeStyle = "black";
    context.strokeText(text, x, y);
    context.fillStyle = fill;
    context.fillText(text, x, y);
}

function drawHud() {
    // Score with a little bump each time it goes up
    const pop = 1 + scorePop * 0.35;
    context.drawImage(images.coin, 14, 14, 72, 72);
    context.save();
    context.translate(100, 66);
    context.scale(pop, pop);
    outlinedText(Math.floor(score), 0, 0, scorePop > 0.5 ? "#ffd700" : "white", `40px ${FONT}`);
    context.restore();
    if (gameMode !== "zen") outlinedText(`PASSED ${pipeCrossed}`, 16, 118, "white", `16px ${FONT}`);

    outlinedText(`BEST ${bests[gameMode] || 0}`, cornerButtons.pause.x - 16, 52, "palegoldenrod", `18px ${FONT}`, "right");

    if (gameMode === "badluck") {
        outlinedText(`LUCK ${Math.max(0, badEndCounter)}%`, boardWidth - 20, 110, "white", `20px ${FONT}`, "right");
        if (badEndStr) outlinedText(`BAD LUCK: ${badEndStr.toUpperCase()}`, 14, 624, "#f88", `16px ${FONT}`);
    }
    if (gameMode === "turbo") outlinedText(`SPEED ${Math.abs(velocityX).toFixed(2)}`, 16, 146, "aqua", `14px ${FONT}`);
    if (isFallbackActive) outlinedText("Box collision (CORS/file limit)", 14, 600, "red", `12px ${FONT}`);
}

function drawReadyHint() {
    const info = modeInfo(gameMode);
    const slide = easeOut(Math.min(1, screenT / 25));
    context.globalAlpha = slide;
    outlinedText(info.label, boardWidth / 2, boardHeight / 2 - 110 - (1 - slide) * 40, "aqua", `40px ${FONT}`, "center");
    outlinedText(info.tip, boardWidth / 2, boardHeight / 2 - 60, "palegoldenrod", `14px ${FONT}`, "center");
    context.globalAlpha = slide * (0.6 + Math.sin(frameCount / 8) * 0.4);
    outlinedText("TAP / SPACE TO FLAP", boardWidth / 2, boardHeight / 2 + 120, "white", `24px ${FONT}`, "center");
    context.globalAlpha = 1;
}

const pauseButtons = {
    resume: { x: boardWidth / 2 - 230, y: 360, w: 210, h: 64, label: "RESUME" },
    menu:   { x: boardWidth / 2 + 20,  y: 360, w: 210, h: 64, label: "MENU" },
};

function drawPaused() {
    fillScreen("rgba(0,0,0,0.6)");
    outlinedText("PAUSED", boardWidth / 2, 290, "white", `56px ${FONT}`, "center");
    drawButton(pauseButtons.resume, pauseButtons.resume.label);
    drawButton(pauseButtons.menu, pauseButtons.menu.label);
}

// ---- Buttons (shared by drawing and tap hit-testing) ------------------------
const menuButtons = MODES.map((m, i) => {
    const col = i % 2, row = Math.floor(i / 2), w = 420, h = 64;
    return { mode: m.id, label: `${i + 1}: ${m.label}`, isNew: m.isNew, w, h,
             x: boardWidth / 2 + (col === 0 ? -w - 15 : 15), y: 165 + row * 82 };
});

const overButtons = {
    retry: { x: boardWidth / 2 - 230, y: 420, w: 210, h: 64, label: "R: RETRY" },
    menu:  { x: boardWidth / 2 + 20,  y: 420, w: 210, h: 64, label: "M: MENU" },
};

function drawButton(b, text, sub, dx = 0) {
    const hover = b === hoveredButton;
    const x = b.x + dx, y = b.y - (hover ? 3 : 0);
    context.fillStyle = "rgba(0,0,0,0.55)";                 // hard pixel drop shadow
    context.fillRect(x + 8, b.y + 8, b.w, b.h);
    context.fillStyle = hover ? "aqua" : "white";
    context.fillRect(x, y, b.w, b.h);
    context.fillStyle = hover ? "#10283a" : "#000";
    context.fillRect(x + 5, y + 5, b.w - 10, b.h - 10);
    context.fillStyle = "rgba(255,255,255,0.12)";            // top highlight
    context.fillRect(x + 5, y + 5, b.w - 10, 6);
    context.textAlign = "center";
    context.fillStyle = hover ? "aqua" : "white";
    context.font = `20px ${FONT}`;
    context.fillText(text, x + b.w / 2, y + (sub ? 32 : 42));
    if (sub) {
        context.fillStyle = "palegoldenrod";
        context.font = `11px ${FONT}`;
        context.fillText(sub, x + b.w / 2, y + 52);
    }
    if (b.isNew) {                                           // little "NEW" tag in the corner
        const pulse = Math.sin(frameCount / 10) * 2;
        context.fillStyle = "#ffd700";
        context.fillRect(x + b.w - 62, y - 12 - pulse, 62, 24);
        context.fillStyle = "#000";
        context.font = `11px ${FONT}`;
        context.fillText("NEW", x + b.w - 31, y + 5 - pulse);
    }
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function drawMenu() {
    fillScreen("rgba(0,0,0,0.45)");
    if (vignette) context.drawImage(vignette, -20, -20);

    // Title: drops in, then bobs; each letter waves slightly
    const drop = easeOut(Math.min(1, screenT / 30));
    const title = "FLAPPY BERT";
    context.font = `58px ${FONT}`;
    context.textAlign = "left";
    const tw = context.measureText(title).width;
    let tx = boardWidth / 2 - tw / 2 - 40;
    for (let i = 0; i < title.length; i++) {
        const ch = title[i];
        const y = 100 - (1 - drop) * 140 + Math.sin(frameCount / 12 + i * 0.5) * 5;
        context.fillStyle = "#000";
        context.fillText(ch, tx + 6, y + 6);
        context.fillStyle = i < 6 ? "aqua" : "#ffd700";
        context.fillText(ch, tx, y);
        tx += context.measureText(ch).width;
    }
    const bob = Math.sin(frameCount / 15) * 8;
    if (bertImgs[bertFrame]) context.drawImage(bertImgs[bertFrame], tx + 16, 38 + bob - (1 - drop) * 140, 76, 76);

    // Buttons slide in one after another
    menuButtons.forEach((b, i) => {
        const t = easeOut(Math.min(1, Math.max(0, (screenT - 8 - i * 3) / 20)));
        const from = (i % 2 === 0 ? -1 : 1) * 700;
        const best = bests[b.mode];
        drawButton(b, b.label, best ? `BEST ${best}` : "", from * (1 - t));
    });

    context.textAlign = "center";
    context.globalAlpha = 0.6 + Math.sin(frameCount / 10) * 0.4;
    outlinedText("TAP A MODE OR PRESS 1-8", boardWidth / 2, 545, "palegoldenrod", `16px ${FONT}`, "center");
    context.globalAlpha = 1;
}

// Medal thresholds (score needed)
const MEDALS = [
    { min: 50, name: "PLATINUM", fill: "#e5f4ff", rim: "#8fb3cc" },
    { min: 30, name: "GOLD",     fill: "#ffd700", rim: "#b8860b" },
    { min: 20, name: "SILVER",   fill: "#dcdcdc", rim: "#8a8a8a" },
    { min: 10, name: "BRONZE",   fill: "#d98c4a", rim: "#8b4f1f" },
];

function drawMedal(cx, cy, medal) {
    const r = 46;
    context.fillStyle = "#000";
    context.beginPath(); context.arc(cx + 5, cy + 5, r, 0, Math.PI * 2); context.fill();
    context.fillStyle = medal ? medal.rim : "#2a2a44";
    context.beginPath(); context.arc(cx, cy, r, 0, Math.PI * 2); context.fill();
    context.fillStyle = medal ? medal.fill : "#1f1f36";
    context.beginPath(); context.arc(cx, cy, r - 8, 0, Math.PI * 2); context.fill();
    if (!medal) {
        context.fillStyle = "#555";
        context.font = `11px ${FONT}`;
        context.textAlign = "center";
        context.fillText("10+", cx, cy + 5);
        return;
    }
    if (bertImgs[0]) context.drawImage(bertImgs[0], cx - 26, cy - 28, 52, 52);
    // travelling shine
    const a = (frameCount / 40) % (Math.PI * 2);
    context.fillStyle = "rgba(255,255,255,0.8)";
    context.fillRect(cx + Math.cos(a) * (r - 14) - 3, cy + Math.sin(a) * (r - 14) - 3, 6, 6);
}

function drawGameOver() {
    fillScreen("rgba(0,0,0,0.6)");

    const slide = easeOut(Math.min(1, screenT / 22));
    const px = boardWidth / 2 - 300, pw = 600, ph = 410;
    const py = 100 - (1 - slide) * 520;

    // Panel with a hard shadow and a two-tone pixel frame
    context.fillStyle = "rgba(0,0,0,0.6)";
    context.fillRect(px + 12, py + 12, pw, ph);
    context.fillStyle = "white";
    context.fillRect(px, py, pw, ph);
    context.fillStyle = "aqua";
    context.fillRect(px + 6, py + 6, pw - 12, ph - 12);
    context.fillStyle = "#1a1a2e";
    context.fillRect(px + 12, py + 12, pw - 24, ph - 24);

    outlinedText("GAME OVER", boardWidth / 2, py + 72, "white", `44px ${FONT}`, "center");
    outlinedText(modeInfo(gameMode).label, boardWidth / 2, py + 108, "aqua", `14px ${FONT}`, "center");

    // Medal on the left, score on the right
    const medal = MEDALS.find(m => Math.floor(score) >= m.min);
    drawMedal(px + 150, py + 190, medal);
    if (medal) {
        context.fillStyle = "palegoldenrod";
        context.fillText(medal.name, px + 150, py + 258);
    }

    context.textAlign = "center";
    context.fillStyle = "#aaa";
    context.font = `12px ${FONT}`;
    context.fillText("SCORE", px + 410, py + 152);
    outlinedText(Math.floor(score), px + 410, py + 205, "white", `44px ${FONT}`, "center");
    const best = bests[gameMode] || 0;
    if (isNewBest) {
        const p = 1 + Math.sin(frameCount / 6) * 0.06;
        context.save();
        context.translate(px + 410, py + 245);
        context.scale(p, p);
        outlinedText("NEW BEST!", 0, 0, "#ffd700", `14px ${FONT}`, "center");
        context.restore();
    } else {
        context.fillStyle = "palegoldenrod";
        context.font = `12px ${FONT}`;
        context.fillText(`BEST ${best}`, px + 410, py + 245);
    }

    // Leaderboard status
    let line = "", color = "#888";
    if (!db) line = "Leaderboard offline";
    else if (!canWrite) line = "View only: scores can't be saved";
    else if (rejectReason) { line = `Score rejected: ${rejectReason}`; color = "#f88"; }
    else if (saveFailed) { line = "Couldn't save score. Try again later"; color = "#f88"; }
    else if (madeLeaderboard) { line = "You're on the leader board!"; color = "#8f8"; }
    else if (!nameDialogOpen && Math.floor(score) >= 1 && !qualifiesForLeaderboard(Math.floor(score))) {
        line = `Need ${lowestTop5() + 1}+ for the top 5`;
        color = "#f88";
    }
    context.font = `11px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = "center";
    context.fillText(line, boardWidth / 2, py + 300);

    const dy = py - 100;   // buttons ride along with the panel
    overButtons.retry.y = 420 + dy;
    overButtons.menu.y = 420 + dy;
    drawButton(overButtons.retry, overButtons.retry.label);
    drawButton(overButtons.menu, overButtons.menu.label);
}

// ---- Corner buttons: pause + mute (tap-friendly for phones) ------------------
const cornerButtons = {
    pause: { x: boardWidth - 140, y: 14, w: 56, h: 56 },
    mute:  { x: boardWidth - 72,  y: 14, w: 56, h: 56 },
};

function drawCornerButtons() {
    const showPause = state === "playing" || state === "ready";
    for (const [key, b] of Object.entries(cornerButtons)) {
        if (key === "pause" && !showPause) continue;
        const hover = b === hoveredButton;
        context.fillStyle = "rgba(0,0,0,0.5)";
        context.fillRect(b.x + 4, b.y + 4, b.w, b.h);
        context.fillStyle = hover ? "aqua" : "white";
        context.fillRect(b.x, b.y, b.w, b.h);
        context.fillStyle = "#000";
        context.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
        context.fillStyle = hover ? "aqua" : "white";
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (key === "pause") {
            if (paused) {                               // play triangle
                context.beginPath();
                context.moveTo(cx - 8, cy - 12); context.lineTo(cx + 12, cy); context.lineTo(cx - 8, cy + 12);
                context.fill();
            } else {
                context.fillRect(cx - 11, cy - 12, 8, 24);
                context.fillRect(cx + 3, cy - 12, 8, 24);
            }
        } else {                                        // pixel speaker
            context.fillRect(cx - 14, cy - 5, 7, 10);
            context.beginPath();
            context.moveTo(cx - 7, cy - 5); context.lineTo(cx + 2, cy - 13);
            context.lineTo(cx + 2, cy + 13); context.lineTo(cx - 7, cy + 5); context.fill();
            if (muted) {
                context.fillStyle = "#f55";
                for (let i = -1; i <= 1; i += 2) {
                    context.save();
                    context.translate(cx + 9, cy);
                    context.rotate(i * Math.PI / 4);
                    context.fillRect(-9, -2, 18, 4);
                    context.restore();
                }
            } else {
                context.fillRect(cx + 6, cy - 4, 3, 8);
                context.fillRect(cx + 11, cy - 8, 3, 16);
            }
        }
    }
}

// ---- Pre-rendered effects ------------------------------------------------------
let vignette = null;
let coinGlow = null;

function buildEffects() {
    vignette = document.createElement("canvas");
    vignette.width = boardWidth + 40;
    vignette.height = boardHeight + 40;
    let ctx = vignette.getContext("2d");
    const g = ctx.createRadialGradient(vignette.width / 2, vignette.height / 2, boardHeight * 0.45,
                                       vignette.width / 2, vignette.height / 2, boardWidth * 0.7);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vignette.width, vignette.height);

    coinGlow = document.createElement("canvas");
    coinGlow.width = coinGlow.height = COIN_SIZE + 60;
    ctx = coinGlow.getContext("2d");
    const c = coinGlow.width / 2;
    const cg = ctx.createRadialGradient(c, c, 10, c, c, c);
    cg.addColorStop(0, "rgba(255,215,0,0.45)");
    cg.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, coinGlow.width, coinGlow.height);
}

// ---- Particles --------------------------------------------------------------
function addSparkles(x, y) {
    for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
        particles.push({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                         life: 30, max: 30, color: Math.random() < 0.5 ? "#ffd700" : "#fff6b0" });
    }
}

function addPuff() {
    // little dust puff behind Bert on every flap
    const x = bert.x + 6, y = bert.y + bert.height * (gravityDir > 0 ? 0.8 : 0.2);
    for (let i = 0; i < 6; i++) {
        particles.push({ kind: "puff", x, y, vx: -1.5 - Math.random() * 2, vy: (Math.random() - 0.5) * 1.5 + gravityDir * 0.8,
                         size: 6 + Math.random() * 8, life: 22, max: 22, color: "rgba(255,255,255,0.8)" });
    }
}

function addFloatingText(text, x, y, color) {
    particles.push({ kind: "text", text, x, y, vx: 0, vy: -1.2, life: 40, max: 40, color });
}

function updateParticles() {
    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === "spark") p.vy += 0.15;
        p.life--;
    }
    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    for (const p of particles) {
        context.globalAlpha = p.life / p.max;
        if (p.kind === "spark") {
            context.fillStyle = p.color;
            context.fillRect(Math.round(p.x), Math.round(p.y), 5, 5);
        } else if (p.kind === "puff") {
            const sz = p.size * (1.5 - p.life / p.max * 0.5);
            context.fillStyle = p.color;
            context.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
        } else {
            outlinedText(p.text, p.x, p.y, p.color, `18px ${FONT}`, "center");
        }
    }
    context.globalAlpha = 1;
}

// =============================================================================
// Spawning
// =============================================================================
function placePipes() {
    if (gameMode === "zen") return;

    const topY = -PIPE_HEIGHT / 4 - Math.random() * PIPE_HEIGHT / 2;
    let opening = boardHeight / 4;
    if (gameMode === "wobble") opening += 20;        // a little extra room for moving gaps
    if (isNoGapInPipes) opening = 1;                  // bad luck: no gap
    const phase = Math.random() * Math.PI * 2;
    const bottomY = topY + PIPE_HEIGHT + opening;

    pipeArray.push({ isTop: true,  x: boardWidth, y: topY,    baseY: topY,    phase, width: PIPE_WIDTH, height: PIPE_HEIGHT, passed: false });
    pipeArray.push({ isTop: false, x: boardWidth, y: bottomY, baseY: bottomY, phase, width: PIPE_WIDTH, height: PIPE_HEIGHT, passed: false });
}

function placeCoins() {
    if (!COIN_MODES.includes(gameMode)) return;
    if (gameMode !== "zen" && Math.random() < 0.4) return;   // 60% spawn rate outside zen

    coinArray.push({ x: boardWidth, y: getRandomIntInclusive(100, boardHeight - 100),
                     width: COIN_SIZE, height: COIN_SIZE, collected: false });
}

// =============================================================================
// Game flow
// =============================================================================
function startMode(mode) {
    gameMode = mode;
    watchLeaderboard(mode);        // show (and qualify against) this mode's top 5
    resetGame();
}

/** Reset everything for a fresh round of the current mode. */
function resetGame() {
    if (nameDialogOpen) closeNameDialog(false);
    fade = 0.7;
    screenT = 0;

    state = "ready";
    paused = false;
    pipeArray = [];
    coinArray = [];
    particles = [];
    distSincePipe = PIPE_SPACING - 60;    // first pipes arrive quickly
    distSinceCoin = 0;
    score = 0;
    pipeCrossed = 0;
    coinsCollected = 0;
    currentRun = null;
    rejectReason = "";
    dyingFrames = 0;
    shake = 0;
    flash = 0;
    isNewBest = false;
    madeLeaderboard = false;
    saveFailed = false;
    hoveredButton = null;

    velocityX = BASE_VELOCITY_X;
    velocityY = 0;
    gravity = BASE_GRAVITY;
    gravityDir = 1;

    badEndCounter = gameMode === "badluck" ? getRandomIntInclusive(1, 100) : 100;
    badEndType = 0;
    badEndStr = "";
    isNoGapInPipes = false;

    const size = gameMode === "giant" ? 100 : 50;
    bert.width = size;
    bert.height = size;
    bert.y = BERT_START_Y;
    updateBertMasks();

    playSound("swoosh");
}

function goToMenu() {
    if (nameDialogOpen) closeNameDialog(false);
    fade = 0.7;
    screenT = 0;
    state = "menu";
    paused = false;
    stopMusic();
    pipeArray = [];
    coinArray = [];
    particles = [];
    score = 0;
    shake = 0;
    flash = 0;
    bert.y = BERT_START_Y;
    velocityY = 0;
    gravityDir = 1;
    hoveredButton = null;
    playSound("swoosh");
}

function die(hitPipe) {
    if (state !== "playing") return;
    state = "dying";
    dyingFrames = 0;
    playSound(hitPipe ? "hit" : "die");
    if (hitPipe) setTimeout(() => playSound("die"), 250);
    shake = 14;
    flash = 0.8;
    velocityY = hitPipe ? -4 : 0;          // small bounce off the pipe
    gravityDir = 1;                         // always fall down, even in flip mode
}

function finishGame() {
    state = "over";
    screenT = 0;
    stopMusic();

    const finalScore = Math.floor(score);
    if (finalScore > (bests[gameMode] || 0)) {
        bests[gameMode] = finalScore;
        store.set("bests", bests);
        isNewBest = true;
    }
    if (qualifiesForLeaderboard(finalScore)) openNameDialog();
}

function setPaused(on) {
    if (state !== "playing" && state !== "ready") return;
    paused = on;
    if (paused) backgroundMusic.pause();
    else if (state === "playing") startMusic();
}

/** A flap (key, tap or click). */
function jumpLogic() {
    if (state === "ready") {
        state = "playing";
        screenT = 25;           // keep the ready text from re-animating
        // Ask the server for this game's ticket (its clock starts now)
        if (db && db.startRun) {
            currentRun = db.startRun(gameMode).catch(err => {
                console.warn("Couldn't start a ranked game:", err);
                return null;
            });
        }
        startMusic();
    }
    if (state !== "playing") return;

    playSound("wing");
    addPuff();
    if (gameMode === "flip") {
        gravityDir *= -1;                  // flip gravity instead of flapping
        velocityY = -2;
    } else {
        velocityY = JUMP_VELOCITY;
    }
    if (gameMode === "badluck") applyBadLuck();
}

function applyBadLuck() {
    badEndCounter -= 1;

    if (badEndCounter < 1 && !badEndType) {
        badEndType = getRandomIntInclusive(1, 5);
        badEndStr = ["", "No gravity", "Can't jump", "No gap", "Score -2 per flap", "Random size"][badEndType];
        if (badEndType === 1) gravity = 0;
        if (badEndType === 3) isNoGapInPipes = true;
    }

    // These bad ends keep hurting on every flap
    if (badEndType === 2) velocityY = 10;
    if (badEndType === 4) score -= 2;
    if (badEndType === 5) {
        const s = getRandomIntInclusive(45, 100);
        bert.width = s;
        bert.height = s;
        updateBertMasks();
    }
}

// =============================================================================
// Input
// =============================================================================
function onKeyDown(e) {
    if (nameDialogOpen) return;            // the dialog's input handles its own keys
    const code = e.code;
    const isFlapKey = code === "Space" || code === "ArrowUp" || code === "KeyX";
    if (isFlapKey) e.preventDefault();     // don't scroll the page
    if (e.repeat && isFlapKey) return;     // holding the key shouldn't machine-gun flaps

    if (code === "KeyN") return toggleMute();
    if (code === "KeyB") { isBordersOn = !isBordersOn; return; }
    if (code === "KeyV") { isMaskViewOn = !isMaskViewOn; return; }

    if (state === "menu") {
        const m = code.match(/^(?:Digit|Numpad)([1-8])$/);
        if (m) startMode(MODE_IDS[Number(m[1]) - 1]);
        return;
    }

    if (code === "KeyM") return goToMenu();

    if (code === "KeyP" || code === "Escape") return setPaused(!paused);

    if (state === "over") {
        if (code === "KeyR" || code === "Enter" || isFlapKey) resetGame();
        return;
    }

    if (isFlapKey) {
        if (paused) return setPaused(false);
        jumpLogic();
    }
}

/** Pointer position in canvas coordinates (the canvas is scaled by CSS). */
function toCanvasPoint(e) {
    const r = board.getBoundingClientRect();
    return { x: (e.clientX - r.left) * boardWidth / r.width, y: (e.clientY - r.top) * boardHeight / r.height };
}

function hit(b, p) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

function onPointerDown(e) {
    if (nameDialogOpen) return;
    e.preventDefault();
    const p = toCanvasPoint(e);

    if (hit(cornerButtons.mute, p)) return toggleMute();
    if (state === "menu") {
        const b = menuButtons.find(btn => hit(btn, p));
        if (b) startMode(b.mode);
        return;
    }
    if (state === "over") {
        if (hit(overButtons.retry, p)) resetGame();
        else if (hit(overButtons.menu, p)) goToMenu();
        return;
    }
    if (hit(cornerButtons.pause, p)) return setPaused(!paused);
    if (paused) {
        if (hit(pauseButtons.menu, p)) return goToMenu();
        return setPaused(false);
    }
    jumpLogic();
}

/** Hover highlight for mouse users. */
function onPointerMove(e) {
    if (e.pointerType !== "mouse") return;
    const p = toCanvasPoint(e);
    let list = [cornerButtons.mute];
    if (state === "menu") list = list.concat(menuButtons);
    else if (state === "over") list = list.concat(Object.values(overButtons));
    else if (paused) list = list.concat(cornerButtons.pause, Object.values(pauseButtons));
    else list = list.concat(cornerButtons.pause);
    hoveredButton = list.find(b => hit(b, p)) || null;
    board.style.cursor = hoveredButton ? "pointer" : "default";
}

// =============================================================================
// Helpers
// =============================================================================
function getRandomIntInclusive(min, max) {
    const lo = Math.ceil(min), hi = Math.floor(max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
