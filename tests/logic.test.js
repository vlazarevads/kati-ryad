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
