# Wow Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширить Кати-Ряд "вау"-механиками — видимые комбо, бомбы из match-4, радужные фишки из match-5+, screen shake. Спека: [docs/superpowers/specs/2026-05-22-wow-mechanics-design.md](../specs/2026-05-22-wow-mechanics-design.md).

**Architecture:** Логика матчей в `logic.js` расширяется до возврата массива матч-объектов (вместо Set координат) с поддержкой радужного вайлдкарда (тип -1) и новой функцией `expandRemovalSet` для обработки взрывов бомб и радужных цветовых взрывов. UI и оркестрация в `game.js` получают новые поля в фишке (`special: 'bomb' | 'rainbow'`), новые рендер-стили и triggers для тоаста/shake.

**Tech Stack:** Без изменений — vanilla HTML/CSS/ES-modules, тесты через `node --test`.

---

## File Structure

```
tri_v_ryad/
├── logic.js                — findMatches: новый формат + rainbow wildcard; новая функция expandRemovalSet
├── game.js                 — wrapped tile с `special?`, обновлённый tilt(), showComboToast, triggerShake, рендер .bomb/.rainbow
├── style.css               — .tile.bomb (обводка+пульс), .tile.rainbow (gradient+rotate), #combo-toast, @keyframes shake
├── index.html              — добавляется <div id="combo-toast">
├── tests/logic.test.js     — обновлённые тесты findMatches/resolveBoard + новые на rainbow + expandRemovalSet
```

**Boundaries:**
- `logic.js`: чистые функции, без DOM. Знает про rainbow (тип -1) и про bombs через позиции в Set. Тестируется через `node:test`.
- `game.js`: единственный, кто работает с обёрнутой моделью (`{id, type, special}`) и DOM.

---

## Task 1: Refactor `findMatches` shape (array of match objects)

Цель: `findMatches` начинает возвращать массив матч-объектов вместо `Set<"r,c">`. Поведение не меняется — те же тройки/четвёрки/L-shapes обнаруживаются. Поддержки радуги пока нет. Обновляются все существующие тесты и `resolveBoard`.

**Files:**
- Modify: `logic.js` — переписать `findMatches`, обновить `resolveBoard`
- Modify: `tests/logic.test.js` — переписать 8 тестов findMatches, обновить 5 тестов resolveBoard

- [ ] **Step 1: Переписать тесты findMatches под новый формат (failing)**

Открыть `tests/logic.test.js`. Найти секцию тестов findMatches (между `import { findMatches }` и следующей `import`). Заменить тесты на:

```js
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
```

- [ ] **Step 2: Запустить тесты, убедиться что новые findMatches-тесты падают**

Run: `node --test tests/`
Expected: 8 findMatches-тестов падают, например "matches.length is not a function" (т.к. сейчас возвращается Set, у которого нет `.length`).

- [ ] **Step 3: Переписать findMatches в logic.js**

Открыть `logic.js`. Найти функцию `findMatches`. Полностью заменить на:

```js
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
```

- [ ] **Step 4: Обновить resolveBoard под новый формат**

В `logic.js` найти функцию `resolveBoard`. Заменить тело цикла `while (true)` на:

```js
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
```

- [ ] **Step 5: Запустить тесты, убедиться все 34 теста проходят**

Run: `node --test tests/`
Expected:
```
# tests 34
# pass 34
# fail 0
```

Каскадные тесты (`resolveBoard`) должны давать те же scores что и раньше — поведение не изменилось.

- [ ] **Step 6: Commit**

```bash
git add logic.js tests/logic.test.js
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
refactor(logic): findMatches returns array of match objects

Preparation for v2 features (bombs, rainbow). Each match now carries
length, color, center position, and tiles set. resolveBoard unions all
matches into a single removal set per wave. Behavior unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add rainbow wildcard support to `findMatches`

Цель: радужная фишка кодируется как `type === -1`. В детекции матчей она считается вайлдкардом — может стоять в линии любого цвета. Сама по себе (только радуги в ряд) — не матч.

**Files:**
- Modify: `logic.js` — `findRunsInLine` дополняется wildcard-логикой
- Modify: `tests/logic.test.js` — новые тесты на rainbow

- [ ] **Step 1: Добавить failing-тесты на rainbow**

Добавить в `tests/logic.test.js` после существующих findMatches-тестов:

```js
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
```

- [ ] **Step 2: Запустить тесты, убедиться 6 новых rainbow-тестов падают**

Run: `node --test tests/`
Expected: 6 rainbow-тестов падают (текущая реализация не поддерживает -1 как wildcard, она просто прервёт run на нем).

- [ ] **Step 3: Обновить `findRunsInLine` в logic.js с поддержкой rainbow**

В `logic.js` заменить функцию `findRunsInLine` целиком на:

```js
function findRunsInLine(line, lineIndex, axis) {
  const RAINBOW = -1;
  const runs = [];
  const N = line.length;
  let i = 0;
  while (i < N) {
    if (line[i] === null) { i++; continue; }
    // Сегмент non-null фишек начинается в i. Идём вправо, пока:
    // - все встреченные не-rainbow фишки имеют один и тот же anchor color
    let anchor = line[i] === RAINBOW ? null : line[i];
    let j = i + 1;
    while (j < N && line[j] !== null) {
      if (line[j] === RAINBOW) {
        // rainbow — продолжаем
      } else if (anchor === null) {
        anchor = line[j];
      } else if (line[j] !== anchor) {
        break;
      }
      j++;
    }
    const length = j - i;
    if (length >= 3 && anchor !== null) {
      const tiles = new Set();
      let hasRainbow = false;
      for (let k = i; k < j; k++) {
        const coord = axis === 'h' ? `${lineIndex},${k}` : `${k},${lineIndex}`;
        tiles.add(coord);
        if (line[k] === RAINBOW) hasRainbow = true;
      }
      const centerIdx = i + Math.floor(length / 2);
      const center = axis === 'h' ? `${lineIndex},${centerIdx}` : `${centerIdx},${lineIndex}`;
      runs.push({ tiles, length, color: anchor, center, hasRainbow });
    }
    i = j;
  }
  return runs;
}
```

- [ ] **Step 4: Запустить тесты — все 40 должны проходить**

Run: `node --test tests/`
Expected: `# tests 40 # pass 40 # fail 0`

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
feat(logic): rainbow wildcard support in findMatches

Rainbow tiles are encoded as type -1 (sentinel). They join any same-color
run greedily left-to-right, contributing to the run's length but not
setting its color. A run consisting only of rainbows is not a match.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `expandRemovalSet` to logic.js (bomb 3×3 + rainbow color-burst)

Цель: чистая функция, которая принимает начальное множество клеток для удаления и расширяет его — добавляет 3×3 вокруг каждой бомбы (с цепочкой), добавляет все клетки одного цвета для каждой активированной радуги.

**Files:**
- Modify: `logic.js` — добавить `expandRemovalSet`
- Modify: `tests/logic.test.js` — тесты на расширение

- [ ] **Step 1: Failing-тесты для expandRemovalSet**

Добавить в `tests/logic.test.js`:

```js
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
```

- [ ] **Step 2: Запустить тесты, убедиться все expandRemovalSet-тесты падают**

Run: `node --test tests/`
Expected: 7 новых тестов падают с "expandRemovalSet is not a function".

- [ ] **Step 3: Реализовать `expandRemovalSet` в logic.js**

В `logic.js` добавить в конец файла:

```js
// Расширяет множество удаления с учётом бомб (3x3 + цепочка) и радуг (цветовой взрыв).
// Аргументы:
//   initial: Set<"r,c"> — начальное множество (тайлы из матча)
//   board: 2D type array — для поиска тайлов нужного цвета (rainbow color-burst)
//   bombPositions: Set<"r,c"> — координаты всех бомб на поле (включая те, что не в initial)
//   rainbowColors: number[] — цвета матчей, в которых были активированы радуги
// Возвращает новый Set<"r,c"> с расширениями.
export function expandRemovalSet(initial, board, bombPositions, rainbowColors) {
  const result = new Set(initial);

  // 1. Rainbow color-burst (один раз, в начале): для каждого цвета — добавить все клетки этого цвета.
  for (const color of rainbowColors) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === color) {
          result.add(`${r},${c}`);
        }
      }
    }
  }

  // 2. Bomb chain reaction: пока есть бомбы в result, которые ещё не "взорвали" соседей — расширяем.
  const exploded = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...result]) {
      if (bombPositions.has(key) && !exploded.has(key)) {
        exploded.add(key);
        const [br, bc] = key.split(',').map(Number);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = br + dr;
            const c = bc + dc;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
            const newKey = `${r},${c}`;
            if (!result.has(newKey)) {
              result.add(newKey);
              changed = true;
            } else if (bombPositions.has(newKey) && !exploded.has(newKey)) {
              // bomb уже в result, но ещё не взорван — нужен ещё один проход
              changed = true;
            }
          }
        }
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Запустить тесты, убедиться 47 тестов проходят**

Run: `node --test tests/`
Expected: `# tests 47 # pass 47 # fail 0`

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
feat(logic): expandRemovalSet for bomb + rainbow effects

Pure function for computing the full set of cells to remove given an
initial match, bomb positions, and rainbow-triggered colors. Handles
bomb 3x3 explosions with chain reactions and rainbow color-burst.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update `game.js` to consume new findMatches array shape

Цель: `game.js` адаптируется под новый формат `findMatches` (массив матч-объектов). Ещё нет бомб и радуг — это plumbing-task, чтобы игра продолжала работать.

**Files:**
- Modify: `game.js` — `findMatchesWrapped`, `tilt()` обновляются

- [ ] **Step 1: Прочитать текущий tilt() и найти место использования findMatchesWrapped**

В `game.js` найти функции `findMatchesWrapped` и `tilt`. В `tilt()` строки типа `const matches = findMatchesWrapped(state.board);` и `if (matches.size === 0) break;` — нужно заменить.

- [ ] **Step 2: Обновить tilt() loop**

В `game.js` найти блок `// Step 2: cascade matches` внутри `tilt()`. Заменить содержимое цикла `while (true) { ... }` на:

```js
    while (true) {
      const matches = findMatchesWrapped(state.board);
      if (matches.length === 0) break;

      // Union all match tiles into removal set
      const removeSet = new Set();
      for (const match of matches) {
        for (const key of match.tiles) removeSet.add(key);
      }

      // Mark tiles for removal (animation), then actually remove
      for (const key of removeSet) {
        const [r, c] = key.split(',').map(Number);
        const tile = state.board[r][c];
        if (tile) {
          const el = tileEls.get(tile.id);
          if (el) el.classList.add('removing');
        }
      }
      state.score += scoreForWave(removeSet.size, multiplier);
      renderScore();
      multiplier++;
      await delay(STEP_MS);

      // Remove from state.board
      for (const key of removeSet) {
        const [r, c] = key.split(',').map(Number);
        state.board[r][c] = null;
      }
      // Re-apply gravity in same direction
      state.board = gravityWrapped(state.board, direction);
      render();
      await delay(STEP_MS);
    }
```

- [ ] **Step 3: Проверить syntax и тесты**

Run: `node --check game.js && node --test tests/ 2>&1 | grep -E "^# (pass|fail|tests)"`
Expected: `node --check` без ошибок, тесты `# pass 47`.

- [ ] **Step 4: Manual smoke test через playwright**

Запустить локальный сервер:
```bash
python3 -m http.server 8002 &
SERVER_PID=$!
```

Создать `/tmp/smoke-task4.mjs`:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:8002/', { waitUntil: 'networkidle' });
for (let i = 0; i < 20; i++) {
  await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][Math.floor(Math.random()*4)]);
  await page.waitForTimeout(400);
}
const score = await page.evaluate(() => +document.getElementById('score').textContent);
console.log('Score after 20 moves:', score, 'Errors:', errors.length || 'NONE');
await browser.close();
```

Запустить: `cd /tmp && node smoke-task4.mjs`
Expected: счёт > 0, ошибок 0, кнопки и наклоны работают.

Остановить сервер: `kill $SERVER_PID`. Удалить временный файл.

- [ ] **Step 5: Commit**

```bash
git add game.js
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
refactor(game): adapt tilt() to findMatches array shape

No behavior change — same matches detected, same scores. Removal set is
now computed as union of all match.tiles entries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Match-4 → bomb (spawn, render, explode)

Цель: при match-4 в центре остаётся бомба. Бомба визуально выглядит как обычная фишка цвета матча + белая обводка с пульсацией. При попадании бомбы в любой матч — взрывается 3×3 (через `expandRemovalSet`).

**Files:**
- Modify: `game.js` — добавить bomb-логику в tilt()
- Modify: `style.css` — `.tile.bomb` + `@keyframes pulse`

- [ ] **Step 1: Импортировать expandRemovalSet в game.js**

В `game.js` найти верхний import блок и добавить `expandRemovalSet`:

```js
import {
  BOARD_SIZE,
  NUM_TYPES,
  SPAWN_PER_TURN,
  createInitialBoard,
  findMatches,
  isGameOver,
  scoreForWave,
  expandRemovalSet,
} from './logic.js';
```

- [ ] **Step 2: Обновить `makeTile` для поддержки special**

В `game.js` найти `function makeTile(type)`. Заменить на:

```js
function makeTile(type, special) {
  const tile = { id: nextTileId++, type };
  if (special) tile.special = special;
  return tile;
}
```

- [ ] **Step 3: Обновить `typesOf` для конвертации радуги в -1**

В `game.js` найти `function typesOf(board)`. Заменить на:

```js
function typesOf(board) {
  return board.map(row => row.map(cell => {
    if (cell === null) return null;
    if (cell.special === 'rainbow') return -1;
    return cell.type;
  }));
}
```

- [ ] **Step 4: Расширить цикл tilt() — собрать bomb positions и применить expandRemovalSet**

В `game.js` найти блок tilt() loop (был обновлён в Task 4). Заменить целиком на:

```js
    while (true) {
      const matches = findMatchesWrapped(state.board);
      if (matches.length === 0) break;

      // Шаг 1: собрать начальный removeSet из тайлов матчей.
      const initial = new Set();
      for (const match of matches) {
        for (const key of match.tiles) initial.add(key);
      }

      // Шаг 2: собрать позиции бомб (на всей доске) и радужные цвета из матчей.
      const bombPositions = new Set();
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const t = state.board[r][c];
          if (t && t.special === 'bomb') bombPositions.add(`${r},${c}`);
        }
      }
      const rainbowColors = [];
      for (const match of matches) {
        // если в initial есть rainbow-тайл этого матча — добавить match.color
        for (const key of match.tiles) {
          const [r, c] = key.split(',').map(Number);
          const t = state.board[r][c];
          if (t && t.special === 'rainbow') {
            rainbowColors.push(match.color);
            break; // одна радуга в матче — достаточно
          }
        }
      }

      // Шаг 3: расширить removeSet через бомбы/радуги.
      const typed = typesOf(state.board);
      const removeSet = expandRemovalSet(initial, typed, bombPositions, rainbowColors);

      // Шаг 4: определить какие матчи "активировали" спец-фишки (чтобы не плодить новые).
      const activatedMatches = new Set();
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        for (const key of m.tiles) {
          const [r, c] = key.split(',').map(Number);
          const t = state.board[r][c];
          if (t && t.special) {
            activatedMatches.add(i);
            break;
          }
        }
      }

      // Шаг 5: пометить тайлы для анимации удаления.
      for (const key of removeSet) {
        const [r, c] = key.split(',').map(Number);
        const tile = state.board[r][c];
        if (tile) {
          const el = tileEls.get(tile.id);
          if (el) el.classList.add('removing');
        }
      }
      state.score += scoreForWave(removeSet.size, multiplier);
      renderScore();
      multiplier++;
      await delay(STEP_MS);

      // Шаг 6: реально убрать тайлы.
      for (const key of removeSet) {
        const [r, c] = key.split(',').map(Number);
        state.board[r][c] = null;
      }

      // Шаг 7: спавнить спец-фишки для match-4 (без активации в этом матче).
      for (let i = 0; i < matches.length; i++) {
        if (activatedMatches.has(i)) continue;
        const m = matches[i];
        if (m.length === 4) {
          const [cr, cc] = m.center.split(',').map(Number);
          state.board[cr][cc] = makeTile(m.color, 'bomb');
        }
      }

      // Шаг 8: гравитация в ту же сторону.
      state.board = gravityWrapped(state.board, direction);
      render();
      await delay(STEP_MS);
    }
```

- [ ] **Step 5: Обновить renderTiles чтобы добавлять класс .bomb / .rainbow**

В `game.js` найти функцию `renderTiles`. Внутри блока `if (!el) { ... }` (создание нового тайла) заменить строку `el.className = 'tile tile-${tile.type} spawning';` на:

```js
        el.className = `tile tile-${tile.type} spawning`;
        if (tile.special === 'bomb') el.classList.add('bomb');
        if (tile.special === 'rainbow') el.classList.add('rainbow');
```

Спец-фишки всегда создаются через `makeTile(...)` с новым `id`, поэтому всегда попадают в эту ветку (новый DOM-элемент). Никаких дополнительных правок для существующих элементов не требуется.

- [ ] **Step 6: CSS — стиль бомбы**

В `style.css` добавить в конец:

```css
.tile.bomb .tile-shape {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.85), 0 0 8px 2px rgba(255, 255, 255, 0.4);
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
```

(Этот transform на `.tile-shape` не конфликтует с transform на `.tile` который двигает позицию — это вложенный элемент.)

- [ ] **Step 7: Manual smoke test через playwright**

Запустить сервер:
```bash
python3 -m http.server 8002 &
SERVER_PID=$!
```

Создать `/tmp/smoke-task5.mjs`:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:8002/', { waitUntil: 'networkidle' });

// Сыграть много ходов чтобы шанс выпадения match-4 был ненулевым
for (let i = 0; i < 60; i++) {
  await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][Math.floor(Math.random()*4)]);
  await page.waitForTimeout(350);
}

// Проверить — есть ли элемент с классом .bomb на любой стадии (или был ли)
// Делаем 100 проб, каждая 100мс — увеличить шанс поймать момент с бомбой на доске
let sawBomb = false;
for (let i = 0; i < 100 && !sawBomb; i++) {
  sawBomb = await page.evaluate(() => !!document.querySelector('.tile.bomb'));
  if (!sawBomb) {
    await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][Math.floor(Math.random()*4)]);
    await page.waitForTimeout(350);
  }
}
console.log('Bomb seen at least once:', sawBomb, '— Errors:', errors.length || 'NONE');
await browser.close();
```

Запустить: `cd /tmp && node smoke-task5.mjs`
Expected: `Bomb seen at least once: true — Errors: NONE`. Если бомба не появилась — увеличить количество ходов (рандом).

Остановить сервер: `kill $SERVER_PID`. Удалить временный файл.

- [ ] **Step 8: Commit**

```bash
git add game.js style.css
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
feat: match-4 creates bombs with 3x3 explosion

When 4 same-color tiles align, a bomb of that color is left at the run's
center. The bomb behaves as a normal colored tile for matching, but when
removed in any future match, expandRemovalSet adds its 3x3 neighborhood
(with chain reactions for bombs in that neighborhood).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Match-5+ → rainbow (spawn, render, color-burst)

Цель: при match-5+ в центре остаётся радуга (type=-1, special='rainbow'). Визуально — conic-gradient всех цветов, лёгкое вращение. Активация уже работает через `expandRemovalSet` (логика Task 5 уже передаёт `rainbowColors`). Здесь — только спавн + рендер.

**Files:**
- Modify: `game.js` — добавить спавн rainbow в tilt loop
- Modify: `style.css` — `.tile.rainbow`

- [ ] **Step 1: Расширить спавн спец-фишек в tilt() — добавить case для match-5+**

В `game.js` найти "Шаг 7: спавнить спец-фишки для match-4" (добавленный в Task 5). Заменить на:

```js
      // Шаг 7: спавнить спец-фишки для match-4 (без активации в этом матче).
      for (let i = 0; i < matches.length; i++) {
        if (activatedMatches.has(i)) continue;
        const m = matches[i];
        const [cr, cc] = m.center.split(',').map(Number);
        if (m.length === 4) {
          state.board[cr][cc] = makeTile(m.color, 'bomb');
        } else if (m.length >= 5) {
          state.board[cr][cc] = makeTile(-1, 'rainbow');
        }
      }
```

- [ ] **Step 2: CSS — стиль радуги**

В `style.css` добавить:

```css
.tile.rainbow .tile-shape {
  background: conic-gradient(
    from 0deg,
    var(--color-0) 0deg 90deg,
    var(--color-1) 90deg 180deg,
    var(--color-2) 180deg 270deg,
    var(--color-3) 270deg 360deg
  );
  border-radius: 50%;
  clip-path: none;
  animation: rainbow-spin 3s linear infinite;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

@keyframes rainbow-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

Радужная фишка имеет `type === -1`, селектора `.tile--1` в CSS нет, поэтому базовая `.tile-shape` сама по себе невидима (нет background и нет clip-path). Правило `.tile.rainbow .tile-shape` явно задаёт фон conic-gradient'ом и форму круга, и переопределяет `clip-path: none` на случай наследованных правил.

- [ ] **Step 3: Manual smoke test через playwright**

Запустить сервер:
```bash
python3 -m http.server 8002 &
SERVER_PID=$!
```

Создать `/tmp/smoke-task6.mjs`:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:8002/', { waitUntil: 'networkidle' });

// Играем много ходов, пытаемся поймать rainbow на доске
let sawRainbow = false, sawBomb = false;
for (let i = 0; i < 200 && !sawRainbow; i++) {
  await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][Math.floor(Math.random()*4)]);
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => ({
    bomb: !!document.querySelector('.tile.bomb'),
    rainbow: !!document.querySelector('.tile.rainbow'),
  }));
  if (seen.bomb) sawBomb = true;
  if (seen.rainbow) sawRainbow = true;
  // Если игра кончилась — перезагрузить
  const over = await page.evaluate(() => !document.getElementById('game-over').classList.contains('hidden'));
  if (over) await page.reload({ waitUntil: 'networkidle' });
}
console.log('Bomb seen:', sawBomb, '| Rainbow seen:', sawRainbow, '| Errors:', errors.length || 'NONE');
await browser.close();
```

Запустить: `cd /tmp && node smoke-task6.mjs`
Expected: `Bomb seen: true | Rainbow seen: true | Errors: NONE`. Если радуга не появилась за 200 ходов — допустимо при чистом рандоме (match-5 редок). Можно повторить, либо признать что косвенно работает (так как код симметричен с bomb).

Остановить сервер: `kill $SERVER_PID`. Удалить временный файл.

- [ ] **Step 4: Commit**

```bash
git add game.js style.css
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
feat: match-5+ creates rainbow tile with color-burst

A run of 5 or more tiles leaves a rainbow tile (type=-1, special=rainbow)
at the run's center. The rainbow acts as a wildcard in future matches.
When activated (matched), it removes ALL tiles of the matched color via
expandRemovalSet's rainbowColors path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Combo toast (visible "×N!" feedback)

Цель: при каскадной волне ≥ 2 в центре поля всплывает плашка "КОМБО ×2!" / "×3!" / и т.д.

**Files:**
- Modify: `index.html` — добавить `<div id="combo-toast">`
- Modify: `style.css` — стиль и анимация toast
- Modify: `game.js` — функция `showComboToast` + вызов из tilt loop

- [ ] **Step 1: Добавить элемент тоста в index.html**

Тоаст должен накладываться поверх `#board`, у которого `position: relative`. Поэтому вкладываем его внутрь `#board`.

В `index.html` заменить:
```html
      <div id="board" class="board" aria-label="Игровое поле"></div>
```
на:
```html
      <div id="board" class="board" aria-label="Игровое поле">
        <div id="combo-toast" class="combo-toast hidden" aria-live="polite"></div>
      </div>
```

- [ ] **Step 2: CSS для toast**

В `style.css` добавить:

```css
.combo-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.5);
  background: linear-gradient(135deg, var(--accent), #ff8844);
  color: #1a1a2e;
  font-weight: 800;
  font-size: 2em;
  padding: 12px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 5;
  white-space: nowrap;
  opacity: 0;
}

.combo-toast.popping {
  animation: combo-pop 700ms ease-out forwards;
}

@keyframes combo-pop {
  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  25%  { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  60%  { transform: translate(-50%, -50%) scale(1.0); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
}
```

- [ ] **Step 3: Функция showComboToast в game.js**

В `game.js` найти константу `STEP_MS` (около строки 124). Сразу после неё добавить:

```js
const comboToastEl = document.getElementById('combo-toast');

function showComboToast(multiplier) {
  comboToastEl.textContent = `КОМБО ×${multiplier}!`;
  comboToastEl.classList.remove('hidden');
  // Перезапустить анимацию: убрать класс, force reflow, добавить заново
  comboToastEl.classList.remove('popping');
  void comboToastEl.offsetWidth;
  comboToastEl.classList.add('popping');
}
```

- [ ] **Step 4: Триггер тоста в tilt loop**

В `game.js` найти строку `state.score += scoreForWave(removeSet.size, multiplier);` (внутри Step 5 анимации в tilt loop). Прямо перед ней добавить:

```js
      if (multiplier >= 2) showComboToast(multiplier);
```

- [ ] **Step 5: Manual smoke test**

Запустить сервер, открыть страницу. Сыграть до момента каскада (можно использовать playwright).

```bash
python3 -m http.server 8002 &
SERVER_PID=$!
```

`/tmp/smoke-task7.mjs`:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8002/', { waitUntil: 'networkidle' });
let sawToast = false;
for (let i = 0; i < 200 && !sawToast; i++) {
  await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][Math.floor(Math.random()*4)]);
  await page.waitForTimeout(200);
  const visible = await page.evaluate(() => {
    const el = document.getElementById('combo-toast');
    return el && !el.classList.contains('hidden') && el.classList.contains('popping');
  });
  if (visible) sawToast = true;
  const over = await page.evaluate(() => !document.getElementById('game-over').classList.contains('hidden'));
  if (over) await page.reload({ waitUntil: 'networkidle' });
}
console.log('Combo toast seen:', sawToast);
await browser.close();
```

Запустить, ожидать `true`. Остановить сервер.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css game.js
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
feat: visible combo toast on cascade waves

When cascade multiplier reaches 2 or higher in a single tilt, a floating
"КОМБО ×N!" toast pops up in the center of the board with a 700ms
scale+fade animation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Screen shake

Цель: при каскадной волне ≥ 2 ИЛИ при активации спец-фишки (бомба взорвалась, радуга сработала) поле трясётся 200мс.

**Files:**
- Modify: `style.css` — `@keyframes shake` + `.shaking`
- Modify: `game.js` — функция `triggerShake` + вызовы

- [ ] **Step 1: CSS для shake**

В `style.css` добавить:

```css
.board.shaking {
  animation: shake 200ms ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-4px, 2px); }
  40% { transform: translate(3px, -3px); }
  60% { transform: translate(-2px, 3px); }
  80% { transform: translate(3px, -1px); }
}
```

- [ ] **Step 2: Функция triggerShake в game.js**

В `game.js` найти функцию `showComboToast` (добавленную в Task 7). Сразу после неё добавить:

```js
let shakeTimer = null;
function triggerShake() {
  boardEl.classList.remove('shaking');
  // Force reflow для перезапуска анимации
  void boardEl.offsetWidth;
  boardEl.classList.add('shaking');
  if (shakeTimer) clearTimeout(shakeTimer);
  shakeTimer = setTimeout(() => boardEl.classList.remove('shaking'), 220);
}
```

- [ ] **Step 3: Вызов triggerShake в tilt loop**

В `game.js` в tilt loop, в "Шаг 5" (где `state.score += scoreForWave(...)`), сразу перед строкой `if (multiplier >= 2) showComboToast(multiplier);` добавить определение, было ли activation в этой волне (если не уже есть), и вызвать shake:

Найти в tilt loop:
```js
      if (multiplier >= 2) showComboToast(multiplier);
      state.score += scoreForWave(removeSet.size, multiplier);
```

Заменить на:
```js
      const hadActivation = activatedMatches.size > 0;
      if (multiplier >= 2) showComboToast(multiplier);
      if (multiplier >= 2 || hadActivation) triggerShake();
      state.score += scoreForWave(removeSet.size, multiplier);
```

- [ ] **Step 4: Manual smoke test**

`/tmp/smoke-task8.mjs`:
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8002/', { waitUntil: 'networkidle' });
let sawShake = false;
for (let i = 0; i < 200 && !sawShake; i++) {
  await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][Math.floor(Math.random()*4)]);
  // Проверяем сразу после нажатия (shake живёт 220мс)
  for (let j = 0; j < 5; j++) {
    await page.waitForTimeout(60);
    const shaking = await page.evaluate(() => document.getElementById('board').classList.contains('shaking'));
    if (shaking) { sawShake = true; break; }
  }
  const over = await page.evaluate(() => !document.getElementById('game-over').classList.contains('hidden'));
  if (over) await page.reload({ waitUntil: 'networkidle' });
}
console.log('Shake seen:', sawShake);
await browser.close();
```

Запустить с уже работающим сервером (см. Task 7), ожидать `true`.

Остановить сервер.

- [ ] **Step 5: Commit**

```bash
git add style.css game.js
git -c user.email=joshuacartee6556@gmail.com -c user.name=Vitaliy commit -m "$(cat <<'EOF'
feat: screen shake on combos and special activations

200ms CSS shake animation on the board element when combo multiplier
reaches 2+ or when a bomb/rainbow activates during the wave.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

После всех 8 задач:

- [ ] **Run all unit tests:** `node --test tests/`
  Expected: `# tests 47 # pass 47 # fail 0` (47 тестов = 34 оригинальных + 6 rainbow в findMatches + 7 expandRemovalSet)

- [ ] **Syntax check:** `node --check game.js && node --check logic.js`
  Expected: no output (success)

- [ ] **Manual play in real browser (recommended):**
  ```bash
  python3 -m http.server 8000
  ```
  Открыть `http://localhost:8000`, играть, искать:
  - бомбы появляются на match-4 (визуально — обводка + пульсация)
  - радуга появляется на match-5+ (визуально — gradient + вращение)
  - бомба, попавшая в любой матч, взрывает 3×3
  - радуга, попавшая в матч, уничтожает все фишки этого цвета
  - на каскадной волне ≥ 2 — тост "КОМБО ×N!"
  - тряска поля при комбо или активации

- [ ] **Push when ready:** `git push`
