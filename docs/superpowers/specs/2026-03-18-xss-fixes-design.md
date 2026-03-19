# XSS Fixes — Design Spec
**Date:** 2026-03-18
**Scope:** Priority 1 only — XSS vulnerabilities via unsanitized innerHTML

---

## Problem

User-controlled text (entry descriptions, category labels, goal names, display name initials) is concatenated directly into HTML template strings and assigned to `innerHTML` without escaping. An attacker who controls their Firebase display name, or who stores a malicious string in Firestore, can inject HTML/JS into the DOM.

## Approach

Add a single `escapeHtml(str)` utility to `utils.js`, exported as both `escapeHtml` and the short alias `esc` on `window.BudgetLogCore.utils`. Apply `esc()` at every render site where user-controlled data enters an HTML string. Data is stored raw; escaping happens only at render time.

No new CDN dependencies. No changes to state shape, Firestore schema, or export behavior.

---

## Utility Function

**File:** `js/core/utils.js`

```js
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Export on `window.BudgetLogCore.utils` as both `escapeHtml` and `esc`.

---

## Files Changed

### 1. `js/core/utils.js`
- Add `escapeHtml` function
- Export as `escapeHtml` and `esc` on `BudgetLogCore.utils`

### 2. `js/features/app-shell.js`
- Escape `user.displayName` before building initials string for innerHTML

### 3. `js/features/entries.js`
- Escape `entry.description` in list item HTML
- Escape `entry.id` in `data-*` attributes and inline `onclick` handlers

### 4. `js/features/dashboard.js`
- Escape category `label` (custom category names) in category bar HTML

### 5. `js/features/recurring.js`
- Escape `r.description` and category `label` in recurring list HTML

### 6. `js/features/savings-goals.js`
- Escape `goal.name` in savings goal card HTML

### 7. `js/features/category-customization.js`
- Escape category `label` in customization list HTML

### 8. `js/core/ui/cards.js`
- Remove local duplicate `escapeHtml` definition
- Replace its usage with `BudgetLogCore.utils.esc`

---

## What Is NOT Changed

- `user.photoURL` — goes into `img src`, not innerHTML text; Firebase-issued URL
- Entry/goal IDs in Firestore — stored raw, unaffected
- XLSX export — reads raw state, unaffected
- State shape — no changes

---

## Edge Cases

- `esc(null)` → `''` (safe, no crash)
- `esc(undefined)` → `''` (safe, no crash)
- Numeric IDs passed to `esc()` → coerced to string, no entity replacements needed but safe

---

## Out of Scope

- Input validation (Priority 2)
- Firestore error UX (Priority 3)
- CLAUDE.md spec cleanup (Priority 4)
