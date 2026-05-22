import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, NUM_TYPES } from '../logic.js';

test('module exports basic constants', () => {
  assert.equal(BOARD_SIZE, 6);
  assert.equal(NUM_TYPES, 4);
});

import {
  createEmptyBoard,
  createInitialBoard,
  INITIAL_TILES,
} from '../logic.js';

test('createEmptyBoard returns 6x6 grid of nulls', () => {
  const board = createEmptyBoard();
  assert.equal(board.length, BOARD_SIZE);
  for (const row of board) {
    assert.equal(row.length, BOARD_SIZE);
    for (const cell of row) {
      assert.equal(cell, null);
    }
  }
});

test('createInitialBoard places INITIAL_TILES tiles', () => {
  const board = createInitialBoard();
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  assert.equal(count, INITIAL_TILES);
});

test('createInitialBoard has no horizontal triples', () => {
  const board = createInitialBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c <= BOARD_SIZE - 3; c++) {
      const a = board[r][c];
      const b = board[r][c + 1];
      const d = board[r][c + 2];
      if (a !== null && a === b && b === d) {
        assert.fail(`horizontal triple at row ${r}, col ${c}: ${a}`);
      }
    }
  }
});

test('createInitialBoard has no vertical triples', () => {
  const board = createInitialBoard();
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r <= BOARD_SIZE - 3; r++) {
      const a = board[r][c];
      const b = board[r + 1][c];
      const d = board[r + 2][c];
      if (a !== null && a === b && b === d) {
        assert.fail(`vertical triple at col ${c}, row ${r}: ${a}`);
      }
    }
  }
});

test('createInitialBoard returns different boards on consecutive calls', () => {
  const a = JSON.stringify(createInitialBoard());
  const b = JSON.stringify(createInitialBoard());
  // not strictly guaranteed but extremely likely with 12 random tiles in 36 cells
  assert.notEqual(a, b);
});

import { applyGravity } from '../logic.js';

// helper to build small board for tests (uses BOARD_SIZE constant)
function boardFromRows(rows) {
  // pad rows to BOARD_SIZE with nulls; pad/truncate to BOARD_SIZE rows
  const result = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const src = rows[r] || [];
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(c < src.length ? src[c] : null);
    }
    result.push(row);
  }
  return result;
}

test('applyGravity left pushes tiles to the left', () => {
  const board = boardFromRows([
    [null, 1, null, 2, null, 3],
  ]);
  const moved = applyGravity(board, 'left');
  assert.deepEqual(moved[0], [1, 2, 3, null, null, null]);
});

test('applyGravity right pushes tiles to the right', () => {
  const board = boardFromRows([
    [1, null, 2, null, 3, null],
  ]);
  const moved = applyGravity(board, 'right');
  assert.deepEqual(moved[0], [null, null, null, 1, 2, 3]);
});

test('applyGravity up pushes tiles up', () => {
  const board = createEmptyBoard();
  board[1][0] = 7;
  board[3][0] = 8;
  board[5][0] = 9;
  const moved = applyGravity(board, 'up');
  assert.equal(moved[0][0], 7);
  assert.equal(moved[1][0], 8);
  assert.equal(moved[2][0], 9);
  assert.equal(moved[3][0], null);
});

test('applyGravity down pushes tiles down', () => {
  const board = createEmptyBoard();
  board[0][2] = 7;
  board[2][2] = 8;
  board[4][2] = 9;
  const moved = applyGravity(board, 'down');
  assert.equal(moved[5][2], 9);
  assert.equal(moved[4][2], 8);
  assert.equal(moved[3][2], 7);
  assert.equal(moved[2][2], null);
});

test('applyGravity does not mutate the input board', () => {
  const board = boardFromRows([[null, 1, null]]);
  const snapshot = JSON.stringify(board);
  applyGravity(board, 'left');
  assert.equal(JSON.stringify(board), snapshot);
});

test('applyGravity on empty board returns empty board', () => {
  const board = createEmptyBoard();
  const moved = applyGravity(board, 'left');
  for (const row of moved) {
    for (const cell of row) {
      assert.equal(cell, null);
    }
  }
});

test('applyGravity preserves total tile count', () => {
  const board = createInitialBoard();
  for (const dir of ['left', 'right', 'up', 'down']) {
    const before = board.flat().filter(c => c !== null).length;
    const after = applyGravity(board, dir).flat().filter(c => c !== null).length;
    assert.equal(after, before, `direction ${dir}`);
  }
});

import { findMatches } from '../logic.js';

test('findMatches: empty board → empty array', () => {
  const matches = findMatches(createEmptyBoard());
  assert.deepEqual(matches, []);
});

test('findMatches: horizontal triple returns one match', () => {
  const board = boardFromRows([
    [1, 1, 1, null, null, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 3);
  assert.equal(matches[0].color, 1);
  assert.equal(matches[0].center, '0,1');
  assert.deepEqual([...matches[0].tiles].sort(), ['0,0', '0,1', '0,2']);
  assert.equal(matches[0].hasRainbow, false);
});

test('findMatches: vertical triple returns one match', () => {
  const board = createEmptyBoard();
  board[0][2] = 4;
  board[1][2] = 4;
  board[2][2] = 4;
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 3);
  assert.equal(matches[0].color, 4);
  assert.equal(matches[0].center, '1,2');
  assert.deepEqual([...matches[0].tiles].sort(), ['0,2', '1,2', '2,2']);
});

test('findMatches: 4 in a row, center at index 2', () => {
  const board = boardFromRows([
    [2, 2, 2, 2, null, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 4);
  assert.equal(matches[0].color, 2);
  assert.equal(matches[0].center, '0,2');
});

test('findMatches: 5 in a row, center at index 2', () => {
  const board = boardFromRows([
    [3, 3, 3, 3, 3, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 5);
  assert.equal(matches[0].color, 3);
  assert.equal(matches[0].center, '0,2');
});

test('findMatches: two separate triples on same row', () => {
  const board = boardFromRows([
    [1, 1, 1, 2, 2, 2],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 2);
  const colors = matches.map(m => m.color).sort();
  assert.deepEqual(colors, [1, 2]);
});

test('findMatches: L-shape returns two overlapping matches', () => {
  const board = createEmptyBoard();
  board[0][0] = 3; board[0][1] = 3; board[0][2] = 3;
  board[1][0] = 3; board[2][0] = 3;
  const matches = findMatches(board);
  assert.equal(matches.length, 2);
  const all = new Set();
  for (const m of matches) for (const k of m.tiles) all.add(k);
  assert.deepEqual([...all].sort(), ['0,0', '0,1', '0,2', '1,0', '2,0']);
});

test('findMatches: two in a row → no match', () => {
  const board = boardFromRows([
    [1, 1, null, null, null, null],
  ]);
  assert.deepEqual(findMatches(board), []);
});

test('findMatches: nulls do not form matches', () => {
  assert.deepEqual(findMatches(createEmptyBoard()), []);
});

test('findMatches with rainbow: A R A counts as 3-match color A', () => {
  // -1 — это радуга (wildcard)
  const board = boardFromRows([
    [1, -1, 1, null, null, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 3);
  assert.equal(matches[0].color, 1);
  assert.equal(matches[0].hasRainbow, true);
});

test('findMatches with rainbow: R A A A counts as 4-match color A', () => {
  const board = boardFromRows([
    [-1, 2, 2, 2, null, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 4);
  assert.equal(matches[0].color, 2);
  assert.equal(matches[0].hasRainbow, true);
  assert.deepEqual([...matches[0].tiles].sort(), ['0,0', '0,1', '0,2', '0,3']);
});

test('findMatches with rainbow: A A R B B → splits into two non-matches (greedy left-to-right)', () => {
  // [A, A, R, B, B] — A,A,R = 3-match? Greedy: anchor=A, R extends, B breaks. So [A,A,R] length 3 color A.
  // Then [B,B] length 2 — no match.
  const board = boardFromRows([
    [1, 1, -1, 2, 2, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 3);
  assert.equal(matches[0].color, 1);
  assert.equal(matches[0].hasRainbow, true);
});

test('findMatches with rainbow: only rainbows → not a match', () => {
  const board = boardFromRows([
    [-1, -1, -1, null, null, null],
  ]);
  assert.deepEqual(findMatches(board), []);
});

test('findMatches with rainbow: R A R A R → 5-match color A', () => {
  // Greedy: anchor=null initially (first is R). Then A sets anchor=A. R extends. A matches. R extends. End.
  const board = boardFromRows([
    [-1, 1, -1, 1, -1, null],
  ]);
  const matches = findMatches(board);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].length, 5);
  assert.equal(matches[0].color, 1);
  assert.equal(matches[0].hasRainbow, true);
});

test('findMatches without rainbow: hasRainbow flag is false', () => {
  const board = boardFromRows([[3, 3, 3, null, null, null]]);
  const matches = findMatches(board);
  assert.equal(matches[0].hasRainbow, false);
});

import { resolveBoard, scoreForWave } from '../logic.js';

test('scoreForWave: 3 tiles wave 1 (multiplier 1) → 30', () => {
  assert.equal(scoreForWave(3, 1), 30);
});

test('scoreForWave: 4 tiles wave 2 (multiplier 2) → 80', () => {
  assert.equal(scoreForWave(4, 2), 80);
});

test('scoreForWave: 5 tiles wave 3 (multiplier 3) → 150', () => {
  assert.equal(scoreForWave(5, 3), 150);
});

test('resolveBoard: no movement → moved=false, no score', () => {
  // single tile in corner, tilt towards that corner → no movement
  const board = createEmptyBoard();
  board[0][0] = 1;
  const result = resolveBoard(board, 'left');
  assert.equal(result.moved, false);
  assert.equal(result.score, 0);
  assert.equal(result.waves.length, 0);
});

test('resolveBoard: simple match in one wave', () => {
  // three tiles of same type spaced out, gravity left → they collide, match
  const board = boardFromRows([
    [1, null, 1, null, 1, null],
  ]);
  const result = resolveBoard(board, 'left');
  assert.equal(result.moved, true);
  assert.equal(result.waves.length, 1);
  assert.equal(result.waves[0], 3); // 3 tiles removed in first wave
  assert.equal(result.score, 30); // 3 * 10 * 1
  // board should have no tiles in the result row 0
  for (let c = 0; c < BOARD_SIZE; c++) {
    assert.equal(result.board[0][c], null);
  }
});

test('resolveBoard: 2-wave cascade scores with combo multiplier', () => {
  // Carefully constructed cascade: tilt down on a board where
  //   col 0 has C, B, B, B (top to bottom)
  //   cols 1 and 2 have C at row 5
  // After initial gravity-down:
  //   row 2 col 0 = C, rows 3,4,5 col 0 = B,B,B (vertical triple)
  //   row 5: [B, C, C, ...]
  // Wave 1: 3 B's removed (multiplier 1 → +30)
  // Re-gravity: col 0's surviving C falls to row 5 → row 5 = [C, C, C, ...]
  // Wave 2: 3 C's removed (multiplier 2 → +60)
  // Total: 90
  const board = createEmptyBoard();
  board[0][0] = 2; // C
  board[1][0] = 1; // B
  board[2][0] = 1; // B
  board[3][0] = 1; // B
  board[5][1] = 2; // C
  board[5][2] = 2; // C
  const result = resolveBoard(board, 'down');
  assert.equal(result.moved, true);
  assert.equal(result.waves.length, 2);
  assert.equal(result.waves[0], 3);
  assert.equal(result.waves[1], 3);
  assert.equal(result.score, 90);
});

test('resolveBoard: pre-existing match without movement does NOT trigger (turn ignored)', () => {
  // Three tiles already aligned at the left edge, tilt left → nothing moves
  const board = boardFromRows([
    [1, 1, 1, null, null, null],
  ]);
  const result = resolveBoard(board, 'left');
  assert.equal(result.moved, false);
  // No score, no waves
  assert.equal(result.score, 0);
  assert.equal(result.waves.length, 0);
});

import { spawnTiles, isGameOver, SPAWN_PER_TURN } from '../logic.js';

test('spawnTiles: adds SPAWN_PER_TURN tiles when many empty cells', () => {
  const board = createEmptyBoard();
  const before = board.flat().filter(c => c !== null).length;
  const after = spawnTiles(board).flat().filter(c => c !== null).length;
  assert.equal(after - before, SPAWN_PER_TURN);
});

test('spawnTiles: caps at empty cell count if fewer empties available', () => {
  // fill all but 2 cells
  const board = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = 0;
    }
  }
  board[0][0] = null;
  board[0][1] = null;
  const result = spawnTiles(board);
  const empties = result.flat().filter(c => c === null).length;
  assert.equal(empties, 0); // both spots filled
});

test('spawnTiles: returns board unchanged if no empty cells', () => {
  const board = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = 0;
    }
  }
  const result = spawnTiles(board);
  assert.equal(result.flat().filter(c => c === null).length, 0);
  // total count unchanged
  assert.equal(result.flat().length, board.flat().length);
});

test('spawnTiles: does not mutate input', () => {
  const board = createEmptyBoard();
  const snapshot = JSON.stringify(board);
  spawnTiles(board);
  assert.equal(JSON.stringify(board), snapshot);
});

test('isGameOver: full board, all corners locked → true', () => {
  // Build a fully locked board: alternating types so no triple, all 36 cells filled
  // and no tilt would move anything (already packed in every direction means impossible
  // for a real 2D board — but we can construct a fully filled board and check that no
  // tilt moves tiles AND no match exists)
  const board = createEmptyBoard();
  // Fill with checkerboard-like pattern of 2 types — but that creates pairs not triples
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = (r + c) % 2;
    }
  }
  // A fully filled board where no tilt moves anything is impossible for 2D (gravity packs differently).
  // But it's full, and findMatches detects no triples. Let's just verify isGameOver returns true
  // when ALL 4 tilts don't move the board.
  // Checkerboard board: tilt left moves 0s and 1s — actually they stay put (no gaps).
  // So board is full + no gaps + no matches possible from any tilt → game over.
  assert.equal(isGameOver(board), true);
});

test('isGameOver: board with empty cells → false (at least one tilt moves)', () => {
  const board = createEmptyBoard();
  board[2][2] = 1;
  assert.equal(isGameOver(board), false);
});

import { expandRemovalSet } from '../logic.js';

test('expandRemovalSet: empty initial, no bombs/rainbows → empty', () => {
  const board = createEmptyBoard();
  const result = expandRemovalSet(new Set(), board, new Set(), []);
  assert.equal(result.size, 0);
});

test('expandRemovalSet: no bombs/rainbows → returns initial unchanged', () => {
  const board = createEmptyBoard();
  board[2][2] = 1;
  const initial = new Set(['2,2']);
  const result = expandRemovalSet(initial, board, new Set(), []);
  assert.deepEqual([...result].sort(), ['2,2']);
});

test('expandRemovalSet: bomb in center → adds 3x3 around it', () => {
  const board = createEmptyBoard();
  // Place tiles in 3x3 around (2,2)
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      board[r][c] = 0;
    }
  }
  const initial = new Set(['2,2']);
  const bombs = new Set(['2,2']);
  const result = expandRemovalSet(initial, board, bombs, []);
  // Should include all 9 cells of 3x3 around (2,2)
  const expected = [];
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      expected.push(`${r},${c}`);
    }
  }
  assert.deepEqual([...result].sort(), expected.sort());
});

test('expandRemovalSet: bomb in corner → clamps to board bounds', () => {
  const board = createEmptyBoard();
  const initial = new Set(['0,0']);
  const bombs = new Set(['0,0']);
  const result = expandRemovalSet(initial, board, bombs, []);
  // 3x3 around (0,0) clamped: (0,0), (0,1), (1,0), (1,1)
  assert.deepEqual([...result].sort(), ['0,0', '0,1', '1,0', '1,1']);
});

test('expandRemovalSet: chain reaction when bomb 3x3 contains another bomb', () => {
  const board = createEmptyBoard();
  // Bomb at (0,0). Another bomb at (1,1). Chain: (0,0) explodes 3x3, including (1,1).
  // Then (1,1) explodes 3x3, including (0,0..2,2).
  const initial = new Set(['0,0']);
  const bombs = new Set(['0,0', '1,1']);
  const result = expandRemovalSet(initial, board, bombs, []);
  // Final set: 3x3 around (0,0) + 3x3 around (1,1) = (0,0..2,2) ∪ extras
  // Around (0,0) clamped: (0,0),(0,1),(1,0),(1,1)
  // Around (1,1): (0,0)..(2,2) = all 9 in that block
  // Union: (0,0)..(2,2)
  const expected = [];
  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c <= 2; c++) {
      expected.push(`${r},${c}`);
    }
  }
  assert.deepEqual([...result].sort(), expected.sort());
});

test('expandRemovalSet: rainbow color-burst adds all tiles of that color', () => {
  const board = createEmptyBoard();
  board[0][0] = 1; // color 1
  board[0][5] = 1;
  board[3][2] = 1;
  board[5][5] = 1;
  board[2][2] = 2; // different color, not affected
  const initial = new Set(['1,1']); // rainbow itself is in initial
  const rainbowColors = [1];
  const result = expandRemovalSet(initial, board, new Set(), rainbowColors);
  assert.ok(result.has('1,1'), 'initial preserved');
  assert.ok(result.has('0,0'));
  assert.ok(result.has('0,5'));
  assert.ok(result.has('3,2'));
  assert.ok(result.has('5,5'));
  assert.ok(!result.has('2,2'), 'different-color tile not removed');
});

test('expandRemovalSet: rainbow color-burst triggers bombs in burst', () => {
  // Rainbow triggers color 1. Bomb of color 1 is at (3,3). Bomb's 3x3 should expand.
  const board = createEmptyBoard();
  board[0][0] = 1;
  board[3][3] = 1; // this position is also a bomb
  const initial = new Set(['2,2']); // rainbow position
  const bombs = new Set(['3,3']);
  const rainbowColors = [1];
  const result = expandRemovalSet(initial, board, bombs, rainbowColors);
  // (0,0) added by rainbow. (3,3) added by rainbow → triggers bomb → adds (2,2..4,4) range
  assert.ok(result.has('2,2'));
  assert.ok(result.has('0,0'));
  assert.ok(result.has('3,3'));
  // Bomb at (3,3) explodes 3x3 → adds (2,2)..(4,4)
  for (let r = 2; r <= 4; r++) {
    for (let c = 2; c <= 4; c++) {
      assert.ok(result.has(`${r},${c}`), `expected ${r},${c}`);
    }
  }
});
