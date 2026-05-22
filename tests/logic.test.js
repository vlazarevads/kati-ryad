import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, NUM_TYPES } from '../logic.js';

test('module exports basic constants', () => {
  assert.equal(BOARD_SIZE, 6);
  assert.equal(NUM_TYPES, 5);
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
