// Standalone Node.js test — run with: node tests/storage.test.js
const assert = require('assert');

const defaultGoals = { food: 0, transport: 0, income: 0 };
const noopSanitize = r => r; // sanitizeRecurringRule stub (not under test here)

// CURRENT (unmodified) normalizeState — no coercions yet.
// Replace this with the final coerced version after Step 3.
function createEmptyState(defaultGoals) {
  return { entries: [], goals: { ...defaultGoals }, recurring: [], savingsGoals: [], customCategories: {} };
}

function normalizeState(rawState, { defaultGoals, sanitizeRecurringRule }) {
  const fallback = createEmptyState(defaultGoals);
  const source = rawState || {};
  const mergedGoals = source.goals && typeof source.goals === 'object'
    ? { ...defaultGoals, ...source.goals }
    : { ...fallback.goals };
  Object.keys(mergedGoals).forEach(k => {
    const v = parseFloat(mergedGoals[k]);
    mergedGoals[k] = isFinite(v) && v >= 0 ? v : 0;
  });
  return {
    entries: Array.isArray(source.entries)
      ? source.entries.map(e => { const amt = parseFloat(e.amount); return { ...e, amount: isFinite(amt) && amt >= 0 ? amt : 0 }; })
      : [],
    goals: mergedGoals,
    recurring: Array.isArray(source.recurring) ? source.recurring.map(sanitizeRecurringRule) : [],
    savingsGoals: Array.isArray(source.savingsGoals) ? source.savingsGoals : [],
    customCategories: source.customCategories && typeof source.customCategories === 'object' ? source.customCategories : {}
  };
}

// entry amount coercion
let state = normalizeState({ entries: [{ amount: 'bad', type: 'expense' }] }, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.strictEqual(state.entries[0].amount, 0, 'string entry amount → 0');

state = normalizeState({ entries: [{ amount: -10, type: 'expense' }] }, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.strictEqual(state.entries[0].amount, 0, 'negative entry amount → 0');

state = normalizeState({ entries: [{ amount: NaN, type: 'expense' }] }, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.strictEqual(state.entries[0].amount, 0, 'NaN entry amount → 0');

state = normalizeState({ entries: [{ amount: 42.5, type: 'expense' }] }, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.strictEqual(state.entries[0].amount, 42.5, 'valid entry amount preserved');

state = normalizeState({ entries: [{ amount: 0, type: 'expense' }] }, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.strictEqual(state.entries[0].amount, 0, 'zero entry amount preserved (valid)');

// goals coercion
state = normalizeState({ goals: { food: 'abc', transport: -5, income: 100 } }, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.strictEqual(state.goals.food, 0, 'string goal → 0');
assert.strictEqual(state.goals.transport, 0, 'negative goal → 0');
assert.strictEqual(state.goals.income, 100, 'valid goal preserved');

// null/missing source gracefully handled
state = normalizeState(null, { defaultGoals, sanitizeRecurringRule: noopSanitize });
assert.deepStrictEqual(state.entries, [], 'null source → empty entries');
assert.deepStrictEqual(state.goals, defaultGoals, 'null source → default goals');

console.log('All normalizeState tests passed ✓');
