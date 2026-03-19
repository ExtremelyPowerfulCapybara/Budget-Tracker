# Validation & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining two `esc()` gaps, make forecast math NaN-proof, and enforce valid amounts/dates at every save path.

**Architecture:** Three independent layers of fixes applied in order: (1) two-line escaping additions to existing render functions, (2) coercion guards inserted at the top of `sanitizeRecurringRule` and inside `normalizeState`, (3) per-field validation replacing or strengthening the existing combined guards in the five `index.html` save functions. Escaping is at render time; coercion is at load/normalize time; validation is at save time.

**Tech Stack:** Vanilla JS (IIFE modules, no bundler). Node.js for unit tests (standalone function copies, same pattern as `tests/escapeHtml.test.js`).

**Spec:** `docs/superpowers/specs/2026-03-18-validation-hardening-design.md`

---

## File Map

| File | Change |
|------|--------|
| `js/features/category-customization.js` | Add `esc()` to two attributes in `renderColorPickerMarkup` |
| `js/features/selection-ui.js` | Add `esc()` to `frequency.label` in `renderFrequencyGridMarkup` |
| `js/core/selectors.js` | Add coercion block at top of `sanitizeRecurringRule` |
| `js/core/storage.js` | Coerce entry amounts and goals values in `normalizeState` |
| `index.html` | Harden `logEntry`, `saveEdit`, `saveSavingsGoal`, `saveGoals` |
| `tests/selectors.test.js` | New — Node.js tests for `sanitizeRecurringRule` hardening |
| `tests/storage.test.js` | New — Node.js tests for `normalizeState` coercions |

---

## Task 1: Fix `renderColorPickerMarkup` — escape palette color values

**File:** `js/features/category-customization.js:21-25`

`esc` is already defined at line 3. `renderColorPickerMarkup` at line 21 injects `color` raw into two attributes.

- [ ] **Step 1: Locate the unescaped line**

Read `js/features/category-customization.js`. Find line 23 inside `renderColorPickerMarkup`:
```js
return `<div class="cp-swatch${selectedColor===color?' active':''}" data-palette-color="${color}" style="background:${color}"></div>`;
```

- [ ] **Step 2: Apply the fix**

Change to:
```js
return `<div class="cp-swatch${selectedColor===color?' active':''}" data-palette-color="${esc(color)}" style="background:${esc(color)}"></div>`;
```

- [ ] **Step 3: Verify no other raw `color` injections in this file**

Search the file for any remaining template literal `${color}` or `'+color+'` that appear inside HTML strings. There should be none after this fix.

- [ ] **Step 4: Commit**

```bash
git add js/features/category-customization.js
git commit -m "fix: escape colors in category color picker markup"
```

---

## Task 2: Fix `renderFrequencyGridMarkup` — escape `frequency.label`

**File:** `js/features/selection-ui.js:14-18`

`esc` is already defined at line 3. `renderFrequencyGridMarkup` at line 14 injects `frequency.label` raw into button text.

- [ ] **Step 1: Locate the unescaped line**

Read `js/features/selection-ui.js`. Find line 16 inside `renderFrequencyGridMarkup`:
```js
return '<button class="freq-btn'+(selectedId===frequency.id?' active':'')+'" data-selection-action="freq" data-selection-id="'+frequency.id+'">'+frequency.label+'</button>';
```

- [ ] **Step 2: Apply the fix**

Change only `frequency.label` (leave `frequency.id` as-is — it comes from the hardcoded `FREQUENCIES` config constant):
```js
return '<button class="freq-btn'+(selectedId===frequency.id?' active':'')+'" data-selection-action="freq" data-selection-id="'+frequency.id+'">'+esc(frequency.label)+'</button>';
```

- [ ] **Step 3: Commit**

```bash
git add js/features/selection-ui.js
git commit -m "fix: escape frequency label in frequency grid markup"
```

---

## Task 3: Harden `sanitizeRecurringRule` in `selectors.js`

**File:** `js/core/selectors.js:16-33`

The current function does not validate `amount`, `type`, `frequency`, or `day`. Bad values from Firestore propagate to `getForecastTotals` and produce silent NaN.

- [ ] **Step 1: Write the test file (with the CURRENT unmodified function — no coercions yet)**

Create `tests/selectors.test.js`. The inline function copy starts WITHOUT the coercions so the test genuinely fails before Step 3. You will update the copy in Step 4 after implementing.

```js
// Standalone Node.js test — run with: node tests/selectors.test.js
const assert = require('assert');

// Minimal stubs for utils dependencies used inside sanitizeRecurringRule
const utils = {
  toISODate: (d) => d.toISOString().slice(0, 10),
  pad2: (n) => String(n).padStart(2, '0'),
  daysInMonth: (y, m) => new Date(y, m + 1, 0).getDate(),
  parseISODate: (s) => { const d = new Date(s); return isNaN(d) ? null : d; }
};

// CURRENT (unmodified) copy of sanitizeRecurringRule — coercions not yet added.
// After Step 3 (implement in source), replace this with the coerced version.
function sanitizeRecurringRule(rule) {
  const sanitized = { ...rule };
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
```

- [ ] **Step 2: Run the test — it should FAIL (coercions not yet added to source)**

```
node tests/selectors.test.js
```

Expected: AssertionError (e.g., `'abc' amount not 0`)

- [ ] **Step 3: Add coercions to `sanitizeRecurringRule` in `js/core/selectors.js`**

Insert these lines at the very top of `sanitizeRecurringRule`, immediately after `const sanitized={...rule};`:

```js
  const amt=parseFloat(sanitized.amount);
  sanitized.amount=isFinite(amt)&&amt>0?amt:0;
  if(sanitized.type!=='income'&&sanitized.type!=='expense')sanitized.type='expense';
  if(!['monthly','biweekly','weekly'].includes(sanitized.frequency))sanitized.frequency='monthly';
  const day=parseInt(sanitized.day,10);
  sanitized.day=Number.isInteger(day)&&day>=1&&day<=31?day:1;
```

The final function should look like:
```js
  function sanitizeRecurringRule(rule){
    const sanitized={...rule};
    const amt=parseFloat(sanitized.amount);
    sanitized.amount=isFinite(amt)&&amt>0?amt:0;
    if(sanitized.type!=='income'&&sanitized.type!=='expense')sanitized.type='expense';
    if(!['monthly','biweekly','weekly'].includes(sanitized.frequency))sanitized.frequency='monthly';
    const day=parseInt(sanitized.day,10);
    sanitized.day=Number.isInteger(day)&&day>=1&&day<=31?day:1;
    const today=utils.toISODate(new Date());
    if(!sanitized.anchorDate){
      if(sanitized.frequency==='monthly'&&sanitized.day){
        const date=new Date();
        sanitized.anchorDate=date.getFullYear()+'-'+utils.pad2(date.getMonth()+1)+'-'+utils.pad2(Math.min(sanitized.day,utils.daysInMonth(date.getFullYear(),date.getMonth())));
      }else{
        sanitized.anchorDate=sanitized.createdAt||today;
      }
    }
    if(!sanitized.day){
      const anchor=utils.parseISODate(sanitized.anchorDate);
      sanitized.day=anchor?anchor.getDate():1;
    }
    if(!sanitized.createdAt)sanitized.createdAt=sanitized.anchorDate||today;
    return sanitized;
  }
```

Note: the existing `if(!sanitized.day)` block at the bottom still runs but is now a no-op for valid rules because `sanitized.day` is already guaranteed to be 1–31 from the coercion above.

- [ ] **Step 4: Update the inline function copy in `tests/selectors.test.js`**

Replace the `sanitizeRecurringRule` function body in the test file with the final coerced version:

```js
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
```

- [ ] **Step 5: Run tests — should pass**

```
node tests/selectors.test.js
```

Expected: `All sanitizeRecurringRule tests passed ✓`

- [ ] **Step 6: Commit**

```bash
git add js/core/selectors.js tests/selectors.test.js
git commit -m "fix: coerce amount/type/frequency/day in sanitizeRecurringRule"
```

---

## Task 4: Harden `normalizeState` in `storage.js`

**File:** `js/core/storage.js:22-32`

Currently entries pass through with no amount coercion, and goals values are spread raw from Firestore.

- [ ] **Step 1: Write the test file**

Create `tests/storage.test.js`:

```js
// Standalone Node.js test — run with: node tests/storage.test.js
const assert = require('assert');

const defaultGoals = { food: 0, transport: 0, income: 0 };
const noopSanitize = r => r; // sanitizeRecurringRule stub (not under test here)

// Copy of normalizeState WITH the new coercions (paste final version after implementing)
function normalizeState(rawState, { defaultGoals, sanitizeRecurringRule }) {
  const source = rawState || {};
  const mergedGoals = source.goals && typeof source.goals === 'object'
    ? { ...defaultGoals, ...source.goals }
    : { ...defaultGoals };
  Object.keys(mergedGoals).forEach(k => {
    const v = parseFloat(mergedGoals[k]);
    mergedGoals[k] = isFinite(v) && v >= 0 ? v : 0;
  });
  return {
    entries: Array.isArray(source.entries)
      ? source.entries.map(e => {
          const amt = parseFloat(e.amount);
          return { ...e, amount: isFinite(amt) && amt >= 0 ? amt : 0 };
        })
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
```

- [ ] **Step 2: Run the test — it should FAIL**

```
node tests/storage.test.js
```

Expected: AssertionError (coercions not yet in source)

- [ ] **Step 3: Update `normalizeState` in `js/core/storage.js`**

Replace the `entries` and `goals` lines in `normalizeState`. The full updated function:

```js
  function normalizeState(rawState,{defaultGoals,sanitizeRecurringRule}){
    const fallback=createEmptyState(defaultGoals);
    const source=rawState||{};
    const mergedGoals=source.goals&&typeof source.goals==='object'
      ?{...defaultGoals,...source.goals}
      :{...fallback.goals};
    Object.keys(mergedGoals).forEach(k=>{
      const v=parseFloat(mergedGoals[k]);
      mergedGoals[k]=isFinite(v)&&v>=0?v:0;
    });
    return {
      entries:Array.isArray(source.entries)
        ?source.entries.map(e=>{const amt=parseFloat(e.amount);return{...e,amount:isFinite(amt)&&amt>=0?amt:0};})
        :[],
      goals:mergedGoals,
      recurring:Array.isArray(source.recurring)?source.recurring.map(sanitizeRecurringRule):[],
      savingsGoals:Array.isArray(source.savingsGoals)?source.savingsGoals:[],
      customCategories:source.customCategories&&typeof source.customCategories==='object'?source.customCategories:{}
    };
  }
```

- [ ] **Step 4: Run tests — should pass**

```
node tests/storage.test.js
```

Expected: `All normalizeState tests passed ✓`

- [ ] **Step 5: Run previous tests to confirm no regressions**

```
node tests/escapeHtml.test.js && node tests/selectors.test.js && node tests/storage.test.js
```

Expected: all three print their `✓` lines.

- [ ] **Step 6: Commit**

```bash
git add js/core/storage.js tests/storage.test.js
git commit -m "fix: coerce entry amounts and goals values in normalizeState"
```

---

## Task 5: UI input validation in `index.html`

**File:** `index.html` — four save functions on lines 835, 837, 854, 969.

Note: `addRecurring` (line 845) already validates amount correctly (`if(!amount||amount<=0)`) and its toast message matches the spec — **no change needed for `addRecurring`**.

- [ ] **Step 1: Locate all four functions**

Search `index.html` for:
- `function logEntry(` — line ~835
- `function saveGoals(` — line ~837
- `function saveEdit(` — line ~854
- `function saveSavingsGoal(` — line ~969

- [ ] **Step 2: Harden `logEntry`**

First, read the actual `logEntry` function in `index.html` around line 835 to confirm the exact guard syntax before editing. The function is minified on one line — copy it to a text editor to read clearly.

The existing date guard `if(!date){showToast('Elige una fecha');return;}` only checks for empty. Replace it with a regex guard that also catches malformed dates, and update the toast message:

Find:
```js
if(!date){showToast('Elige una fecha');return;}
```

Replace with:
```js
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){showToast('Selecciona una fecha v\u00e1lida');return;}
```

The amount guard `if(!amount||amount<=0)` is already correct — leave it untouched.

- [ ] **Step 3: Harden `saveEdit`**

The existing guard `if(!amount||!desc||!date){showToast('Llena todos los campos');return;}` uses a single combined check. Replace with per-field guards:

Find:
```js
if(!amount||!desc||!date){showToast('Llena todos los campos');return;}
```

Replace with:
```js
if(!isFinite(amount)||amount<=0){showToast('Ingresa un monto v\u00e1lido');return;}
if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){showToast('Selecciona una fecha v\u00e1lida');return;}
```

Note: description empty-check (`!desc`) is deliberately removed — per spec, empty descriptions are allowed at save time.

- [ ] **Step 4: Update `saveSavingsGoal` toast message**

Find:
```js
if(!name){showToast('Agrega un nombre');return;}
```

Replace with:
```js
if(!name){showToast('Ingresa un nombre para la meta');return;}
```

Before leaving the target guard untouched, verify its toast message. Read the actual `saveSavingsGoal` function in `index.html` and confirm the toast for the target field is already `'Ingresa una meta válida'`. If it says something different, update it to match. If it already matches, leave it.

- [ ] **Step 5: Harden `saveGoals` negative clamping**

The current `parseFloat(...)||0` silently turns NaN into 0 but allows negatives through. Replace:

Find:
```js
function saveGoals(){[{id:'income'},...CATEGORIES].forEach(c=>{goals[c.id]=parseFloat(document.getElementById('goal_'+c.id).value)||0;});save();showToast('Metas guardadas');}
```

Replace with:
```js
function saveGoals(){[{id:'income'},...CATEGORIES].forEach(c=>{const v=parseFloat(document.getElementById('goal_'+c.id).value);goals[c.id]=isFinite(v)&&v>=0?v:0;});save();showToast('Metas guardadas');}
```

Note: `c.id` is NOT escaped in the `getElementById` call — `getElementById` receives the raw string and matches the decoded DOM attribute value. Using `esc(c.id)` here would break the lookup if any id contains `&` or `<`.

- [ ] **Step 6: Manual verification**

Open the app in a browser (`firebase serve` or open `index.html` directly). Test each save path:

1. **logEntry:** Enter a letter in the amount field → toast `"Ingresa un monto válido"`. Enter a valid amount but type `not-a-date` in the date field → toast `"Selecciona una fecha válida"`.
2. **saveEdit:** Open edit modal for an entry, clear the amount field → toast `"Ingresa un monto válido"`. Clear the date → toast `"Selecciona una fecha válida"`.
3. **saveSavingsGoal:** Open savings goal modal, leave name empty → toast `"Ingresa un nombre para la meta"` (previously was `"Agrega un nombre"`).
4. **saveGoals:** Not easily testable manually — the UI uses number inputs which browsers constrain. The code change is verified by reading.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "fix: harden logEntry, saveEdit, saveSavingsGoal, saveGoals validation"
```

---

## Task 6: Run all tests and verify

- [ ] **Step 1: Run the full test suite**

```
node tests/escapeHtml.test.js && node tests/selectors.test.js && node tests/storage.test.js
```

Expected output:
```
All escapeHtml tests passed ✓
All sanitizeRecurringRule tests passed ✓
All normalizeState tests passed ✓
```

- [ ] **Step 2: Check git log**

```
git log --oneline -6
```

Expected: 5 new commits on top of the previous XSS fix commits.
