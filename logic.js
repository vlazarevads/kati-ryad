// Pure game logic. No DOM access here.
// Exported functions: createEmptyBoard, createInitialBoard,
// applyGravity, findMatches, resolveBoard, spawnTiles, isGameOver,
// scoreForWave.

export const BOARD_SIZE = 6;
export const NUM_TYPES = 5;
export const INITIAL_TILES = 12;
export const SPAWN_PER_TURN = 3;

export function createEmptyBoard() {
  const board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function hasAnyTriple(board) {
  // horizontal
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c <= BOARD_SIZE - 3; c++) {
      const a = board[r][c];
      if (a !== null && a === board[r][c + 1] && a === board[r][c + 2]) {
        return true;
      }
    }
  }
  // vertical
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r <= BOARD_SIZE - 3; r++) {
      const a = board[r][c];
      if (a !== null && a === board[r + 1][c] && a === board[r + 2][c]) {
        return true;
      }
    }
  }
  return false;
}

export function createInitialBoard() {
  // Try generations until we get one without triples. Almost always works first try.
  for (let attempt = 0; attempt < 100; attempt++) {
    const board = createEmptyBoard();
    const cells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        cells.push([r, c]);
      }
    }
    // Shuffle cells, take first INITIAL_TILES.
    for (let i = cells.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (let i = 0; i < INITIAL_TILES; i++) {
      const [r, c] = cells[i];
      board[r][c] = randInt(NUM_TYPES);
    }
    if (!hasAnyTriple(board)) return board;
  }
  throw new Error('createInitialBoard: failed to generate non-triple board after 100 attempts');
}

// Returns a new board with all non-null tiles pushed to the given side.
export function applyGravity(board, direction) {
  const result = createEmptyBoard();

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
  } else if (direction === 'up' || direction === 'down') {
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
  } else {
    throw new Error(`applyGravity: unknown direction "${direction}"`);
  }

  return result;
}
