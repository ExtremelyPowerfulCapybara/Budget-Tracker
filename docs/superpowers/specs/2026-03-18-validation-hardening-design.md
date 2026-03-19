# Validation & Hardening Design

**Date:** 2026-03-18
**Scope:** Three grouped fixes — missed XSS escaping, NaN hardening in selectors, UI input validation

---

## Fix 1: Missed `esc()` Calls

Two render functions were missed in the XSS pass. Both files already have `const esc=window.BudgetLogCore.utils.esc;` defined.

### `js/features/category-customization.js` — `renderColorPickerMarkup`

Wrap `color` in both attribute injections:
- `data-palette-color="${esc(color)}"` (currently unescaped)
- `style="background:${esc(color)}"` (currently unescaped)

### `js/features/selection-ui.js` — `renderFrequencyButtons`

Wrap `frequency.label` in button text content:
- `>'+esc(frequency.label)+'<` (currently unescaped)

---

## Fix 2: NaN Hardening

### `js/core/selectors.js` — `sanitizeRecurringRule`

Coerce all numeric and enum fields to safe values before the rule enters any calculation:

| Field | Validation | Default on failure |
|-------|-----------|-------------------|
| `rule.amount` | `parseFloat`, must be finite and > 0 | `0` |
| `rule.day` | integer 1–31 | `1` |
| `rule.frequency` | must be `"monthly"`, `"biweekly"`, or `"weekly"` | `"monthly"` |
| `rule.type` | must be `"income"` or `"expense"` | `"expense"` |

A rule with `amount: 0` produces no forecast impact and no crash.

### `js/core/storage.js` — `normalizeState`

In the entries array normalization, coerce each entry's `amount`:
- `parseFloat(entry.amount)` — if not finite or < 0, set to `0`

This ensures bad data loaded from Firestore never reaches selectors as NaN.

---

## Fix 3: UI Input Validation

Use the existing `showToast(msg)` utility for all error messages. Block the save and return early on invalid input.

### Entry save (`index.html` or `js/features/entries.js`)

| Field | Rule | Toast message |
|-------|------|--------------|
| Amount | `parseFloat(val)` must be finite and > 0 | `"Ingresa un monto válido"` |
| Date | must match `/^\d{4}-\d{2}-\d{2}$/` | `"Selecciona una fecha válida"` |

### Savings goal save (`js/features/savings-goals.js`)

| Field | Rule | Toast message |
|-------|------|--------------|
| Name | `trim()` must be non-empty | `"Ingresa un nombre para la meta"` |
| Target | `parseFloat(val)` must be finite and > 0 | `"Ingresa una meta válida"` |

### Recurring rule save (`index.html` or `js/features/recurring.js`)

| Field | Rule | Toast message |
|-------|------|--------------|
| Amount | `parseFloat(val)` must be finite and > 0 | `"Ingresa un monto válido"` |

### Goals budget inputs (`index.html` — `saveGoals`)

Each budget goal input: `parseFloat(val)` — if result is negative or non-finite, silently clamp to `0`. No toast needed — `0` is a valid "no goal set" value.

---

## What Is NOT Changed

- No changes to Firestore document structure
- No changes to state shape
- No new UI components — `showToast` already exists
- `user.photoURL` remains unescaped (Firebase Auth-issued URL, not user-editable input — intentional)
- `entry.description` and `goal.name` being empty after save is not blocked — zero-length strings are allowed at save time (only savings goal name requires non-empty)

---

## Files Changed

| File | Change |
|------|--------|
| `js/features/category-customization.js` | `esc()` in `renderColorPickerMarkup` |
| `js/features/selection-ui.js` | `esc()` in `renderFrequencyButtons` |
| `js/core/selectors.js` | Coerce fields in `sanitizeRecurringRule` |
| `js/core/storage.js` | Coerce `entry.amount` in `normalizeState` |
| `index.html` | Validate amount + date in entry save; validate goals budget inputs |
| `js/features/savings-goals.js` | Validate name + target in goal save |
| `js/features/recurring.js` | Validate amount in recurring save |
