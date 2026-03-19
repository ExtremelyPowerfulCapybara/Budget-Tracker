# Skill: Writing Tests for BudgetLog

Use this skill when writing unit tests for core logic.
The app has no test framework installed — tests run with Node.js directly
using a minimal inline harness, or optionally with Jest.

---

## What's Testable

Only pure functions in `js/core/` can be unit tested without a browser:

| File | Testable functions |
|------|-------------------|
| `utils.js` | `MXN()`, `toISODate()`, `parseISODate()`, `addDays()`, `monthKey()`, `entryMonth()`, etc. |
| `selectors.js` | `getMonthTotals()`, `getRecurringOccurrenceDates()`, `applyRecurringForMonth()`, `getForecastTotals()`, `getGoalSavedAmount()` |
| `storage.js` | `normalizeState()`, `createEmptyState()`, `serializeCloudState()` |

**Not unit-testable** without a browser: anything in `js/features/` (DOM rendering),
`cloud.js` (Firebase SDK calls), Chart.js rendering.

---

## Test File Location

Put tests in a `tests/` directory in the repo root:

```
Budget-Tracker/
├── tests/
│   ├── utils.test.js
│   ├── selectors.test.js
│   └── storage.test.js
```

---

## Minimal Test Harness (no dependencies)

Since the modules use `window.BudgetLogCore`, you need to shim `window` in Node:

```js
// tests/setup.js
global.window = { BudgetLogCore: {}, BudgetLogFeatures: {} };

// Load modules — they'll attach to window.BudgetLogCore
const fs = require('fs');
eval(fs.readFileSync('./js/core/utils.js', 'utf8'));
eval(fs.readFileSync('./js/core/selectors.js', 'utf8'));
eval(fs.readFileSync('./js/core/storage.js', 'utf8'));

// Simple test harness
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}
function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertDeepEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
```

---

## Example: Testing selectors.js

```js
// tests/selectors.test.js
require('./setup.js');

const { selectors } = window.BudgetLogCore;
const { utils } = window.BudgetLogCore;

console.log('\nselectors.js');

// --- getMonthTotals ---
test('getMonthTotals returns correct income and expense', () => {
  const entries = [
    { id: '1', type: 'income',  amount: 5000, date: '2025-03-10', category: 'food', description: 'Salario' },
    { id: '2', type: 'expense', amount: 1200, date: '2025-03-15', category: 'food', description: 'Super' },
    { id: '3', type: 'expense', amount: 300,  date: '2025-02-20', category: 'food', description: 'Otro mes' }
  ];
  const result = selectors.getMonthTotals(entries, '2025-03');
  assertEqual(result.income, 5000, 'income');
  assertEqual(result.expense, 1200, 'expense');
  assertEqual(result.net, 3800, 'net');
  assertEqual(result.monthEntries.length, 2, 'only current month entries');
});

// --- getRecurringOccurrenceDates monthly ---
test('monthly recurring generates one date per month', () => {
  const rule = { id: 'r1', frequency: 'monthly', day: 1, anchorDate: '2025-01-01', createdAt: '2025-01-01' };
  const dates = selectors.getRecurringOccurrenceDates(rule, 2025, 2); // March
  assertDeepEqual(dates, ['2025-03-01']);
});

// --- getRecurringOccurrenceDates weekly ---
test('weekly recurring generates correct dates', () => {
  const rule = { id: 'r2', frequency: 'weekly', anchorDate: '2025-03-03', createdAt: '2025-03-03' };
  const dates = selectors.getRecurringOccurrenceDates(rule, 2025, 2); // March (0-indexed)
  assert(dates.includes('2025-03-03'), 'includes anchor');
  assert(dates.includes('2025-03-10'), 'includes +7 days');
  assert(dates.includes('2025-03-17'), 'includes +14 days');
  assert(dates.includes('2025-03-24'), 'includes +21 days');
});

// --- applyRecurringForMonth duplicate prevention ---
test('applyRecurringForMonth does not duplicate existing entries', () => {
  const rule = { id: 'r1', type: 'expense', amount: 1000, description: 'Renta',
    category: 'utilities', frequency: 'monthly', day: 1,
    anchorDate: '2025-01-01', createdAt: '2025-01-01' };
  const existingEntry = {
    id: 'recur_r1_2025-03-01', recurringId: 'r1', recurringDate: '2025-03-01',
    type: 'expense', amount: 1000, description: 'Renta', category: 'utilities', date: '2025-03-01'
  };
  const result = selectors.applyRecurringForMonth([existingEntry], [rule], 2025, 2, '2025-03-31');
  assertEqual(result.count, 0, 'no new entries added');
  assertEqual(result.entries.length, 1, 'total entries unchanged');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
```

Run it:
```powershell
node tests/selectors.test.js
```

---

## Using Jest (Optional, Cleaner)

If the project needs more tests, add Jest:
```powershell
cd D:\GitHub\Budget-Tracker
npm init -y
npm install --save-dev jest
```

Add to `package.json`:
```json
{
  "scripts": { "test": "jest" },
  "jest": { "testEnvironment": "node" }
}
```

Jest test file:
```js
// tests/utils.test.js
global.window = { BudgetLogCore: {} };
const fs = require('fs');
eval(fs.readFileSync('./js/core/utils.js', 'utf8'));
const { utils } = window.BudgetLogCore;

describe('utils.MXN', () => {
  test('formats positive number correctly', () => {
    expect(utils.MXN(1234.56)).toBe('$1,234.56');
  });
  test('formats zero correctly', () => {
    expect(utils.MXN(0)).toBe('$0.00');
  });
});
```

Run: `npm test`

---

## What to Test First (Priority Order)

1. **Recurring logic** — most complex and bug-prone: `getRecurringOccurrenceDates`, `applyRecurringForMonth`, duplicate prevention
2. **Savings goal calculations** — `getGoalSavedAmount`, `getUnassignedSavingsAmount`
3. **State normalization** — `normalizeState` with missing/malformed fields (simulates old users)
4. **Month totals** — `getMonthTotals` with mixed months
5. **Forecast** — `getForecastTotals` matches what the UI would show

---

## Common Mistakes

- **Forgetting to shim `window`** — modules won't attach their namespace and will throw
- **Not loading modules in order** — `selectors.js` requires `utils` to already be on `window.BudgetLogCore`
- **Testing rendering functions** — these require a DOM; skip them, they belong in browser integration tests
- **Month index confusion** — JavaScript months are 0-indexed (0 = January), but `monthKey()` outputs `2025-03` (1-indexed). Tests must match.
