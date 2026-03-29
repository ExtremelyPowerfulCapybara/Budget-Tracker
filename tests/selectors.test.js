// Standalone Node.js test — run with: node tests/selectors.test.js
const assert = require('assert');

// Minimal stubs for utils dependencies used inside sanitizeRecurringRule
const utils = {
  toISODate: (d) => d.toISOString().slice(0, 10),
  pad2: (n) => String(n).padStart(2, '0'),
  daysInMonth: (y, m) => new Date(y, m + 1, 0).getDate(),
  parseISODate: (s) => { const d = new Date(s); return isNaN(d) ? null : d; }
};

function sanitizeRecurringRule(rule) {
  const sanitized = { ...rule };
  const amt = parseFloat(sanitized.amount);
  sanitized.amount = isFinite(amt) && amt > 0 ? amt : 0;
  if (sanitized.type !== 'income' && sanitized.type !== 'expense') sanitized.type = 'expense';
  if (!['monthly', 'biweekly', 'weekly'].includes(sanitized.frequency)) sanitized.frequency = 'monthly';
  const day = parseInt(sanitized.day, 10);
  sanitized.day = Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
  const today = utils.toISODate(new Date());
  if (!sanitized.anchorDate) {
    if (sanitized.frequency === 'monthly' && sanitized.day) {
      const date = new Date();
      sanitized.anchorDate = date.getFullYear() + '-' + utils.pad2(date.getMonth() + 1) + '-' + utils.pad2(Math.min(sanitized.day, utils.daysInMonth(date.getFullYear(), date.getMonth())));
    } else {
      sanitized.anchorDate = sanitized.createdAt || today;
    }
  }
  if (!sanitized.day) {
    const anchor = utils.parseISODate(sanitized.anchorDate);
    sanitized.day = anchor ? anchor.getDate() : 1;
  }
  if (!sanitized.createdAt) sanitized.createdAt = sanitized.anchorDate || today;
  return sanitized;
}

// amount coercion
assert.strictEqual(sanitizeRecurringRule({ amount: 'abc', type: 'expense', frequency: 'monthly', day: 1 }).amount, 0, 'string amount → 0');
assert.strictEqual(sanitizeRecurringRule({ amount: NaN, type: 'expense', frequency: 'monthly', day: 1 }).amount, 0, 'NaN amount → 0');
assert.strictEqual(sanitizeRecurringRule({ amount: -5, type: 'expense', frequency: 'monthly', day: 1 }).amount, 0, 'negative amount → 0');
assert.strictEqual(sanitizeRecurringRule({ amount: 0, type: 'expense', frequency: 'monthly', day: 1 }).amount, 0, 'zero amount → 0');
assert.strictEqual(sanitizeRecurringRule({ amount: 100, type: 'expense', frequency: 'monthly', day: 1 }).amount, 100, 'valid amount preserved');
assert.strictEqual(sanitizeRecurringRule({ amount: '50.5', type: 'expense', frequency: 'monthly', day: 1 }).amount, 50.5, 'string number coerced');

// type coercion
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'bogus', frequency: 'monthly', day: 1 }).type, 'expense', 'invalid type → expense');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: undefined, frequency: 'monthly', day: 1 }).type, 'expense', 'undefined type → expense');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'income', frequency: 'monthly', day: 1 }).type, 'income', 'income preserved');

// frequency coercion
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'daily', day: 1 }).frequency, 'monthly', 'invalid freq → monthly');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: undefined, day: 1 }).frequency, 'monthly', 'undefined freq → monthly');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'weekly', day: 1 }).frequency, 'weekly', 'weekly preserved');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'biweekly', day: 1 }).frequency, 'biweekly', 'biweekly preserved');

// day coercion
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'monthly', day: 0 }).day, 1, 'day 0 → 1');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'monthly', day: 32 }).day, 1, 'day 32 → 1');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'monthly', day: 'bad' }).day, 1, 'string day → 1');
assert.strictEqual(sanitizeRecurringRule({ amount: 1, type: 'expense', frequency: 'monthly', day: 15 }).day, 15, 'valid day preserved');

console.log('All sanitizeRecurringRule tests passed ✓');

// createRecurringEntry — inline copy for testing
function createRecurringEntry(rule, date) {
  return {
    id: 'recur_' + rule.id + '_' + date,
    type: rule.type,
    amount: rule.amount,
    description: rule.description,
    category: rule.category,
    date,
    recurringId: rule.id,
    recurringDate: date,
    goalId: rule.goalId || null,
    accountId: rule.accountId || null
  };
}

const baseRule = { id: 'r1', type: 'expense', amount: 100, description: 'Netflix', category: 'entertainment', frequency: 'monthly', day: 1, anchorDate: '2026-03-01', createdAt: '2026-03-01', lastApplied: null, goalId: null };

// sanitizeRecurringRule: accountId pass-through
assert.strictEqual(sanitizeRecurringRule({ ...baseRule, accountId: 'acc1' }).accountId, 'acc1', 'accountId preserved through sanitize');
assert.strictEqual(sanitizeRecurringRule({ ...baseRule, accountId: null }).accountId, null, 'null accountId preserved');
assert.strictEqual(sanitizeRecurringRule({ ...baseRule }).accountId, undefined, 'missing accountId stays missing');

// createRecurringEntry: accountId copied
const entryWithAccount = createRecurringEntry({ ...baseRule, accountId: 'acc1' }, '2026-03-01');
assert.strictEqual(entryWithAccount.accountId, 'acc1', 'accountId copied to generated entry');

const entryNoAccount = createRecurringEntry({ ...baseRule, accountId: null }, '2026-03-01');
assert.strictEqual(entryNoAccount.accountId, null, 'null accountId → null on entry');

const entryMissingAccount = createRecurringEntry({ ...baseRule }, '2026-03-01');
assert.strictEqual(entryMissingAccount.accountId, null, 'missing accountId → null on entry');

console.log('All createRecurringEntry accountId tests passed ✓');
