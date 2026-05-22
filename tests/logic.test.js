import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, NUM_TYPES } from '../logic.js';

test('module exports basic constants', () => {
  assert.equal(BOARD_SIZE, 6);
  assert.equal(NUM_TYPES, 5);
});
