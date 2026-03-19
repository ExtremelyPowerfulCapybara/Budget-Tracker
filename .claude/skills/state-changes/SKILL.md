# Skill: Modifying App State or Firestore Document Shape

Use this skill whenever you add, rename, or remove a field from the app state.
State changes touch multiple files and must be done atomically — a partial change
will break existing users' data on load.

---

## Files That Must ALL Be Updated Together

When changing state shape, you must update ALL of these in the same commit:

| File | What to update |
|------|----------------|
| `js/core/storage.js` | `createEmptyState()` + `normalizeState()` |
| `js/core/storage.js` | `serializeCloudState()` |
| `js/core/storage.js` | `STORAGE_KEYS` (if adding a new localStorage key) |
| `js/core/selectors.js` | Any selector that reads the new/changed field |
| `index.html` | Inline composition/wiring that passes state to features |
| `functions/index.js` | If the Cloud Function reads the changed field |
| `js/features/export.js` | If the new field should appear in the XLSX export |

---

## Adding a New Top-Level State Key

### Step 1: storage.js — createEmptyState()
```js
function createEmptyState(defaultGoals) {
  return {
    entries: [],
    goals: { ...defaultGoals },
    recurring: [],
    savingsGoals: [],
    customCategories: {},
    myNewKey: []  // ← add here with sensible default
  };
}
```

### Step 2: storage.js — normalizeState()
This is the most important step. It runs on every load and protects against missing keys
in old data. Always provide a fallback:
```js
function normalizeState(rawState, { defaultGoals, sanitizeRecurringRule }) {
  const fallback = createEmptyState(defaultGoals);
  const source = rawState || {};
  return {
    entries: Array.isArray(source.entries) ? source.entries : [],
    goals: source.goals && typeof source.goals === 'object'
      ? { ...defaultGoals, ...source.goals }
      : { ...fallback.goals },
    recurring: Array.isArray(source.recurring)
      ? source.recurring.map(sanitizeRecurringRule)
      : [],
    savingsGoals: Array.isArray(source.savingsGoals) ? source.savingsGoals : [],
    customCategories: source.customCategories && typeof source.customCategories === 'object'
      ? source.customCategories
      : {},
    // New key — always provide fallback for existing users who don't have it yet
    myNewKey: Array.isArray(source.myNewKey) ? source.myNewKey : []
  };
}
```

### Step 3: storage.js — serializeCloudState()
Must include every key that should be persisted to Firestore:
```js
function serializeCloudState(state) {
  return {
    entries: state.entries,
    goals: state.goals,
    recurring: state.recurring,
    savingsGoals: state.savingsGoals,
    customCategories: state.customCategories,
    myNewKey: state.myNewKey  // ← add here
  };
}
```

### Step 4: storage.js — writeLocalState() and readLocalState()
If the new key needs a dedicated localStorage key (optional — only if offline-first matters for it):
```js
const STORAGE_KEYS = {
  entries: 'bl_entries',
  goals: 'bl_goals',
  recurring: 'bl_recurring',
  savingsGoals: 'bl_savings',
  customCategories: 'bl_catcustom',
  myNewKey: 'bl_mynewkey'  // ← add here
};
```
Then update `readLocalState()` and `writeLocalState()` to include it.

---

## Changing an Entry Field

When adding a field to individual entries (e.g., a new `tags` field):

1. **selectors.js** — update `createRecurringEntry()` to include the field: `tags: rule.tags || []`
2. **index.html** — update the log entry form to collect the field
3. **index.html** — update the edit entry modal to show/edit the field
4. **entries.js** — update `renderEntryMarkup()` if the field should be visible
5. **export.js** — add a column to the Movimientos sheet
6. **functions/index.js** — if the Cloud Function should consider this field

---

## Renaming or Removing a Field

**Never remove a field silently.** Existing Firestore documents still have the old field.

Safe rename process:
1. In `normalizeState()`, read BOTH old and new name: `source.newName || source.oldName || fallback`
2. In `serializeCloudState()`, write under the new name only
3. After sufficient deployment time (a few weeks), remove the old-name fallback from normalizeState

---

## Migration Script Pattern

For breaking changes that affect all existing users, write a one-time Cloud Function:
```js
exports.migrateState = functions.https.onRequest(async (req, res) => {
  // Protect with a secret header
  if (req.headers['x-migration-secret'] !== process.env.MIGRATION_SECRET) {
    return res.status(403).send('Forbidden');
  }
  const db = admin.firestore();
  const snapshot = await db.collection('users').get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // transform data
    batch.update(doc.ref, { newField: computeNewField(data) });
  });
  await batch.commit();
  res.send(`Migrated ${snapshot.docs.length} users`);
});
```
Run once, then delete the function.

---

## Testing State Changes

After any state change, verify:
1. Fresh user (no existing data) — app loads without errors, empty states show correctly
2. Existing user (old Firestore doc without the new field) — normalizeState fallback kicks in, no crash
3. Sign out → sign in — state round-trips through Firestore correctly
4. New field appears in XLSX export if expected
