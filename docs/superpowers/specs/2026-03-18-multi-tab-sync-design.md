# Multi-Tab Sync Design

**Date:** 2026-03-18
**Scope:** Prevent silent data loss when BudgetLog is open in multiple browser tabs simultaneously

---

## Problem

`save()` in `index.html` writes to localStorage then debounces a Firestore `set()` call (800ms). Each tab holds its own in-memory state. When Tab A saves, Firestore gets Tab A's state. If Tab B has stale in-memory state and later saves, it silently overwrites Tab A's changes — last writer wins with no warning.

---

## Solution: `storage` Event Listener

The browser fires a `storage` event on all **other** same-origin tabs whenever localStorage changes. Since `save()` already calls `writeLocalState(getStateSnapshot())` — which writes five localStorage keys (`bl_entries`, `bl_goals`, `bl_recurring`, `bl_savings`, `bl_catcustom`) — Tab B receives storage events whenever Tab A saves.

The listener uses the string `'bl_entries'` as the trigger key (rather than `STORAGE_KEYS.entries` — `STORAGE_KEYS` is not destructured into `index.html` scope). On trigger, it calls `readLocalState(...)` to reconstruct the full state from all five localStorage keys, then applies and re-renders.

**Why `'bl_entries'` is safe as a trigger:** `writeLocalState` writes all five keys synchronously in the same JS call stack. `storage` events are dispatched to other tabs asynchronously, after Tab A's call stack unwinds. By the time Tab B's event loop delivers the `storage` event, all five writes have already completed. There is no partial-read race.

---

## Implementation

### Change 1: Reset `syncTimeout` after it fires (modify `save()`)

Currently `syncTimeout` is set to a timer ID but never reset to `null` after the timer fires. This would cause the listener's guard (Change 2) to permanently block sync after Tab B's first save, because it would always see a non-null stale timer ID.

Fix: null out `syncTimeout` at the start of the debounce callback:

```js
// before (existing):
syncTimeout = setTimeout(() => persistToFirestore(), 800);

// after:
syncTimeout = setTimeout(() => { syncTimeout = null; persistToFirestore(); }, 800);
```

### Change 2: Add `storage` event listener (new, placed after the `auth.onAuthStateChanged` block)

```js
window.addEventListener('storage', e => {
  if (e.key !== 'bl_entries' || !e.newValue) return;
  if (!currentUser) return;  // tab is on auth screen — skip
  if (syncTimeout) return;   // tab has unsaved changes in-flight — skip
  let incoming;
  try { incoming = readLocalState({defaultGoals: DEFAULT_GOALS, sanitizeRecurringRule}); } catch { return; }
  applyState(incoming);
  applyCustomCategories();
  resetCategorySelections();
  renderDashboard();
  renderEntries();
  renderRecurring();
  renderGoals();
});
```

### Key details

- **`'bl_entries'` string literal:** Used directly instead of `STORAGE_KEYS.entries` because `STORAGE_KEYS` is not destructured into `index.html`'s scope. The string `'bl_entries'` is the stable key defined in `js/core/storage.js`.
- **`!currentUser` guard:** If the tab is on the auth screen, DOM elements for the app panels don't exist. Skip to prevent render functions from throwing.
- **`e.newValue` guard:** Skip if null (defensive against deletion events).
- **`syncTimeout` guard:** If the receiving tab's debounce timer is active (user just made a change), skip the incoming update to avoid clobbering unsaved local changes. Requires Change 1 to work correctly — without it, `syncTimeout` would remain non-null indefinitely after first save.
- **`readLocalState(...)` call:** Reconstructs the full `{ entries, goals, recurring, savingsGoals, customCategories }` state object from all five localStorage keys. `DEFAULT_GOALS` (not `defaultGoals`) and `sanitizeRecurringRule` are in scope in `index.html`.
- **Error handling:** Wrapped in try/catch — if `readLocalState` throws, sync is silently skipped.
- **Self-exclusion:** The `storage` event fires only on *other* tabs, never the one that wrote. No loop possible.

### What gets re-applied

- `applyState(incoming)` — updates all in-memory variables (`entries`, `goals`, `recurring`, `savingsGoals`, `customCategories`)
- `applyCustomCategories()` — rebuilds the `CATEGORIES` array from `customCategories`
- `resetCategorySelections()` — normalizes `currentCat`, `recurCat`, `editCat`, `chartCatSelected` against the updated `CATEGORIES` array (prevents stale category IDs if Tab A added or deleted a custom category)
- `renderDashboard()` — re-renders the dashboard tab; also internally calls `renderSavingsGoals()` and `renderForecast()`, so those are covered
- `renderEntries()` — re-renders the entries tab
- `renderRecurring()` — re-renders the recurring tab
- `renderGoals()` — re-renders the goals tab

The charts tab is not re-rendered proactively — it re-renders from current state when the user opens it (existing behavior, unchanged).

---

## What Is NOT Changed

- No changes to `js/core/cloud.js`, `js/core/storage.js`, or any feature file
- No changes to Firestore document structure or read/write logic
- No new modules, no new dependencies

---

## Limitations

**`syncTimeout` guard race window:** If the user in Tab B makes a change (starting Tab B's 800ms debounce timer) and Tab A saves within that same window, the `storage` event arrives while `syncTimeout` is set, so Tab B skips the sync. Tab B's debounce timer will then fire and write Tab B's state to Firestore, potentially overwriting Tab A's change. This window spans the entire 800ms of Tab B's active debounce timer. Accepted as a known limitation.

**Open modals with stale data:** If Tab B has an edit modal open when Tab A saves a conflicting change (e.g., deletes the entry being edited), the modal is not closed. The user would be editing stale data. This is not addressed — it is an edge case with low likelihood in a single-user app.

**Same-browser only:** `storage` events only fire within the same browser on the same device. Cross-device sync continues to work as before (via Firestore load on sign-in).

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Null out `syncTimeout` in debounce callback; add `storage` event listener (~13 lines total) |
