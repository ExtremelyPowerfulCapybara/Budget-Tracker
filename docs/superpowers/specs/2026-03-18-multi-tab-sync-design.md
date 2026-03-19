# Multi-Tab Sync Design

**Date:** 2026-03-18
**Scope:** Prevent silent data loss when BudgetLog is open in multiple browser tabs simultaneously

---

## Problem

`save()` in `index.html` writes to localStorage then debounces a Firestore `set()` call (800ms). Each tab holds its own in-memory state. When Tab A saves, Firestore gets Tab A's state. If Tab B has stale in-memory state and later saves, it silently overwrites Tab A's changes — last writer wins with no warning.

---

## Solution: `storage` Event Listener

The browser fires a `storage` event on all **other** same-origin tabs whenever localStorage changes. Since `save()` already calls `writeLocalState(getStateSnapshot())`, Tab B automatically receives a notification whenever Tab A saves — with no extra writes or connections required.

When Tab B receives the event, it re-reads the new state from localStorage and updates its in-memory state and UI. The next time Tab B saves, it writes the correct up-to-date state.

---

## Implementation

### Listener (added to `index.html`)

```js
window.addEventListener('storage', e => {
  if (e.key !== LOCAL_STATE_KEY || !e.newValue) return;
  if (syncTimeout) return; // tab has unsaved changes in-flight — skip
  let incoming;
  try { incoming = JSON.parse(e.newValue); } catch { return; }
  applyState(incoming);
  applyCustomCategories();
  renderDashboard();
  renderEntries();
  renderRecurring();
  renderSavingsGoals();
});
```

### Key details

- **`e.key` guard:** Only react to changes to `LOCAL_STATE_KEY` (the same key used by `writeLocalState`/`readLocalState`). Ignore all other localStorage changes.
- **`e.newValue` guard:** Skip if null (fired on key deletion — shouldn't happen, but defensive).
- **`syncTimeout` guard:** If the receiving tab has a debounce timer active (the user is mid-save), skip the incoming update to avoid overwriting the user's unsaved local changes. The receiving tab will write its own state to Firestore momentarily.
- **Error handling:** `JSON.parse` wrapped in try/catch — malformed values are silently ignored.
- **Self-exclusion:** The `storage` event fires only on *other* tabs, never the one that wrote. No loop possible.

### What gets re-applied

- `applyState(incoming)` — updates all in-memory variables (`entries`, `goals`, `recurring`, `savingsGoals`, `customCategories`)
- `applyCustomCategories()` — rebuilds the `CATEGORIES` array from `customCategories`
- `renderDashboard()`, `renderEntries()`, `renderRecurring()`, `renderSavingsGoals()` — refreshes all tab panels with the new state

The charts tab is not re-rendered proactively — it re-renders from current state when the user opens it (existing behavior, unchanged).

---

## What Is NOT Changed

- No changes to `js/core/cloud.js`, `js/core/storage.js`, or any feature file
- No changes to Firestore document structure or read/write logic
- The 800ms debounce and localStorage write in `save()` are unchanged
- No new modules, no new dependencies

---

## Limitations

**Narrow simultaneous-write race still exists:** If Tab A and Tab B both call `save()` within the same 800ms debounce window, both will write to Firestore and one will overwrite the other. This window is very narrow for a single-user personal finance app and is accepted as a known limitation.

**Same-browser only:** `storage` events only fire within the same browser on the same device. Cross-device sync continues to work as before (via Firestore load on sign-in).

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Add `storage` event listener (~10 lines) |
