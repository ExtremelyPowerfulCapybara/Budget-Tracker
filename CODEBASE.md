# BudgetLog — Codebase Documentation

Personal finance PWA. Spanish UI, MXN currency, mobile-first dark theme.
No build step — files are served as-is from Firebase Hosting.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Pattern](#module-pattern)
3. [Core Modules](#core-modules)
   - [config.js](#jscoreconfig-js)
   - [utils.js](#jscoreutils-js)
   - [storage.js](#jscorestorage-js)
   - [cloud.js](#jscorecloud-js)
   - [selectors.js](#jscoreselectors-js)
4. [Feature Modules](#feature-modules)
   - [app-shell.js](#jsfeaturesapp-shell-js)
   - [dashboard.js](#jsfeaturesdashboard-js)
   - [entries.js](#jsfeaturesentries-js)
   - [recurring.js](#jsfeaturesrecurring-js)
   - [charts.js](#jsfeaturescharts-js)
   - [savings-goals.js](#jsfeaturessavings-goals-js)
   - [export.js](#jsfeaturesexport-js)
   - [selection-ui.js](#jsfeaturesselection-ui-js)
   - [category-customization.js](#jsfeaturescategory-customization-js)
5. [index.html — Composition Layer](#indexhtml--composition-layer)
   - [CSS & Design System](#css--design-system)
   - [HTML Shell](#html-shell)
   - [Inline Script — State & Wiring](#inline-script--state--wiring)
6. [Cloud Functions](#cloud-functions)
   - [budgetAlerts](#budgetalerts)
   - [weeklyDigest](#weeklydigest)
7. [Firebase & Infrastructure](#firebase--infrastructure)
8. [Data Flow](#data-flow)
9. [State Shape Reference](#state-shape-reference)

---

## Architecture Overview

BudgetLog uses a **plain HTML/CSS/JS stack** with no bundler or framework. All logic is split into small JS files that each register themselves onto global namespaces (`window.BudgetLogCore` for shared utilities, `window.BudgetLogFeatures` for UI features). `index.html` acts as the composition layer — it loads the scripts in order, wires events, holds all state in memory, and calls feature modules to render HTML strings into the DOM.

```
Firebase Hosting (serves files as-is)
    └── index.html              ← app entry point, all CSS, HTML shell, composition script
        ├── js/core/            ← shared utilities loaded first
        │   ├── config.js
        │   ├── utils.js
        │   ├── storage.js
        │   ├── cloud.js
        │   └── selectors.js
        └── js/features/        ← UI feature modules loaded after core
            ├── app-shell.js
            ├── dashboard.js
            ├── entries.js
            ├── recurring.js
            ├── charts.js
            ├── savings-goals.js
            ├── export.js
            ├── selection-ui.js
            └── category-customization.js
```

Backend is entirely Firebase: Firestore for data persistence, Firebase Auth for Google sign-in, Firebase Cloud Messaging for push notifications, and Cloud Functions for scheduled background jobs.

---

## Module Pattern

Every JS file (both core and features) uses the same **IIFE pattern**:

```js
(function(){
  const root = window.BudgetLogCore = window.BudgetLogCore || {};
  // ... define functions ...
  root.myModule = { fn1, fn2 };
})();
```

The IIFE runs immediately and attaches an object of exported functions to the global namespace. This avoids polluting `window` with individual function names while keeping the files compatible with plain `<script>` tags (no `import`/`export`). Features use `window.BudgetLogFeatures` instead of `BudgetLogCore`.

---

## Core Modules

### `js/core/config.js`

Defines all **static constants** for the app. Nothing dynamic — just data.

- **`firebaseConfig`** — API keys and project identifiers for connecting to Firebase. Used once at startup to call `firebase.initializeApp()`.
- **`CATEGORIES`** — Array of the 10 built-in expense categories, each with a fixed `id`, display `label` (in Spanish), and a `color` hex string. The `id` is permanent and used as the key everywhere in state. Labels and colors can be overridden by users via `customCategories`.
- **`FREQUENCIES`** — The three recurrence options (`monthly`, `biweekly`, `weekly`) with their display labels.
- **`DEFAULT_GOALS`** — Starting monthly budget targets in MXN for each category plus income. Applied to new users or as fallback when a user has no saved goal for a category.
- **`MONTH_NAMES`** — Spanish month name array, indexed 0–11.
- **`CAT_COLORS`** — Same colors as `CATEGORIES` but as a plain object keyed by category ID, used for quick lookup in charts.
- **`PALETTE`** — 14-color array used when users create custom categories.
- **`SG_COLORS`** — 8-color array offered as presets when creating savings goals.

---

### `js/core/utils.js`

A collection of **pure utility functions** with no side effects. All exported onto `window.BudgetLogCore.utils`.

- **`MXN(n)`** — Formats a number as Mexican peso currency string (`$1,234.56`) using `toLocaleString('es-MX')`. Always uses the absolute value, so callers handle sign separately.
- **`pad2(n)`** — Left-pads a number to 2 digits. Used when building `YYYY-MM-DD` and `YYYY-MM` strings.
- **`toISODate(date)`** — Converts a JS `Date` object to `YYYY-MM-DD` string without timezone drift (avoids `.toISOString()` which can shift the day for UTC-offset timezones).
- **`parseISODate(value)`** — Parses a `YYYY-MM-DD` string back to a `Date`. Returns `null` for invalid input. Uses the local date constructor `new Date(y, m-1, d)` to avoid UTC issues.
- **`addDays(isoString, days)`** — Advances an ISO date string by N days and returns a new ISO string. Used by the recurring scheduler to walk through biweekly/weekly intervals.
- **`datesEqualOrBefore(a, b)`** — String comparison of two ISO dates (lexicographic order works for `YYYY-MM-DD`).
- **`daysInMonth(year, monthIndex)`** — Returns the number of days in a given month using the `new Date(y, m+1, 0)` trick.
- **`monthKey(year, monthIndex)`** — Produces a `YYYY-MM` string from a year and 0-based month index. This is the canonical key used to group entries by month.
- **`entryMonth(entry)`** — Extracts the `YYYY-MM` prefix from an entry's `date` field. The primary lookup key for filtering entries.
- **`compareMonthRefs(yearA, monthA, yearB, monthB)`** — Compares two month references by converting to a linear month count (`year * 12 + monthIndex`). Returns -1, 0, or 1.
- **`escapeHtml(str)` / `esc`** — Escapes `&`, `<`, `>`, `"`, `'` to prevent XSS when interpolating user data into HTML strings. Every feature module imports this and uses it on all dynamic values.

---

### `js/core/storage.js`

Manages **reading and writing state** to both `localStorage` (offline) and Firestore (cloud). Exported onto `window.BudgetLogCore.storage`.

- **`STORAGE_KEYS`** — Maps each top-level state key to its `localStorage` key string (e.g., `entries → 'bl_entries'`).

- **`createEmptyState(defaultGoals)`** — Returns a fresh state object with empty arrays and the provided default goals. Used for new users and as the baseline in `normalizeState`.

- **`normalizeState(rawState, { defaultGoals, sanitizeRecurringRule })`** — The most important function in storage. Runs on every load and defends against missing or corrupt fields from old Firestore documents. Key behaviors:
  - Entries: spreads each entry object with `{...e, ...}` so unknown fields (like `notes`) survive round-trips. Re-parses `amount` as a float and clamps to ≥ 0.
  - Goals: merges saved goals with `defaultGoals` so newly added categories always have a fallback.
  - Recurring rules: runs each through `sanitizeRecurringRule` to fill in missing fields.
  - Returns a complete, valid state object regardless of what was in the raw data.

- **`readLocalState(options)`** — Reads the five localStorage keys, parses the JSON, and passes through `normalizeState`. Called as a fallback when Firestore is unavailable or the user has no cloud document.

- **`writeLocalState(state)`** — Serializes and writes each state key to localStorage. Called on every save to keep an offline copy.

- **`serializeCloudState(state)`** — Strips the state to only the fields that should be written to Firestore (the five top-level keys). Prevents local-only metadata from polluting the cloud document.

- **`hasAnyEntries(state)`** — Returns true if the state has at least one entry. Used during sign-in to decide whether to migrate local data to the cloud.

---

### `js/core/cloud.js`

Handles **Firebase Auth and Firestore interactions**. Exported onto `window.BudgetLogCore.cloud`.

- **`createUserDocRef(db, user)`** — Returns a Firestore document reference at `users/{uid}`, or `null` if no user. This ref is passed around the app as `userDocRef`.

- **`signInWithGoogle(auth, firebase)`** — Opens the Google OAuth popup and returns the promise. The result is handled in the `index.html` auth observer.

- **`setSyncIndicator(dot, state)`** — Updates the CSS class and `title` attribute of the small sync indicator dot in the header. States are `'syncing'`, `'error'`, or anything else (treated as "ok").

- **`loadUserState(options)`** — The auth-time data loading sequence:
  1. Sets sync state to `'syncing'`.
  2. Fetches the Firestore document for the signed-in user.
  3. If the document exists, applies it to the app state.
  4. If the document does not exist (first sign-in), reads localStorage. If there's existing local data, writes it to Firestore (migration). Shows a toast confirming the migration.
  5. On any Firestore error, falls back to localStorage and marks sync as `'error'`.

- **`persistUserState(options)`** — Writes the current state to Firestore using `.set()` (full overwrite), adding `updatedAt: serverTimestamp()`. Shows sync states before and after.

---

### `js/core/selectors.js`

**Pure computation functions** that derive data from state. No DOM access, no side effects. Exported onto `window.BudgetLogCore.selectors`.

- **`getMonthEntriesByKey(entries, mk)`** — Filters the entries array to only those whose `entryMonth` matches the given `YYYY-MM` key.

- **`getMonthTotals(entries, mk)`** — Returns `{ monthEntries, income, expense, net }` for a given month key. The source of the numbers shown in the dashboard summary row.

- **`sanitizeRecurringRule(rule)`** — Fills in default values for any missing or invalid fields in a recurring rule object. Handles all three frequency types, normalizes amounts, and derives `anchorDate` and `day` if not present. Run on every recurring rule on load and before use.

- **`getRecurringOccurrenceDates(rule, year, monthIndex)`** — Given a recurring rule and a target month, returns an array of ISO date strings for every time that rule fires in that month. For `monthly` rules this is always one date; for `weekly`/`biweekly` it walks forward from `anchorDate` in N-day steps until it exits the month.

- **`hasGeneratedRecurringEntry(entries, ruleId, date)`** — Checks whether an entry already exists for a given rule+date combination (by `recurringId` and `recurringDate`). Prevents duplicate application.

- **`createRecurringEntry(rule, date)`** — Builds a new entry object from a recurring rule for a specific date. Sets `recurringId` and `recurringDate` for deduplication tracking.

- **`getPendingRecurringDates(entries, rule, year, monthIndex, cutoffDate)`** — Combines `getRecurringOccurrenceDates` and `hasGeneratedRecurringEntry` to find dates that need a new entry. Also enforces the cutoff: future dates in the current month are not applied yet.

- **`getApplyCutoffForMonth(year, monthIndex)`** — Determines the date up to which recurring entries should be applied. Returns today's date for the current month, `null` for past months (apply everything), and `''` for future months (apply nothing).

- **`applyRecurringForMonth(entries, recurring, year, monthIndex, cutoffDate)`** — The main recurring engine. Loops over all recurring rules, finds pending dates, creates entries for them, and returns updated `entries` and `recurring` arrays plus a count of entries added.

- **`getForecastTotals(recurring, year, monthIndex)`** — Computes projected income and expense totals for a given month based on recurring rules, without touching actual entries. Used by the forecast card on the dashboard.

- **`getGoalSavedAmount(entries, savingsGoals, goalId)`** — Sums all savings-category expenses linked to a specific goal ID. Handles the edge case where there is only one savings goal (all unlinked savings entries count toward it).

- **`getUnassignedSavingsAmount(entries, savingsGoals)`** — Returns the total of savings entries with no `goalId`, but only when there are multiple goals (ambiguous assignment).

- **`getRolloverGoal(entries, goals, categoryId, year, monthIndex)`** — Implements budget rollover. Looks at the previous month's spending for a category, computes `surplus = max(0, goal - prevSpent)`, and returns `currentGoal + surplus` as the effective goal. If the category has no goal, returns 0. This allows unspent budget from one month to carry forward.

---

## Feature Modules

Feature modules only return HTML strings. They never touch the DOM directly and receive everything they need via an `options` parameter.

### `js/features/app-shell.js`

Controls **high-level screen switching and UI chrome**. Exported onto `window.BudgetLogFeatures.appShell`.

- **`showAuthScreen()` / `showAppShell()`** — Toggle visibility between the sign-in screen (`authScreen`), the loading spinner (`loadingScreen`), and the main app (`appShell`) by setting `style.display`.
- **`renderHeaderAvatar(user)`** — Injects either a `<img>` with the user's Google photo or a div showing their initials into the header avatar slot.
- **`populateUserModal(user)`** — Fills the account modal with the user's name and email.
- **`openModal(id)` / `closeModal(id)`** — Add/remove the `.open` class on modal overlays. The CSS handles the actual show/hide.
- **`renderOnboardDots(totalSteps, activeStep)`** — Returns HTML for the step indicator dots in the onboarding carousel.
- **`showOnboardingStep(step, totalSteps)`** — Toggles `.active` on each onboarding step panel and dot, and updates the Next button text (shows "Empezar 🚀" on the last step).
- **`applyTheme(theme)`** — Toggles the `.light` class on `<body>` and updates the theme toggle button emoji.
- **`renderNotificationButton(hasToken)`** — Updates the notifications button text and class depending on whether an FCM token is stored.

---

### `js/features/dashboard.js`

Renders the **dashboard tab content** as HTML strings. Exported onto `window.BudgetLogFeatures.dashboardFeature`.

- **`renderInsightMarkup(options)`** — Computes and returns the "Resumen del mes" card showing savings rate, biggest spending category, and month-over-month deltas for income and expenses. Returns an empty string if both income and expense are zero (triggers empty state in the caller). Uses delta pills (colored percentage badges) to show the direction of change vs the previous month.

- **`renderCategoryBarsMarkup(options)`** — Renders horizontal progress bars for each expense category. For each category with any spending or a goal set, it shows the category name, actual spent vs goal, a progress bar, and a percentage. Accepts an optional `getEffectiveGoal(categoryId)` function — if provided, that is used instead of `goals[id]` directly. This is the hook used for budget rollover. Bars turn red when spending exceeds the goal.

- **`renderRecentEntriesMarkup(options)`** — Returns markup for the 5 most recent entries of the month, sorted by date descending. Delegates to a `renderEntry` callback for each item.

- **`renderForecastMarkup(options)`** — Computes the forecast for the *next* month (not the viewed month) using `getForecastTotals`, and returns a card showing projected income, expenses, and net. Returns empty if there are no recurring rules producing anything for that month.

---

### `js/features/entries.js`

Handles **entry list rendering and filtering**. Exported onto `window.BudgetLogFeatures.entriesFeature`.

- **`buildEntryFilters(categories, activeFilter)`** — Returns a row of chip buttons: "Todos", "Ingresos", "Gastos", then one per category. The currently active filter gets the `.active` class.

- **`renderEntryMarkup(entry, options)`** — Returns the HTML for a single entry card. Includes:
  - A colored dot (category color for expenses, green for income)
  - Description, date, category label, savings goal name (if linked)
  - An optional italic notes line if `entry.notes` is present
  - Amount formatted with sign
  - Edit (✎) and delete (✕) action buttons using `data-entry-action` attributes for event delegation
  - Touch swipe gesture attributes (`ontouchstart`, `ontouchmove`, `ontouchend`) for swipe-to-delete on mobile

- **`filterEntries(entries, options)`** — Applies the active filter (type or category) and then the search query. The search checks description, formatted amount, and category label. Returns the filtered array.

- **`renderEntriesListMarkup(entries, renderEntry)`** — Sorts entries newest-first and maps each through the `renderEntry` callback. Returns an empty string for empty arrays (lets the caller show an empty state).

---

### `js/features/recurring.js`

Renders the **recurring rules list**. Exported onto `window.BudgetLogFeatures.recurringFeature`.

- **`FREQUENCY_LABELS`** — Maps frequency IDs to Spanish display labels (`monthly → 'Mensual'`, etc.).

- **`renderRecurringListMarkup(options)`** — Maps each recurring rule to a card showing the rule's description, frequency, start date, savings goal link (if any), and amount with sign. Each card has an edit button (✎, `data-recurring-edit`) and a delete button (✕, `data-recurring-delete`). The color dot reflects income (green) or the category color for expenses.

- **`buildPendingRecurring(items)`** — Flattens an array of `{ id, pendingDates[] }` objects into individual `{ ruleId, date }` pairs. Used to count and display the pending apply banner.

---

### `js/features/charts.js`

All five **Chart.js chart renderers**. Exported onto `window.BudgetLogFeatures.charting`.

Uses a shared `CHART_DEFAULTS` object (lines 5–27) with consistent dark-theme styling — background color, tooltip colors, grid colors, and Lexend Mono tick fonts. Every chart spreads these defaults and overrides only what it needs.

- **`destroyChart(instances, id)`** — Calls `.destroy()` on an existing Chart.js instance before recreating it on the same canvas. Prevents the "Canvas already in use" error and memory leaks. The `instances` object lives in `index.html`, not here.

- **`getLastMonths(viewYear, viewMonth, monthKey, count)`** — Returns an array of `count` consecutive `YYYY-MM` keys ending at the given month, walking backward. Used by all multi-month charts.

- **`buildCategorySelectorMarkup(categories, selectedCategoryId, catColors)`** — Returns pill buttons for the category line chart's category picker.

- **`renderCategoryBarChart(options)`** — Horizontal grouped bar chart (Chart.js `indexAxis: 'y'`) showing actual spending vs goal for each category in the current month. Canvas height is computed dynamically based on the number of bars (`Math.max(180, cats.length * 44)`). Only renders categories with spending or a goal.

- **`renderTrendChart(options)`** — Grouped bar chart showing income (green) and expense (red) side-by-side for the last N months. Accepts `rangeMonths` (default 6) to support the 3M/6M/12M range toggle. Returns `false` if all data is zero.

- **`renderNetChart(options)`** — Single bar chart where each bar is the net (income minus expense) for a month. Bar colors are per-value: green for positive, red for negative. Also accepts `rangeMonths`. Returns `false` if all zeros.

- **`renderCategoryLineChart(options)`** — Line chart showing one category's spending over the last 6 months, with an optional flat goal reference line (dashed yellow). Returns `false` if both data and goal are zero.

- **`renderPieChart(options)`** — Doughnut chart of this month's expenses by category, showing percentage in the tooltip. Legend is positioned at the bottom.

---

### `js/features/savings-goals.js`

Renders **savings goal cards and the creation/edit modal state**. Exported onto `window.BudgetLogFeatures.savingsGoalsFeature`.

- **`renderSavingsGoalsMarkup(options)`** — Maps each savings goal to a card showing the goal name, saved amount vs target, progress bar, and edit/delete buttons. If there are savings entries not linked to any goal (and multiple goals exist), shows a notice about unassigned savings. Appends a "+ Nueva meta de ahorro" button at the bottom.

- **`renderSavingsColorGridMarkup(colors, selectedColor)`** — Returns color swatch divs for the goal color picker. The selected color gets an `.active` class.

- **`prepareSavingsModalState(savingsGoals, id, fallbackColor)`** — Given an optional goal ID, returns the title, name, target, and color to pre-fill the modal. Returns empty defaults when creating a new goal.

---

### `js/features/export.js`

Generates the **XLSX export file** using the SheetJS library. Exported onto `window.BudgetLogFeatures.exporting`.

`exportBudgetData(options)` builds a workbook with four sheets:

1. **Movimientos** — Every entry sorted by date. Columns: Fecha, Tipo, Descripción, Notas, Categoría, Meta de ahorro, Monto (MXN). Income amounts are positive, expenses negative. Category and savings goal names are resolved from lookup maps.

2. **Resumen** — One row per month with totals: Ingresos, Gastos, Saldo neto, Tasa de ahorro %. Only months that have at least one entry appear.

3. **Por categoría** — Pivot table: rows are categories, columns are months. Each cell is the total expense for that category in that month. A TOTAL row and TOTAL column are appended.

4. **Metas** — One row per category showing the monthly goal, actual spending (for the selected month scope), difference, and % of goal reached.

The caller passes `exportScope` (`'month'` or `'all'`) to determine whether the Metas sheet uses the currently viewed month or the most recent month with data.

---

### `js/features/selection-ui.js`

Reusable **category and frequency grid renderers**. Exported onto `window.BudgetLogFeatures.selectionUi`.

- **`renderCategoryGridMarkup(options)`** — Returns a row of category pill buttons. The selected category gets a border and tinted background in that category's color. Each button carries `data-selection-action` and `data-selection-id` attributes for event delegation.

- **`renderFrequencyGridMarkup(frequencies, selectedId)`** — Same pattern for the three frequency options (Mensual / Quincenal / Semanal).

---

### `js/features/category-customization.js`

Renders the **category rename/recolor/add/delete panel**. Exported onto `window.BudgetLogFeatures.categoryCustomization`.

- **`cloneCategoryDraft(categories)`** — Creates a plain object copy of the current categories keyed by ID. This draft is edited locally during the customization session and only committed when the user saves.

- **`renderCategoryCustomListMarkup(categoryIds, draft)`** — Returns a list row for each category showing a color dot (clickable to open color picker), a text input for the label, a badge showing "Base" or "Nueva", and a delete button only for custom categories.

- **`renderColorPickerMarkup(palette, selectedColor)`** — Returns the color swatch grid for the popover color picker. Selected swatch gets `.active` class.

---

## `index.html` — Composition Layer

`index.html` is the largest file in the project. It contains all CSS, the HTML app shell, and an inline `<script>` that wires everything together. It is the **only place** state lives at runtime, and the only place DOM mutation happens.

### CSS & Design System

Lines 1–540 of the `<style>` block define the entire visual language:

- **CSS variables** on `:root` (`--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--accent`, `--income`, `--expense`, `--font-ui`, `--font-mono`) are the only source of truth for colors and fonts. No hex values appear elsewhere in the CSS.
- **`.light` overrides** on `body.light` swap the color variables for the light theme without touching any component styles.
- **Component styles** are flat, non-nested, and follow a consistent naming pattern: `.entry-item`, `.entry-desc`, `.entry-meta`, `.recur-card`, `.chart-card`, etc.
- **Responsive breakpoints** at `@media (min-width: 480px)` adjust grid columns and spacing for wider screens.

### HTML Shell

The visible HTML structure:

- **`#loadingScreen`** — Shown immediately on load, hidden once auth resolves.
- **`#authScreen`** — The sign-in prompt with the Google button.
- **`#appShell`** — The main app, hidden until auth succeeds.
  - **`.header`** — Fixed top bar with month label, sync dot, theme toggle, notification button, and avatar.
  - **`.views`** — Scroll container holding one `.view` div per section (log, entries, recurring, charts, goals, savings, insights). Only the active view is visible.
  - **`.nav`** — Fixed bottom navigation with one button per view.
- **Modals** — `#editModal`, `#exportModal`, `#savingsModal`, `#catCustomizeModal`, `#userModal` — positioned fixed and toggled via the `.open` class.

### Inline Script — State & Wiring

The `<script>` block starting around line 560 is the composition layer:

**Bootstrapping (lines ~560–600)**
- Destructures all exported functions from `BudgetLogCore` and `BudgetLogFeatures` into local variables.
- Declares the mutable state variables: `entries`, `goals`, `recurring`, `savingsGoals`, `customCategories` — initialized from `createEmptyState`.
- Declares UI state: `currentType`, `currentCat`, `recurType`, `recurCat`, `recurFreq`, `editCat`, `editId`, `activeFilter`, `editingRecurringId`, `viewYear`, `viewMonth`, `activeChartTab`, `chartCatSelected`, `chartInstances`, `trendRange`, `netRange`.

**Auth observer (lines ~600–640)**
- `firebase.auth().onAuthStateChanged()` is the main entry point. On sign-in, it calls `loadUserState`, then triggers the initial render and recurring auto-apply. On sign-out, it shows the auth screen.

**Event binding (lines ~640–730)**
- `bindStaticEvents()` attaches all delegated click handlers to static containers: nav buttons, chart tabs, chart range toggles, entry list actions, recurring list actions, savings goal actions, category customization actions, filter chips, swipe gestures.
- The pattern throughout is `event.target.closest('[data-attribute]')` to find the nearest matching ancestor, avoiding the need for handlers on individual elements.

**Rendering functions (lines ~800–980)**
- `renderDashboard()` — Calls all dashboard sub-renders: header labels, totals, insight card, category bars (with rollover goal), spending insights, recent entries, savings goals, forecast.
- `renderEntries()` — When a search query is active, sources from all `entries`; otherwise filters to the current month. Hides/shows the month selector accordingly.
- `renderRecurring()` — Updates the form title/button based on `editingRecurringId`, rebuilds the category and frequency grids, checks for pending entries, and renders the rule list.
- `renderActiveChart()` — Dispatches to `renderCatBarChart`, `renderTrendChart`/`renderNetChart`, or `renderCatLineChart` based on `activeChartTab`. Chart functions receive `rangeMonths` from the per-chart range state variables.
- `save()` — Calls both `writeLocalState` (localStorage) and `persistUserState` (Firestore) after every mutation.

**Entry management**
- `logEntry()` — Reads the log form, validates, and unshifts a new entry object (including `notes` if present) to the front of the `entries` array.
- `initLog()` — Resets the log form to defaults after saving or on tab switch.
- `openEdit(id)` / `saveEdit()` — Pre-fills and saves the edit modal, including notes.
- `deleteEntry(id)` — Filters the entry out of the array.

**Recurring management**
- `addRecurring()` — Handles both create and edit modes by checking `editingRecurringId`. If editing, replaces the existing rule in-place preserving `lastApplied` and `createdAt`.
- `openEditRecurring(id)` — Finds the rule, pre-fills all form fields, scrolls to the form.
- `deleteRecurring(id)` — Also clears `editingRecurringId` if the rule being deleted is the one being edited.
- `applyRecurring()` — Calls the selector engine, updates state, saves, and re-renders.

**Push notifications**
- FCM is initialized at startup (lines ~986–988) by checking for `serviceWorker` and `PushManager` support and calling `firebase.messaging()`. The result is stored in `messaging`.
- `toggleNotifications()` — If no token is stored, requests permission, registers the service worker, calls `messaging.getToken()`, and saves the token to both localStorage and Firestore. If a token exists, removes it from both.

---

## Cloud Functions

Both functions live in `functions/index.js` and are deployed as Firebase Cloud Functions (Node.js, 1st Gen, `us-central1`). They share the same admin SDK instance initialized at the top of the file.

### `budgetAlerts`

**Schedule:** Daily at 8:00am Mexico City time (`0 14 * * *` UTC).

**What it does:**
1. Fetches all documents from the `users` Firestore collection.
2. For each user with an `fcmToken`, computes this month's spending per category.
3. Skips users with no goals or no spending.
4. For each category with spending, checks the ratio `spent / goal`:
   - `≥ 100%` → 🔴 over budget alert
   - `≥ 80%` → 🟡 warning alert
   - `≥ 50%` → 🔵 halfway alert
5. Sends an FCM push notification with up to 3 alerts joined by ` · ` as the body.
6. Cleans up expired FCM tokens (catches `messaging/registration-token-not-registered` and deletes the token field from Firestore).

Category labels are resolved by checking `customCategories` first, then the hardcoded `CATEGORY_LABELS` map, then falling back to the raw category ID.

### `weeklyDigest`

**Schedule:** Every Monday at 9:00am Mexico City time (`0 15 * * 1` UTC).

**What it does:**
1. Fetches all user documents.
2. For each user with an `fcmToken`, looks at expense entries from the last 56 days.
3. Computes last-7-days spending per category.
4. Computes a 7-week average per category from the prior 7 weeks (days 8–56 ago, divided by 7).
5. Detects **spending spikes**: categories where last-7-days spend is ≥ 120% of the 7-week average.
6. Builds a notification body with up to 3 parts:
   - Total spent in the last 7 days
   - Top 2 categories by spend
   - Any spiking categories flagged with ⚠️ and the % above average
7. Sends via FCM and applies the same expired token cleanup as `budgetAlerts`.

---

## Firebase & Infrastructure

| Service | Usage |
|---------|-------|
| **Firebase Hosting** | Serves the repo root (`.`) as static files. No rewrite rules. |
| **Firebase Auth** | Google Sign-In only. Auth state drives the entire app lifecycle. |
| **Cloud Firestore** | One document per user at `users/{uid}`. Entire state in one doc. |
| **Firebase Cloud Messaging** | Web push via service worker (`firebase-messaging-sw.js`). VAPID key hardcoded in index.html. |
| **Cloud Functions** | Two scheduled functions: daily budget alerts and weekly digest. |
| **Firestore Security Rules** | `firestore.rules` — only authenticated users can read/write their own document. |

**Deploy commands:**
- `firebase deploy --only hosting` — most common, pushes frontend changes live
- `firebase deploy --only functions` — when Cloud Functions changed
- `firebase deploy --only firestore:rules` — when security rules changed
- `firebase deploy` — everything at once

GitHub pushes do **not** auto-deploy. Manual deploy is always required.

---

## Data Flow

```
User action (form submit, button click)
    → index.html inline handler
        → mutate state array (entries.unshift, recurring.map, etc.)
        → save()
            → writeLocalState()     (localStorage, synchronous)
            → persistUserState()    (Firestore, async)
        → render function (renderDashboard, renderEntries, etc.)
            → feature module returns HTML string
            → container.innerHTML = markup
```

On sign-in:
```
onAuthStateChanged(user)
    → createUserDocRef(db, user)
    → loadUserState()
        → Firestore doc exists?
            yes → applyState(doc.data())
            no  → readLocalState() → migrate to Firestore if has entries
    → applyCustomCategories()  ← merges customCategories into CATEGORIES
    → applyRecurringForMonth() ← auto-apply pending recurring entries
    → renderDashboard()
```

---

## State Shape Reference

```js
{
  entries: [{
    id: string,           // timestamp string, e.g. "1711234567890"
    type: "income" | "expense",
    amount: number,       // always positive
    description: string,
    notes: string | null, // optional free-text note
    category: string,     // category id; "income" for income entries
    date: "YYYY-MM-DD",
    recurringId: string | null,   // links to recurring[].id
    recurringDate: string | null, // the specific date this was generated for
    goalId: string | null         // links to savingsGoals[].id
  }],

  goals: {
    income: number,       // monthly income target
    food: number,         // monthly spend target per category
    restaurant: number,
    // ... one key per category id
  },

  recurring: [{
    id: string,
    type: "income" | "expense",
    amount: number,
    description: string,
    category: string,
    frequency: "monthly" | "biweekly" | "weekly",
    day: number,              // day of month (used for monthly)
    anchorDate: "YYYY-MM-DD", // reference date for interval calculation
    createdAt: "YYYY-MM-DD",
    lastApplied: string | null, // "YYYY-MM" of last application
    goalId: string | null
  }],

  savingsGoals: [{
    id: string,
    name: string,
    target: number,
    color: string   // hex
  }],

  customCategories: {
    [categoryId]: {
      label: string,
      color: string,
      isCustom?: boolean  // true only for user-created categories
    }
  }
}
```

All state is held in memory in `index.html`'s inline script. On every mutation, it is written to both localStorage (for offline access) and Firestore (for cross-device sync). On load, Firestore is the source of truth, with localStorage as the offline fallback.
