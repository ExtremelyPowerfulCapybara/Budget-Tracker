# BudgetLog — Development Roadmap

---

## ✅ Just Fixed — Notification Bug

**Root causes found and fixed in `functions/index.js`:**

1. **Wrong URLs** — icon, badge, and notification link all pointed to the old GitHub Pages URL. Notifications were firing but opening a dead link. Fixed to `budgetlog-b318d.web.app`.
2. **Silent errors** — any FCM failure that wasn't an expired token was swallowed silently. Added `console.error` logging so failures show up in Firebase Functions logs.
3. **Amount coercion** — `e.amount` was not explicitly cast to a number before reducing. Firestore can return numeric strings in some edge cases. Added `Number(e.amount)`.
4. **Zero-spend skip** — categories with $0 spent were still being evaluated. Added early skip.
5. **Empty goals guard** — users with no goals set were being processed unnecessarily.

**Deploy after committing:**
```powershell
firebase deploy --only functions
```

---

## Phase 1 — Quick Wins (1–3 hours each)

These touch minimal files and have immediate visible impact.

### 1.1 Fix Notification Icon URLs (done above)
**Files:** `functions/index.js`
**Status:** ✅ Complete

---

### 1.2 Budget Rollover
Underspending in one month carries surplus to the next month's effective goal.
If you budget $4,000 for food and spend $3,200, next month's effective goal is $4,800.

**Files:** `js/core/selectors.js`
**How:** Add `getRolloverGoal(entries, goals, categoryId, year, monthIndex)` to selectors.
Pass result to dashboard category bars instead of raw `goals[id]`.
No state shape change needed — computed on the fly from existing entries.

---

### 1.3 Chart Range Toggle (3M / 6M / 12M)
Add a toggle above the Tendencia and Saldo Neto charts to switch between timeframes.
Currently hardcoded to 6 months.

**Files:** `js/features/charts.js`, `index.html` (chart panel markup + event handler)
**How:** Pass `rangeMonths` parameter to `renderTrendChart` and `renderNetChart`.
`getLastMonths()` already accepts a `count` parameter — just wire it up.

---

### 1.4 Add 50% Threshold Alert
Add an early warning before the 80% alert fires.

**Files:** `functions/index.js`
**How:** Add one condition block:
```js
} else if (pct >= 0.5) {
  alerts.push(`🔵 ${label}: 50% de tu meta gastado`);
}
```

---

### 1.5 All-Entry Search
Currently search only covers the current month's entries.
Extend to search the full history with an optional date range.

**Files:** `js/features/entries.js` (`filterEntries`), `index.html` (pass full entries when searching)
**How:** Pass all entries when a search query is active. Add a date range input to the entries tab.

---

## Phase 2 — Core Feature Additions (half day each)

### 2.1 Recurring Entry Editing
Currently recurring rules can only be deleted. You need to delete and recreate to fix an amount.

**Files:** `js/features/recurring.js`, `index.html` (edit modal + handler)
**State:** No change — editing updates the rule in `state.recurring[]`
**How:** Add an edit button to each recurring card. Reuse the existing log modal
pre-filled with the rule's values. On save, replace the rule by ID.

---

### 2.2 Entry Notes Field
Add an optional free-text `notes` field to each entry for context and memos.

**Files:** `index.html` (log form + edit modal), `js/features/entries.js` (render)
**State:** Add `notes: string` to entry shape — safe, old entries just won't have it.
`normalizeState()` needs no change since it passes unknown fields through.
**How:** Small textarea in the log form. Show notes as a second line in entry card if present.
Add a Notes column to the Movimientos sheet in the export.

---

### 2.3 Savings Goal Deadline
Add a target date to savings goals. Show monthly savings required to hit the deadline.

**Files:** `js/features/savings-goals.js`, `js/core/selectors.js`, `index.html` (modal)
**State:** Add `deadline: "YYYY-MM-DD" | null` to `savingsGoals[]` shape.
Update `normalizeState()` with fallback `deadline: null`.
**How:** Optional date input in the savings goal modal.
In `selectors.js`, add `getMonthlyRequiredToReachGoal(saved, target, deadline)`.
Show on the savings card: "Necesitas $X/mes para llegar a tiempo".

---

### 2.4 Weekly Summary Notification
Send a Monday morning digest: last week's spending summary + this week's recurring total.

**Files:** `functions/index.js`
**How:** New Cloud Function `weeklyDigest`:
```js
exports.weeklyDigest = functions.pubsub
  .schedule("0 15 * * 1") // Monday 9am MX
  .timeZone("America/Mexico_City")
  .onRun(async () => { ... });
```
Reuses same FCM send pattern as `budgetAlerts`.
Computes last 7 days' total per category, compares to weekly average.

---

## Phase 3 — Structural Improvements (1–2 days)

### 3.1 Firestore Security Rules
Currently any authenticated user can read/write any document.
A basic rules file locks each user to their own document only.

**New file:** `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
**Deploy:** `firebase deploy --only firestore:rules`

---

### 3.2 Unit Tests for selectors.js
The recurring logic is the most complex part of the app and has zero tests.
A test suite here catches regressions before they reach users.

**New files:** `tests/selectors.test.js`, `tests/utils.test.js`, `tests/setup.js`
**How:** See `.claude/skills/testing/SKILL.md` for the full pattern.
Priority test cases:
- `getRecurringOccurrenceDates` — monthly, weekly, biweekly
- `applyRecurringForMonth` — duplicate prevention
- `getMonthTotals` — mixed month data
- `getGoalSavedAmount` — single and multiple goals
- `normalizeState` — missing fields, old user data

**Run:** `node tests/selectors.test.js`

---

## Priority Order

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| ✅ | Notification bug fixes | Done | High — fixes broken feature |
| 1 | Budget rollover | Small | High — core finance logic |
| 2 | Chart range toggle | Small | Medium — quick UX win |
| 3 | 50% threshold alert | Tiny | Medium |
| 4 | Firestore security rules | Small | Critical (security) |
| 5 | Recurring entry editing | Medium | High — real frustration |
| 6 | All-entry search | Small | Medium |
| 7 | Entry notes field | Small | Medium |
| 8 | Savings goal deadline | Medium | High on savings screen |
| 9 | Weekly summary notification | Small | Medium |
| 10 | Unit tests | Medium | High long-term |

---

## Claude Code Prompts

Ready-to-use prompts for each feature. Paste into Claude Code when you're ready to build.

```
Implement budget rollover in js/core/selectors.js.
Read .claude/skills/state-changes/SKILL.md first.
Add getRolloverGoal(entries, goals, categoryId, year, monthIndex) that returns
the goal + any unspent surplus from the previous month. Then update dashboard.js
to use it instead of raw goals[id] in renderCategoryBarsMarkup.
```

```
Add a 3M / 6M / 12M range toggle to the Tendencia and Saldo Neto charts.
Read .claude/skills/charts/SKILL.md first.
getLastMonths() already accepts a count parameter — wire a toggle UI above each
chart and pass the selected count. Default stays 6.
```

```
Add Firestore security rules. Create firestore.rules in the repo root that locks
each user to their own document. Update firebase.json to include the firestore
config. Then run: firebase deploy --only firestore:rules
```

```
Add recurring entry editing. Read .claude/skills/new-feature/SKILL.md first.
Each recurring card in recurring.js needs an edit button alongside the delete button.
Clicking it should open a modal pre-filled with the rule's current values.
On save, replace the rule in state.recurring by matching ID. Reuse existing
modal patterns from the log entry form.
```

```
Write unit tests for js/core/selectors.js.
Read .claude/skills/testing/SKILL.md first.
Cover: getRecurringOccurrenceDates (monthly/weekly/biweekly), applyRecurringForMonth
duplicate prevention, getMonthTotals, getGoalSavedAmount, and normalizeState
with missing fields. Run with: node tests/selectors.test.js
```
