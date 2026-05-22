import {
  BOARD_SIZE,
  NUM_TYPES,
  SPAWN_PER_TURN,
  createInitialBoard,
  findMatches,
  isGameOver,
  scoreForWave,
} from './logic.js';

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

// Each tile in state.board is now an object: { id, type } | null.
// Stable ids let us animate tile movement (DOM elements persist across re-renders).
let nextTileId = 1;

function makeTile(type) {
  return { id: nextTileId++, type };
}

const state = {
  board: null,        // 6x6 array of { id, type } | null
  score: 0,
  bestScore: 0,
  isAnimating: false,
  isGameOver: false,
};

const STORAGE_KEY = 'tri_v_ryad_best';

function loadBest() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

// Convert a "type only" board (from logic) to a "tile object" board (with ids).
function wrapBoard(typeBoard) {
  return typeBoard.map(row => row.map(cell => cell === null ? null : makeTile(cell)));
}

// Render: ensure board background cells exist, then sync tile DOM elements.
function renderStaticCells() {
  // Create 36 background cells once.
  if (boardEl.querySelector('.cell')) return;
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    boardEl.appendChild(cell);
  }
}

const tileEls = new Map(); // id -> HTMLElement

function tileTransform(r, c) {
  // Position within board accounting for grid gap.
  const tileSize = `calc((var(--board-size) - var(--gap) * 8) / 6)`;
  const offset = `calc(${tileSize} + var(--gap))`;
  return `translate(calc(${offset} * ${c}), calc(${offset} * ${r}))`;
}

function renderTiles() {
  const seenIds = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = state.board[r][c];
      if (!tile) continue;
      seenIds.add(tile.id);
      let el = tileEls.get(tile.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `tile tile-${tile.type} spawning`;
        const shape = document.createElement('div');
        shape.className = 'tile-shape';
        el.appendChild(shape);
        boardEl.appendChild(el);
        tileEls.set(tile.id, el);
        // remove .spawning after animation
        setTimeout(() => el.classList.remove('spawning'), 220);
      }
      el.style.transform = tileTransform(r, c);
    }
  }
  // Remove tile elements that no longer exist
  for (const [id, el] of tileEls) {
    if (!seenIds.has(id)) {
      el.remove();
      tileEls.delete(id);
    }
  }
}

function renderScore() {
  scoreEl.textContent = state.score;
  bestEl.textContent = state.bestScore;
}

function render() {
  renderStaticCells();
  renderTiles();
  renderScore();
}

function init() {
  state.board = wrapBoard(createInitialBoard());
  state.score = 0;
  state.bestScore = loadBest();
  state.isAnimating = false;
  state.isGameOver = false;
  render();
}

const STEP_MS = 220; // matches CSS transitions

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function typesOf(board) {
  // strip ids: { id, type } | null → type | null
  return board.map(row => row.map(cell => cell === null ? null : cell.type));
}

// Apply gravity to the WRAPPED board (preserving tile objects + ids).
// This is the rendering-aware counterpart to logic.applyGravity.
function gravityWrapped(board, direction) {
  const empty = () => Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(null));
  const result = empty();

  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < BOARD_SIZE; r++) {
      const tiles = board[r].filter(c => c !== null);
      if (direction === 'left') {
        for (let i = 0; i < tiles.length; i++) result[r][i] = tiles[i];
      } else {
        const offset = BOARD_SIZE - tiles.length;
        for (let i = 0; i < tiles.length; i++) result[r][offset + i] = tiles[i];
      }
    }
  } else {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tiles = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        if (board[r][c] !== null) tiles.push(board[r][c]);
      }
      if (direction === 'up') {
        for (let i = 0; i < tiles.length; i++) result[i][c] = tiles[i];
      } else {
        const offset = BOARD_SIZE - tiles.length;
        for (let i = 0; i < tiles.length; i++) result[offset + i][c] = tiles[i];
      }
    }
  }
  return result;
}

function wrappedBoardsEqual(a, b) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const av = a[r][c]?.id ?? null;
      const bv = b[r][c]?.id ?? null;
      if (av !== bv) return false;
    }
  }
  return true;
}

// Returns Set<"r,c"> of match coords for the wrapped board.
function findMatchesWrapped(board) {
  return findMatches(typesOf(board));
}

// Returns true if any of 4 tilts would move tiles.
function isGameOverWrapped(board) {
  return isGameOver(typesOf(board));
}

// Spawn into wrapped board: replicate spawnTiles logic but produce { id, type }.
function spawnWrapped(board) {
  const result = board.map(row => row.slice());
  const empties = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (result[r][c] === null) empties.push([r, c]);
    }
  }
  for (let i = empties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empties[i], empties[j]] = [empties[j], empties[i]];
  }
  const toSpawn = Math.min(SPAWN_PER_TURN, empties.length);
  for (let i = 0; i < toSpawn; i++) {
    const [r, c] = empties[i];
    result[r][c] = makeTile(Math.floor(Math.random() * NUM_TYPES));
  }
  return result;
}

async function tilt(direction) {
  if (state.isAnimating || state.isGameOver) return;

  // Step 1: gravity (animated). If nothing moves, abort.
  const afterGravity = gravityWrapped(state.board, direction);
  if (wrappedBoardsEqual(state.board, afterGravity)) return;

  state.isAnimating = true;
  try {
    state.board = afterGravity;
    render();
    await delay(STEP_MS);

    // Step 2: cascade matches
    let multiplier = 1;
    while (true) {
      const matches = findMatchesWrapped(state.board);
      if (matches.size === 0) break;

      // Mark tiles for removal (animation), then actually remove
      for (const key of matches) {
        const [r, c] = key.split(',').map(Number);
        const tile = state.board[r][c];
        if (tile) {
          const el = tileEls.get(tile.id);
          if (el) el.classList.add('removing');
        }
      }
      state.score += scoreForWave(matches.size, multiplier);
      renderScore();
      multiplier++;
      await delay(STEP_MS);

      // Remove from state.board
      for (const key of matches) {
        const [r, c] = key.split(',').map(Number);
        state.board[r][c] = null;
      }
      // Re-apply gravity in same direction
      state.board = gravityWrapped(state.board, direction);
      render();
      await delay(STEP_MS);
    }

    // Step 3: spawn new tiles
    state.board = spawnWrapped(state.board);
    render();
    await delay(STEP_MS);

    // Step 4: check game over
    if (isGameOverWrapped(state.board)) {
      state.isGameOver = true;
      showGameOver();
    }
  } finally {
    state.isAnimating = false;
  }
}

const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const bestMsgEl = document.getElementById('best-msg');
const restartBtn = document.getElementById('restart-btn');

function showGameOver() {
  finalScoreEl.textContent = state.score;
  const isNewRecord = state.score > state.bestScore;
  if (isNewRecord) {
    state.bestScore = state.score;
    saveBest(state.bestScore);
    bestMsgEl.classList.remove('hidden');
  } else {
    bestMsgEl.classList.add('hidden');
  }
  renderScore();
  gameOverEl.classList.remove('hidden');
}

function hideGameOver() {
  gameOverEl.classList.add('hidden');
}

restartBtn.addEventListener('click', () => {
  hideGameOver();
  // Wipe DOM tiles before re-init
  for (const el of tileEls.values()) el.remove();
  tileEls.clear();
  init();
});

// --- Keyboard ---
window.addEventListener('keydown', (e) => {
  const map = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down',
  };
  if (map[e.key]) {
    e.preventDefault();
    tilt(map[e.key]);
  }
});

// --- Direction buttons ---
document.querySelectorAll('.dir-btn').forEach(btn => {
  btn.addEventListener('click', () => tilt(btn.dataset.dir));
});

// --- Swipe on board ---
const SWIPE_THRESHOLD = 30;
let touchStart = null;

boardEl.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

boardEl.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    tilt(dx > 0 ? 'right' : 'left');
  } else {
    tilt(dy > 0 ? 'down' : 'up');
  }
});

// --- Mouse drag (treat like swipe on desktop, optional) ---
let mouseStart = null;
boardEl.addEventListener('mousedown', (e) => {
  mouseStart = { x: e.clientX, y: e.clientY };
});
boardEl.addEventListener('mouseup', (e) => {
  if (!mouseStart) return;
  const dx = e.clientX - mouseStart.x;
  const dy = e.clientY - mouseStart.y;
  mouseStart = null;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    tilt(dx > 0 ? 'right' : 'left');
  } else {
    tilt(dy > 0 ? 'down' : 'up');
  }
});

init();
