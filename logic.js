// Pure game logic. No DOM access here.
// Exported functions: createEmptyBoard, createInitialBoard,
// applyGravity, findMatches, resolveBoard, spawnTiles, isGameOver,
// scoreForWave.

export const BOARD_SIZE = 6;
export const NUM_TYPES = 4;
export const INITIAL_TILES = 12;
export const SPAWN_PER_TURN = 2;

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

// Helper: scan a single line (row or column) for runs of length >= 3.
// `line` — массив значений (type | null), `lineIndex` — индекс линии,
// `axis` — 'h' для строки, 'v' для столбца. Возвращает массив матч-объектов.
function findRunsInLine(line, lineIndex, axis) {
  const runs = [];
  const N = line.length;
  let i = 0;
  while (i < N) {
    if (line[i] === null) { i++; continue; }
    const anchor = line[i];
    let j = i + 1;
    while (j < N && line[j] === anchor) j++;
    const length = j - i;
    if (length >= 3) {
      const tiles = new Set();
      for (let k = i; k < j; k++) {
        const coord = axis === 'h' ? `${lineIndex},${k}` : `${k},${lineIndex}`;
        tiles.add(coord);
      }
      const centerIdx = i + Math.floor(length / 2);
      const center = axis === 'h' ? `${lineIndex},${centerIdx}` : `${centerIdx},${lineIndex}`;
      runs.push({ tiles, length, color: anchor, center, hasRainbow: false });
    }
    i = j;
  }
  return runs;
}

// Returns Array<{ tiles: Set<"r,c">, length, color, center, hasRainbow }>
// hasRainbow всегда false на этом этапе — добавим поддержку wildcard в Task 2.
export function findMatches(board) {
  const matches = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    matches.push(...findRunsInLine(board[r], r, 'h'));
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    const column = [];
    for (let r = 0; r < BOARD_SIZE; r++) column.push(board[r][c]);
    matches.push(...findRunsInLine(column, c, 'v'));
  }
  return matches;
}

export function scoreForWave(tilesRemoved, multiplier) {
  return 10 * tilesRemoved * multiplier;
}

// Helper: deep-compare two boards.
function boardsEqual(a, b) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

// One full tilt. Returns:
//   { moved: bool, board: newBoard, score: int, waves: [tilesRemoved per wave] }
// If initial gravity does not move anything, returns { moved: false, board, score: 0, waves: [] }.
export function resolveBoard(board, direction) {
  const afterGravity = applyGravity(board, direction);
  if (boardsEqual(board, afterGravity)) {
    return { moved: false, board, score: 0, waves: [] };
  }

  let current = afterGravity;
  const waves = [];
  let score = 0;
  let multiplier = 1;

  while (true) {
    const matches = findMatches(current);
    if (matches.length === 0) break;
    // Union all match tiles into removal set
    const removeSet = new Set();
    for (const match of matches) {
      for (const key of match.tiles) removeSet.add(key);
    }
    const next = current.map(row => row.slice());
    for (const key of removeSet) {
      const [r, c] = key.split(',').map(Number);
      next[r][c] = null;
    }
    waves.push(removeSet.size);
    score += scoreForWave(removeSet.size, multiplier);
    multiplier++;
    current = applyGravity(next, direction);
  }

  return { moved: true, board: current, score, waves };
}

export function spawnTiles(board) {
  const result = board.map(row => row.slice());
  const empties = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (result[r][c] === null) empties.push([r, c]);
    }
  }
  // shuffle
  for (let i = empties.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [empties[i], empties[j]] = [empties[j], empties[i]];
  }
  const toSpawn = Math.min(SPAWN_PER_TURN, empties.length);
  for (let i = 0; i < toSpawn; i++) {
    const [r, c] = empties[i];
    result[r][c] = randInt(NUM_TYPES);
  }
  return result;
}

export function isGameOver(board) {
  // No tilt in any of 4 directions moves a single tile → game over.
  for (const dir of ['left', 'right', 'up', 'down']) {
    const moved = applyGravity(board, dir);
    if (!boardsEqual(board, moved)) return false;
  }
  return true;
}
