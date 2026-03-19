# XSS Fixes — Design Spec
**Date:** 2026-03-18
**Scope:** Priority 1 only — XSS vulnerabilities via unsanitized innerHTML

---

## Problem

User-controlled text (entry descriptions, category labels, goal names, display name initials) is concatenated directly into HTML template strings and assigned to `innerHTML` without escaping. An attacker who controls their Firebase display name, or who stores a malicious string in Firestore, can inject HTML/JS into the DOM.

## Approach

Add a single `escapeHtml(str)` utility to `utils.js`, exported as both `escapeHtml` and the short alias `esc` on `window.BudgetLogCore.utils`. Apply `esc()` at every render site where user-controlled data enters an HTML string. Data is stored raw; escaping happens only at render time.

Consolidate the three existing local duplicate `escapeHtml` functions across the codebase into the single canonical utility.

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

**Behavioral note:** `esc(0)` returns `"0"`. The existing local duplicate copies use `String(value||'')` which returns `""` for `0`. No current caller passes `0`, so there is no behavior change in practice — but implementers should be aware the semantics are different when replacing the local copies.

---

## Files Changed

### 1. `js/core/utils.js`
- Add `escapeHtml` function (implementation above)
- Export as both `escapeHtml` and `esc` on `BudgetLogCore.utils`

### 2. `js/features/app-shell.js`
- The `initials` variable is computed from `user.displayName` by splitting on spaces and taking `word[0]`. A single character like `<` or `"` survives.
- Fix: wrap the **computed `initials` value** (not the raw `displayName`) with `esc()` at the template literal injection point: `` `<div ...>${esc(initials)}</div>` ``

### 3. `js/features/entries.js` — two functions
**`renderEntryMarkup`:**
- Escape `entry.description` (element text content)
- Escape `entry.id` in `data-*` attributes and inline `onclick`/touch handlers (numeric today but defensive)
- Escape `categoryLabel` (derived from `category.label`) — custom category label flows into `.entry-meta` div unescaped
- Escape `goal.name` via `goalLabel` — savings goal names flow into `.entry-meta` div unescaped
- Escape `color` in `style="background:'+color+'"` — custom category colors are stored in Firestore and could contain `"` which would break out of the attribute; `esc()` prevents attribute injection (CSS value injection within a valid hex color is not possible, but a crafted string could escape the attribute)

**`buildEntryFilters`:**
- Escape `filter.label` (which includes custom category labels) in button text and any data attributes

### 4. `js/features/dashboard.js` — two fix sites
1. **Category bars loop** (`renderCategoryBarsMarkup`): escape `category.label` in text content; escape `category.color` in `style="color:'+category.color+'"` and `style="...background:'+category.color+'"` — Firestore-stored, same attribute-breakout risk as other color vectors
2. **Fallback inline insight block** (`renderInsightMarkup`, non-`createStatCardMarkup` branch): escape `biggestCategory.label` in text content; escape `biggestCategory.color` in `style="color:'+biggestCategory.color+'"` — same risk
- Note: when `createStatCardMarkup` IS available (the primary path), values are passed to that function which already escapes via its own local `escapeHtml`. **That path is already safe and requires no change.**

### 5. `js/features/recurring.js`
- Escape `normalized.description` in list item text content
- Escape `goal.name` via `goalText` — savings goal names flow into `.recur-meta` unescaped
- Escape `normalized.id` in `data-recurring-delete` attribute (numeric today but defensive, consistent with `entry.id` treatment)
- Escape `color` in `style="background:'+color+'"` — same reason as entries.js: Firestore-stored colors could break out of attribute with a crafted `"`
- Note: category `label` does NOT appear in recurring HTML markup
- Note: `normalized.anchorDate` flows into `startText` but is a `YYYY-MM-DD` format string (only digits and hyphens) — no HTML-special characters are possible; safe without escaping

### 6. `js/features/savings-goals.js`
- Escape `goal.name` in savings goal card HTML
- Escape `goal.color` at both style attribute injection sites in `renderSavingsGoalsMarkup`:
  - `style="color:${goal.color}"` on `.savings-card-name`
  - `style="background:${goal.color}"` on `.bar-fill`
- Note: `goal.id` appears in `data-sg-id` (×2 button attributes) — generated via `Date.now().toString()` (numeric only), no HTML-special characters possible; safe without escaping (same justification as `normalized.anchorDate` and `goal.id` in `getGoalOptionsMarkup`)

### 7. `js/features/category-customization.js`
- Escape `category.label` — appears as the `value` attribute of an `<input>` element (`value="${category.label}"`), making double-quote escaping critical
- Escape `categoryId` in three `data-*` attribute positions (user-defined IDs for custom categories):
  - `data-cat-color-target="${categoryId}"`
  - `data-cat-label-input="${categoryId}"`
  - `data-cat-delete="'+categoryId+'"` (string-concatenated — a `"` in the ID could break out of the attribute)
- Escape `category.color` in `style="background:${category.color}"` — palette picker enforces hex values in the UI, but color is stored in Firestore and a crafted value with `"` could escape the attribute; `esc()` prevents breakout

### 8. `js/features/insights.js`
- `category.label` is embedded into `insight.body` strings before those strings reach `innerHTML`
- Fix: escape `category.label` at the concatenation point (e.g., `'Tu categoría más alta es '+esc(label)+'.'`)
- `insight.title` is always a hardcoded string literal — it contains no user data and does not need escaping

### 9. `js/features/selection-ui.js`
- `renderCategoryGridMarkup`: escape `category.label` in button text content and `category.id` in `data-selection-id` attribute
- Escape `category.color` in `style="border-color:'+category.color+';background:'+category.color+'22'"` — same attribute-breakout risk as other stored color vectors

### 10. `js/features/charts.js` — `buildCategorySelectorMarkup`
- `category.label` is concatenated into button text content unescaped
- `category.id` is placed in a `data-cat-id` attribute unescaped
- `catColors[category.id]` (a Firestore-stored custom color) is string-concatenated into `activeStyle` which goes into `style="${activeStyle}"` — a crafted color value with `"` would break out of the attribute
- Fix: escape all three

### 11. `index.html` — `renderGoals()`
- `c.label` from `CATEGORIES` (which includes user-editable custom categories) is concatenated into `<div class="goal-name">` text content unescaped
- `c.id` (user-defined for custom categories) is placed in `id="goal_${c.id}"` attribute unescaped
- `c.color` (Firestore-stored for custom categories) is concatenated into `style="background:'+c.color+'"` — crafted value with `"` could break out of the attribute
- Fix: escape `c.label`, `c.id`, and `c.color`

### 12. `index.html` — `getGoalOptionsMarkup()`
- `goal.name` (user-entered savings goal name) is placed in `<option>` text content unescaped
- Fix: escape `goal.name`

### 13. `js/core/ui/cards.js`
- Remove local duplicate `escapeHtml` definition
- Replace its call sites with `BudgetLogCore.utils.esc`

### 14. `js/core/ui/cta-row.js`
- Remove local duplicate `escapeHtml` definition
- Replace its call sites with `BudgetLogCore.utils.esc`

### 15. `js/core/ui/empty-state.js`
- Remove local duplicate `escapeHtml` definition
- Replace its call sites with `BudgetLogCore.utils.esc`

### 16. `js/core/ui-empty-state.js` (standalone file, distinct from `ui/empty-state.js`)
- Remove local duplicate `escapeHtml` definition
- Replace its call sites with `BudgetLogCore.utils.esc`

---

## What Is NOT Changed

- `user.photoURL` — Firebase-controlled value, not editable by the user; Firebase Auth issues the URL
- Entry/goal IDs in Firestore — stored raw, unaffected
- XLSX export — reads raw state, unaffected
- State shape — no changes
- `createStatCardMarkup` in `cards.js` — already escapes its `value` parameter via the local `escapeHtml`; this path in `dashboard.js` is already safe

---

## Edge Cases

- `esc(null)` → `''` (safe, no crash)
- `esc(undefined)` → `''` (safe, no crash)
- `esc(0)` → `"0"` (correct; old local copies returned `""` for falsy values — no current caller is affected)
- Numeric string IDs passed to `esc()` → no entity replacements needed, returned unchanged

---

## Out of Scope

- Input validation (Priority 2)
- Firestore error UX (Priority 3)
- CLAUDE.md spec cleanup (Priority 4)
