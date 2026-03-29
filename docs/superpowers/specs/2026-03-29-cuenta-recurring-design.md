# Cuenta Field for Recurring Entries

**Date:** 2026-03-29
**Status:** Approved

## Summary

Add an optional `Cuenta` (account) field to recurring rules so that generated entries automatically inherit the account, the rule card shows which account it belongs to, and the recurring list can be filtered by account.

---

## Data Model

Add `accountId: string|null` to the recurring rule shape (alongside existing `goalId`). Default: `null`.

```js
{
  id: string,
  type: "income"|"expense",
  amount: number,
  description: string,
  category: string,
  frequency: "monthly"|"biweekly"|"weekly",
  day: number,
  anchorDate: "YYYY-MM-DD",
  createdAt: "YYYY-MM-DD",
  lastApplied: string|null,
  goalId: string|null,
  accountId: string|null   // NEW
}
```

**`sanitizeRecurringRule` (selectors.js):** Pass `accountId` through unchanged (no coercion — accounts are resolved by id at render time).

**`createRecurringEntry` (selectors.js):** Copy `accountId: rule.accountId || null` onto the generated entry object.

---

## Form (Add / Edit)

In `index.html`, inside `#view-recurring .form-card`, add before the Fecha de inicio field:

```html
<div class="form-group">
  <label class="form-label" for="recurAccountId">Cuenta (opcional)</label>
  <select class="form-input" id="recurAccountId">
    <option value="">— Sin cuenta —</option>
  </select>
</div>
```

- Populated by the existing `renderAccountSelect()` utility.
- `addRecurring()` reads `document.getElementById('recurAccountId').value || null` and includes it in the rule object.
- `openEditRecurring()` calls `renderAccountSelect(recurAccountIdEl)` then sets `.value = normalized.accountId || ''`.
- On form reset after save, set `recurAccountId.value = ''`.
- `renderRecurring()` calls `renderAccountSelect` on `#recurAccountId` to keep options in sync.

---

## Card Display

In `js/features/recurring.js` → `renderRecurringListMarkup`:

- Accept `accounts` as a new parameter in the options object.
- When `normalized.accountId` is set, look up the account in `accounts`.
- If found, append to the `recur-meta` line:
  ```html
   · <span class="entry-account-dot" style="background:{account.color}"></span>{account.label}
  ```
- `entry-account-dot` CSS class already exists in `index.html`.
- If `accountId` is null or not found, nothing is appended.

Pass `accounts` from `renderRecurring()` in `index.html`:
```js
renderRecurringListMarkup({ recurring, sanitizeRecurringRule, categories: CATEGORIES, savingsGoals, formatMoney: MXN, currentMonthKey: monthKey(viewYear, viewMonth), accounts })
```

---

## Account Filter on Recurring List

Add a filter bar between `.section-title` and `#recurList` in `#view-recurring`.

**State:** `let recurAccountFilter = null` (null = all accounts shown).

**Render logic (`renderRecurringFilter`):**
1. Find all unique `accountId` values across `recurring` rules that are non-null.
2. If none, hide the filter bar entirely.
3. If any, render chips: "Todas" + one chip per account (label + colored dot). Use the same `.filter-chip` / `.filter-chip.active` CSS classes already used in the entries view.

**Filter application:** `renderRecurring()` applies `recurAccountFilter` before passing rules to `renderRecurringListMarkup`. If `recurAccountFilter` is non-null, only rules where `rule.accountId === recurAccountFilter` are rendered.

**Reset:** At the top of `renderRecurringFilter`, if `recurAccountFilter` is non-null and no rule has that `accountId`, reset `recurAccountFilter = null` before rendering. This handles the case where the filtered account is later deleted.

---

## Files Changed

| File | Change |
|------|--------|
| `js/core/selectors.js` | `sanitizeRecurringRule`: pass through `accountId`; `createRecurringEntry`: copy `accountId` |
| `js/features/recurring.js` | `renderRecurringListMarkup`: accept + render `accounts`; add `renderRecurringFilter` |
| `index.html` | Add `#recurAccountId` select to recurring form; update `addRecurring`, `openEditRecurring`, `renderRecurring`; add filter bar HTML; add `recurAccountFilter` state var |

---

## Out of Scope

- Filtering entries list by account (already exists).
- Showing account on the entry detail sheet (already exists for regular entries).
- Any changes to the accounts management modal.
