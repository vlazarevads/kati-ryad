import {
  BOARD_SIZE,
  createInitialBoard,
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
  state.isAnimating = false;
  state.isGameOver = false;
  render();
}

init();
