# Payment Method Tagging — Design Spec

**Date:** 2026-03-25
**Approach:** B — metadata only, no balance tracking
**Status:** Approved

---

## Overview

Add an optional `accountId` field to entries so users can tag each transaction with the payment method used (e.g. BBVA Débito, Efectivo, Tarjeta de crédito). Purely a label — no balance reconciliation, no credit cycle tracking. Treated exactly like `category`: a colored label that can be filtered, charted, and exported.

---

## State Shape

### New top-level key: `accounts[]`

```js
accounts: [
  { id: string, label: string, type: 'debit'|'credit'|'cash', color: string }
]
```

**Default accounts** (applied when field is absent — existing users):
| id | label | type | color |
|---|---|---|---|
| `acc_bbva` | BBVA Débito | debit | `#5b8af0` |
| `acc_cash` | Efectivo | cash | `#3dd68c` |
| `acc_cc` | Tarjeta de crédito | credit | `#f05b5b` |

### Entry field: `accountId`

```js
accountId: string | null   // null = untagged
```

No migration needed — `null` is valid and means "untagged". All existing entries remain valid.

---

## Files Changed

| File | Change |
|------|--------|
| `js/core/config.js` | Add `DEFAULT_ACCOUNTS` array |
| `js/core/storage.js` | `STORAGE_KEYS` + `createEmptyState` + `normalizeState` + `readLocalState` + `writeLocalState` + `serializeCloudState` |
| `js/features/entries.js` | `renderEntryMarkup` — colored dot + label in `entry-meta` when `accountId` set |
| `js/features/export.js` | Add `Cuenta` column (after `Meta de ahorro`) in Movimientos sheet |
| `js/features/charts.js` | New `renderAccountBarChart()` function |
| `index.html` | Log form, edit modal, goals tab management section, chart tab/panel, all wiring |

---

## Component Details

### storage.js

- Add `bl_accounts` to `STORAGE_KEYS`
- `createEmptyState` returns `accounts: [...DEFAULT_ACCOUNTS]`
- `normalizeState`: if `source.accounts` is a non-empty array, use it (with sanitization per item); else fall back to `DEFAULT_ACCOUNTS`
  - Sanitize each account: `id` (string), `label` (string, max 80 chars), `type` (one of `'debit'|'credit'|'cash'`), `color` (valid hex)
- `readLocalState` / `writeLocalState`: include `accounts` via `bl_accounts` key
- `serializeCloudState`: include `accounts`

### config.js

```js
DEFAULT_ACCOUNTS: [
  { id: 'acc_bbva',  label: 'BBVA Débito',         type: 'debit',  color: '#5b8af0' },
  { id: 'acc_cash',  label: 'Efectivo',             type: 'cash',   color: '#3dd68c' },
  { id: 'acc_cc',    label: 'Tarjeta de crédito',   type: 'credit', color: '#f05b5b' }
]
```

### Log form (index.html)

Add below the category grid, above the date field:

```html
<div class="form-group" id="accountGroup">
  <label class="form-label" for="logAccountId">Cuenta (opcional)</label>
  <select class="form-input" id="logAccountId">
    <option value="">— Sin cuenta —</option>
    <!-- populated by renderAccountSelect() -->
  </select>
</div>
```

`logEntry()` reads `logAccountId.value || null` and writes to `entry.accountId`.

### Edit modal (index.html)

Same `<select>` pattern with id `editAccountId`, placed in the same position (below category grid, above date). `openEdit()` sets `editAccountId.value = entry.accountId || ''`.

### entries.js — renderEntryMarkup

In `entry-meta` line, append account label after category label when `entry.accountId` is set:

```
14 mar · Alimentos · <dot>BBVA Débito
```

The dot uses the account's color. Requires `accounts` passed in `options`.

### export.js

Movimientos sheet header becomes:
```
['Fecha','Tipo','Descripción','Notas','Categoría','Meta de ahorro','Cuenta','Monto (MXN)']
```

New `accMap` built from `accounts` array. Entry row adds `accMap[entry.accountId]||''` at index 6.

Column width `!cols` updated to add `{wch:18}` for Cuenta.

### charts.js — renderAccountBarChart

New function, same signature pattern as `renderCategoryBarChart`:

```js
function renderAccountBarChart(options) {
  const { Chart, instances, canvas, titleEl, entries, viewYear, viewMonth, monthKey, entryMonth, accounts, monthNames } = options;
  // Filter current month expenses with accountId set
  // Group by accountId, sum amounts
  // Horizontal bar chart (indexAxis: 'y'), each bar colored with account.color
  // Returns false if no tagged entries found
}
```

### Charts tab (index.html)

New tab button:
```html
<button class="chart-tab" id="ctab-cuentas" data-chart-tab="cuentas">Cuentas</button>
```

New panel:
```html
<div class="chart-panel" id="cpanel-cuentas">
  <div class="chart-card">
    <div class="chart-card-title" id="accountChartTitle">Gastos por cuenta</div>
    <div class="chart-wrap"><canvas id="accountChart"></canvas><div id="accountChartEmpty"></div></div>
  </div>
</div>
```

Chart is rendered when the tab is activated (lazy, same pattern as existing tabs). If no tagged entries, shows empty state text in `accountChartEmpty`.

### Account management (goals tab)

New button "Cuentas" added next to "Categorías" button:
```html
<button class="cat-customize-btn" onclick="openAccountModal()">&#128179; Cuentas</button>
```

New modal `#accountModal` following the exact same structure as `#catCustomModal`:
- List of account rows: color swatch (opens `colorPickerPop`), label input, delete button
- `type` is internal metadata only — not shown or editable in the UI; new user-added accounts default to `'debit'`
- "Agregar cuenta" button at bottom (generates new id `acc_` + timestamp)
- "Guardar cambios" button calls `saveAccountCustomize()` which updates `accounts`, calls `save()`, re-renders selects

Uses `colorPickerPop` (already exists) for color selection. Same interaction pattern.

---

## Wiring (index.html composition)

- `accounts` added to global state destructure alongside `entries`, `goals`, etc.
- `renderAccountSelect(selectEl)` helper populates both log and edit selects
- Called in `renderAll()` alongside other renders
- `renderCharts()` passes `accounts` to `renderAccountBarChart`
- `openEdit()` sets `editAccountId.value`
- `logEntry()` and `saveEdit()` read `accountId` from their respective selects

---

## What This Does NOT Do

- No balance tracking
- No credit cycle or statement periods
- No account-level filtering in the entries list (v1 scope — accountId is display-only in entries)
- No import/reconciliation
- Cloud Functions (`budgetAlerts`, `weeklyDigest`) unchanged — they don't need account data

---

## Testing Checklist

1. Fresh user — 3 default accounts appear in selects; no crashes
2. Existing user (no `accounts` field in Firestore) — normalizeState returns defaults
3. Log entry with account → appears in entry-meta line
4. Log entry without account → no account line shown, no crash
5. Edit entry → accountId pre-filled correctly
6. Export → Cuenta column present, blank for untagged entries
7. Charts > Cuentas tab → bar chart appears when at least one tagged entry exists this month
8. Add/rename/delete account in modal → reflected immediately in selects and cards
9. Sign out → sign in — accounts round-trip through Firestore
