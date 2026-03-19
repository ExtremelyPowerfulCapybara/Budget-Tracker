# Validation & Hardening Design

**Date:** 2026-03-18
**Scope:** Three grouped fixes — missed XSS escaping, NaN hardening in selectors/storage, UI input validation

---

## Fix 1: Missed `esc()` Calls

Two render functions were missed in the XSS pass. Both files already have `const esc=window.BudgetLogCore.utils.esc;` defined.

### `js/features/category-customization.js` — `renderColorPickerMarkup`

Wrap `color` in both attribute injections:
- `data-palette-color="${esc(color)}"` (currently unescaped)
- `style="background:${esc(color)}"` (currently unescaped)

### `js/features/selection-ui.js` — `renderFrequencyGridMarkup`

Wrap `frequency.label` in button text content:
- `>'+esc(frequency.label)+'<` (currently unescaped)

`frequency.id` in `data-selection-id` is intentionally NOT wrapped — it comes from the hardcoded `FREQUENCIES` config constant, contains no HTML-special characters, and all other config-sourced IDs in the file follow the same pattern.

---

## Fix 2: NaN Hardening

### `js/core/selectors.js` — `sanitizeRecurringRule`

The existing function already handles `anchorDate`, `createdAt`, and `lastApplied`. Add coercions for the remaining fields **at the top of the function, before any existing checks**, so they always run regardless of what fields are already present:

| Field | Validation | Default on failure |
|-------|-----------|-------------------|
| `rule.amount` | `parseFloat`, must be finite and > 0 | `0` |
| `rule.type` | must be `"income"` or `"expense"` | `"expense"` |
| `rule.frequency` | must be `"monthly"`, `"biweekly"`, or `"weekly"` | `"monthly"` |
| `rule.day` | `parseInt`, must be 1–31 | `1` |

Note on `rule.day`: the existing code already sets `day` from `anchorDate` in a later block (`if(!sanitized.day||sanitized.frequency!=='monthly')`). The new coercion runs first and sets a safe integer fallback; the existing block then overwrites it for monthly rules as before. No ordering conflict.

A rule with `amount: 0` produces no forecast impact and no crash.

### `js/core/storage.js` — `normalizeState`

**Entry amounts:** In the entries array normalization, coerce each entry's `amount`:
- `parseFloat(entry.amount)` — if result is not finite or < 0, set to `0`

**Goals values:** In goals normalization, coerce each value in the merged goals object:
- For each key in the final goals object: `parseFloat(val)` — if not finite or < 0, set to `0`

This ensures bad data loaded from Firestore (e.g., `goals: { food: "abc" }`) never reaches selectors as NaN.

---

## Fix 3: UI Input Validation

Use the existing `showToast(msg)` utility for all error messages. Block the save and return early on invalid input. All five save functions live in `index.html`.

### `logEntry` (new entry save, `index.html`)

Replaces the existing empty-check guards with stricter validation:

| Field | Rule | Toast message |
|-------|------|--------------|
| Amount | `parseFloat(val)` must be finite and > 0 | `"Ingresa un monto válido"` |
| Date | must match `/^\d{4}-\d{2}-\d{2}$/` | `"Selecciona una fecha válida"` |

Note: replaces the existing `if(!amount||!desc||!date)` guard. The date toast message changes from `"Elige una fecha"` to `"Selecciona una fecha válida"`.

### `saveEdit` (edit entry save, `index.html`)

Same validation as `logEntry` — currently uses a simpler `!amount` falsy check. Apply the same `parseFloat` + finite + > 0 rule for amount, and regex check for date.

| Field | Rule | Toast message |
|-------|------|--------------|
| Amount | `parseFloat(val)` must be finite and > 0 | `"Ingresa un monto válido"` |
| Date | must match `/^\d{4}-\d{2}-\d{2}$/` | `"Selecciona una fecha válida"` |

### `saveSavingsGoal` (savings goal save, `index.html`)

Replaces the existing `'Agrega un nombre'` toast with more specific messages:

| Field | Rule | Toast message |
|-------|------|--------------|
| Name | `trim()` must be non-empty | `"Ingresa un nombre para la meta"` |
| Target | `parseFloat(val)` must be finite and > 0 | `"Ingresa una meta válida"` |

### `addRecurring` (recurring rule save, `index.html`)

| Field | Rule | Toast message |
|-------|------|--------------|
| Amount | `parseFloat(val)` must be finite and > 0 | `"Ingresa un monto válido"` |

### `saveGoals` (budget goals, `index.html`)

Each budget goal input: `parseFloat(val)` — if result is negative or non-finite, silently clamp to `0`. No toast — `0` is a valid "no goal set" value.

---

## What Is NOT Changed

- No changes to Firestore document structure
- No changes to state shape
- No new UI components — `showToast` already exists
- `user.photoURL` remains unescaped (Firebase Auth-issued URL, not user-editable input — intentional)
- `frequency.id` in `renderFrequencyGridMarkup` is not wrapped (hardcoded config constant — intentional)
- `entry.description` being empty is allowed — only savings goal name requires non-empty

---

## Files Changed

| File | Change |
|------|--------|
| `js/features/category-customization.js` | `esc()` in `renderColorPickerMarkup` |
| `js/features/selection-ui.js` | `esc()` in `renderFrequencyGridMarkup` |
| `js/core/selectors.js` | Coerce fields in `sanitizeRecurringRule` |
| `js/core/storage.js` | Coerce `entry.amount` and goals values in `normalizeState` |
| `index.html` | Validate `logEntry`, `saveEdit`, `saveSavingsGoal`, `addRecurring`, `saveGoals` |
