# Multi-Tab Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent silent data loss when BudgetLog is open in multiple browser tabs by syncing in-memory state via `storage` events whenever another tab saves.

**Architecture:** Two changes to `index.html` only. First, the `save()` debounce callback is updated to null out `syncTimeout` after it fires (required for the guard in Change 2 to work correctly). Second, a `window.addEventListener('storage', ...)` listener is added that, when another tab writes to localStorage, re-reads the full state via `readLocalState` and re-applies it — skipping only if the current tab has its own unsaved changes in-flight or is on the auth screen.

**Tech Stack:** Vanilla JS, browser `storage` event API, existing `readLocalState` / `applyState` / render functions already in `index.html`.

---

## Files

| File | Change |
|------|--------|
| `index.html` | Modify `save()` (line 811); add `storage` event listener after `auth.onAuthStateChanged` block |
| `tests/multi-tab-sync.test.js` | New: unit tests for listener guard logic |

---

### Task 1: Write tests for the listener guard logic

These tests verify the three guard conditions in the listener: `currentUser` null, `syncTimeout` set, and the happy path. The listener logic will be extracted into a standalone function in the test so it can be called without a real browser environment.

**Files:**
- Create: `tests/multi-tab-sync.test.js`

- [ ] **Step 1: Create the test file with the listener logic copy**

Create `tests/multi-tab-sync.test.js` with this content:

```js
// Standalone Node.js test — run with: node tests/multi-tab-sync.test.js
const assert = require('assert');

// ── Stubs ──────────────────────────────────────────────────────────────────
const DEFAULT_GOALS = { food: 0, transport: 0, income: 0 };

function createEmptyState(defaultGoals) {
  return { entries: [], goals: { ...defaultGoals }, recurring: [], savingsGoals: [], customCategories: {} };
}

function normalizeState(rawState, { defaultGoals, sanitizeRecurringRule }) {
  const source = rawState || {};
  return {
    entries: Array.isArray(source.entries) ? source.entries : [],
    goals: source.goals && typeof source.goals === 'object'
      ? { ...defaultGoals, ...source.goals }
      : { ...defaultGoals },
    recurring: Array.isArray(source.recurring) ? source.recurring.map(sanitizeRecurringRule) : [],
    savingsGoals: Array.isArray(source.savingsGoals) ? source.savingsGoals : [],
    customCategories: source.customCategories && typeof source.customCategories === 'object'
      ? source.customCategories
      : {}
  };
}

// Stub readLocalState — reads from a fake localStorage object
function makeReadLocalState(fakeStorage) {
  return function readLocalState({ defaultGoals, sanitizeRecurringRule }) {
    return normalizeState({
      entries: JSON.parse(fakeStorage['bl_entries'] || '[]'),
      goals: JSON.parse(fakeStorage['bl_goals'] || 'null'),
      recurring: JSON.parse(fakeStorage['bl_recurring'] || '[]'),
      savingsGoals: JSON.parse(fakeStorage['bl_savings'] || '[]'),
      customCategories: JSON.parse(fakeStorage['bl_catcustom'] || '{}')
    }, { defaultGoals, sanitizeRecurringRule });
  };
}

// ── Listener logic (UNMODIFIED — copy from index.html after implementing) ──
// Replace this stub with the actual handler body after Step 3 in Task 2.
function makeStorageHandler({ getCurrentUser, getSyncTimeout, readLocalState, applyState, applyCustomCategories, resetCategorySelections, renderDashboard, renderEntries, renderRecurring, renderGoals }) {
  return function storageHandler(e) {
    // STUB: replace with real implementation after Task 2
    void e;
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (err) { console.error('  ✗', name, '\n   ', err.message); failed++; }
}

function makeMocks(overrides = {}) {
  const calls = { applyState: [], applyCustomCategories: 0, resetCategorySelections: 0, renderDashboard: 0, renderEntries: 0, renderRecurring: 0, renderGoals: 0 };
  const fakeStorage = { 'bl_entries': JSON.stringify([{ id: '1', amount: 10 }]), 'bl_goals': 'null', 'bl_recurring': '[]', 'bl_savings': '[]', 'bl_catcustom': '{}' };
  return {
    calls,
    handler: makeStorageHandler({
      getCurrentUser: overrides.getCurrentUser ?? (() => ({ uid: 'u1' })),
      getSyncTimeout: overrides.getSyncTimeout ?? (() => null),
      readLocalState: makeReadLocalState(fakeStorage),
      applyState: (s) => calls.applyState.push(s),
      applyCustomCategories: () => calls.applyCustomCategories++,
      resetCategorySelections: () => calls.resetCategorySelections++,
      renderDashboard: () => calls.renderDashboard++,
      renderEntries: () => calls.renderEntries++,
      renderRecurring: () => calls.renderRecurring++,
      renderGoals: () => calls.renderGoals++,
    })
  };
}

console.log('\nStorage event listener guard tests:');

test('skips if e.key is not bl_entries', () => {
  const { calls, handler } = makeMocks();
  handler({ key: 'bl_goals', newValue: '{}' });
  assert.strictEqual(calls.applyState.length, 0, 'applyState should not be called');
});

test('skips if e.newValue is null', () => {
  const { calls, handler } = makeMocks();
  handler({ key: 'bl_entries', newValue: null });
  assert.strictEqual(calls.applyState.length, 0, 'applyState should not be called');
});

test('skips if currentUser is null', () => {
  const { calls, handler } = makeMocks({ getCurrentUser: () => null });
  handler({ key: 'bl_entries', newValue: '[]' });
  assert.strictEqual(calls.applyState.length, 0, 'applyState should not be called');
});

test('skips if syncTimeout is set', () => {
  const { calls, handler } = makeMocks({ getSyncTimeout: () => 42 });
  handler({ key: 'bl_entries', newValue: '[]' });
  assert.strictEqual(calls.applyState.length, 0, 'applyState should not be called');
});

test('calls applyState and all renders on valid event', () => {
  const { calls, handler } = makeMocks();
  handler({ key: 'bl_entries', newValue: '[{"id":"1","amount":10}]' });
  assert.strictEqual(calls.applyState.length, 1, 'applyState called once');
  assert.strictEqual(calls.applyCustomCategories, 1);
  assert.strictEqual(calls.resetCategorySelections, 1);
  assert.strictEqual(calls.renderDashboard, 1);
  assert.strictEqual(calls.renderEntries, 1);
  assert.strictEqual(calls.renderRecurring, 1);
  assert.strictEqual(calls.renderGoals, 1);
});

test('applyState receives full normalized state object', () => {
  const { calls, handler } = makeMocks();
  handler({ key: 'bl_entries', newValue: '[{"id":"1","amount":10}]' });
  const state = calls.applyState[0];
  assert.ok(state && typeof state === 'object', 'state is an object');
  assert.ok(Array.isArray(state.entries), 'state.entries is array');
  assert.ok(typeof state.goals === 'object', 'state.goals is object');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails (the handler is a stub)**

```bash
node tests/multi-tab-sync.test.js
```

Expected: FAIL on "calls applyState and all renders on valid event" and "applyState receives full normalized state object" — the stub handler does nothing.

---

### Task 2: Implement both changes in `index.html`

**Files:**
- Modify: `index.html` (line 811 for Change 1; after line 760 for Change 2)

- [ ] **Step 1: Fix `syncTimeout` reset in `save()` (line 811)**

Find this line (line 811):
```js
clearTimeout(syncTimeout);setSyncState('syncing');syncTimeout=setTimeout(()=>persistToFirestore(),800);
```

Replace with:
```js
clearTimeout(syncTimeout);setSyncState('syncing');syncTimeout=setTimeout(()=>{syncTimeout=null;persistToFirestore();},800);
```

- [ ] **Step 2: Add the `storage` event listener after the `auth.onAuthStateChanged` block**

The `auth.onAuthStateChanged` block ends around line 760-761. Add the listener immediately after it:

```js
window.addEventListener('storage',e=>{
  if(e.key!=='bl_entries'||!e.newValue)return;
  if(!currentUser)return;
  if(syncTimeout)return;
  let incoming;
  try{incoming=readLocalState({defaultGoals:DEFAULT_GOALS,sanitizeRecurringRule});}catch{return;}
  applyState(incoming);
  applyCustomCategories();
  resetCategorySelections();
  renderDashboard();
  renderEntries();
  renderRecurring();
  renderGoals();
});
```

- [ ] **Step 3: Update the test file — replace the stub `makeStorageHandler` with the real implementation**

In `tests/multi-tab-sync.test.js`, replace the stub `makeStorageHandler` function with the real logic (adapted to use injected dependencies instead of closure variables so it can be called in Node):

```js
function makeStorageHandler({ getCurrentUser, getSyncTimeout, readLocalState, applyState, applyCustomCategories, resetCategorySelections, renderDashboard, renderEntries, renderRecurring, renderGoals }) {
  return function storageHandler(e) {
    if (e.key !== 'bl_entries' || !e.newValue) return;
    if (!getCurrentUser()) return;
    if (getSyncTimeout()) return;
    let incoming;
    try { incoming = readLocalState({ defaultGoals: DEFAULT_GOALS, sanitizeRecurringRule: r => r }); } catch { return; }
    applyState(incoming);
    applyCustomCategories();
    resetCategorySelections();
    renderDashboard();
    renderEntries();
    renderRecurring();
    renderGoals();
  };
}
```

- [ ] **Step 4: Run the tests and verify all pass**

```bash
node tests/multi-tab-sync.test.js
```

Expected output:
```
Storage event listener guard tests:
  ✓ skips if e.key is not bl_entries
  ✓ skips if e.newValue is null
  ✓ skips if currentUser is null
  ✓ skips if syncTimeout is set
  ✓ calls applyState and all renders on valid event
  ✓ applyState receives full normalized state object

6 passed, 0 failed
```

- [ ] **Step 5: Commit**

```bash
git add index.html tests/multi-tab-sync.test.js
git commit -m "feat: sync in-memory state across tabs via storage events"
```

---

### Task 3: Manual browser verification

This task cannot be automated — it requires two real browser tabs.

- [ ] **Step 1: Open the app in two tabs**

Open `https://budgetlog-b318d.web.app` (or run locally) and sign in on both tabs. Open DevTools console on Tab B.

- [ ] **Step 2: Verify Tab B syncs when Tab A adds an entry**

In Tab A: add a new expense entry (e.g., $100 Food). Save it.
In Tab B: without doing anything, verify the new entry appears in the entries list within a second.

- [ ] **Step 3: Verify Tab B does NOT overwrite Tab A when Tab B is saving**

In Tab B: start typing an amount in the new entry form (don't save yet — just type). In Tab A: add and save a different entry. Verify Tab B does NOT immediately update its UI (the `syncTimeout` guard should block it since Tab B is mid-interaction — though the guard only activates if Tab B actually called `save()`; typing alone does not set `syncTimeout`).

Actually: for the `syncTimeout` guard to activate, Tab B must have called `save()`. Test this by:
1. In Tab B: add an entry and save it (this sets and then clears `syncTimeout`)
2. Immediately after Tab B saves (within 800ms), have Tab A save something
3. Verify Tab B's `storage` event is skipped while Tab B's timer is active

- [ ] **Step 4: Verify Tab B on auth screen does not crash**

Open a new tab. Before signing in (auth screen showing), open DevTools console. In another signed-in tab, add and save an entry. Verify the auth-screen tab's console shows no errors.

- [ ] **Step 5: Verify goals sync**

In Tab A: open the Goals tab, change a goal value, save. In Tab B: switch to Goals tab. Verify the updated goal value is shown.

- [ ] **Step 6: Commit verification note**

No code changes. This task is complete when all manual steps pass.
