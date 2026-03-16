# BudgetLog Refactor And Fixes Summary

This document captures the major fixes, refactors, and follow-up notes completed during the recent maintenance pass on `BudgetLog`.

## Goals Of This Pass

The work focused on improving correctness first, then maintainability, without doing a risky rewrite or changing the app's visual identity.

Primary goals:

- Fix recurring entry behavior
- Fix savings goal tracking
- Normalize UI copy to Spanish
- Improve readability and spacing
- Reduce fragility in the single-file structure
- Incrementally modularize the app

## Main Issues Found

### 1. Recurring entries

Problems identified:

- Recurring rule storage and generation logic were not fully aligned.
- Weekly and biweekly rules were not being generated from a single reliable cadence source.
- Forecast logic used different assumptions from actual recurring generation.
- Duplicate recurring entries were possible without a stronger shared identity rule.

Fixes made:

- Centralized recurring schedule logic so monthly, weekly, and biweekly use the same source of truth.
- Weekly rules now generate every 7 days.
- Biweekly rules now generate every 14 days.
- Monthly rules generate from the configured cadence consistently.
- Forecast now uses the same recurring logic as actual generation.
- Duplicate recurring entries are prevented using recurring identity plus occurrence date.
- Current-month recurring apply was tightened so future-dated occurrences are not prematurely created.

## 2. Savings goals

Problems identified:

- All savings goals were effectively sharing one savings total.
- Savings-related entries were not properly allocated per goal.

Fixes made:

- Savings entries now support per-goal allocation via `goalId`.
- Each savings goal now calculates independent progress.
- Support was added for unassigned savings amounts where applicable.
- Recurring savings behavior was aligned with the same per-goal model.

## 3. UI language normalization

Problems identified:

- The product mixed English and Spanish across navigation, labels, actions, onboarding, and messages.

Fixes made:

- Product copy was standardized to Spanish across core visible flows.
- Labels such as navigation items, actions, charts, goals, recurring sections, export labels, and messages were normalized.
- Runtime normalization was added for a subset of fragile static copy to protect against broken text rendering in the UI.

## 4. Readability and spacing

Problems identified:

- Some mobile labels and muted/meta text were too small to read comfortably.

Fixes made:

- Small-text styles were increased where needed.
- Muted/meta text readability was improved.
- Spacing was adjusted in targeted places while preserving the existing dark, mobile-first design language.

## 5. Data and sync safety

Problems identified:

- First-time migration to Firestore could drop `savingsGoals` and `customCategories`.
- Sign-out left some state slices stale in memory.
- Export did not include per-goal savings allocation.
- Toast timing was race-prone.
- Service worker registration assumed a root deployment path.

Fixes made:

- Local `savingsGoals` and `customCategories` are preserved during first cloud migration.
- Sign-out clears all relevant in-memory state slices.
- Export now includes savings goal allocation details.
- Toast timing was made safer.
- Service worker registration now uses a safer path strategy for non-root hosting.

## Incremental Refactor Strategy

Instead of a rewrite, the app was split by responsibility into low-risk modules that can be loaded directly from `index.html` without adding bundling or build complexity.

## New Project Structure

### Core modules

- `js/core/config.js`
- `js/core/utils.js`
- `js/core/selectors.js`
- `js/core/storage.js`
- `js/core/cloud.js`

### Feature modules

- `js/features/app-shell.js`
- `js/features/dashboard.js`
- `js/features/entries.js`
- `js/features/recurring.js`
- `js/features/savings-goals.js`
- `js/features/charts.js`
- `js/features/export.js`
- `js/features/selection-ui.js`
- `js/features/category-customization.js`

## What Was Moved Where

### `js/core/config.js`

Centralized:

- Firebase config
- Shared category definitions
- Default goals
- Month names
- Shared color/palette constants

### `js/core/utils.js`

Centralized:

- Currency/date formatting helpers
- Month key helpers
- ISO date helpers
- Comparison and aggregation helpers

### `js/core/selectors.js`

Centralized:

- Month-based entry selection
- Monthly totals
- Recurring schedule calculations
- Forecast calculations
- Savings goal progress calculations

### `js/core/storage.js`

Centralized:

- Empty/default state
- Local storage read/write
- State normalization
- Firestore-safe state serialization

### `js/core/cloud.js`

Centralized:

- Google auth flow
- Firestore document reference creation
- Remote load/save wiring
- Sync state helpers

### `js/features/entries.js`

Centralized:

- Entry list rendering
- Filter chip rendering
- Entry filtering
- Entry item markup

### `js/features/recurring.js`

Centralized:

- Recurring list rendering
- Pending recurring item rendering
- Recurring-related markup helpers

### `js/features/savings-goals.js`

Centralized:

- Savings goal card rendering
- Savings empty states
- Savings color grid rendering
- Savings modal state preparation

### `js/features/charts.js`

Centralized:

- Chart instance lifecycle
- Category charts
- Trend charts
- Net balance charts
- Distribution charts
- Category selector behavior for charts

### `js/features/export.js`

Centralized:

- XLSX export generation
- Workbook/sheet creation
- Export filename generation

### `js/features/selection-ui.js`

Centralized:

- Category grid markup for log/edit/recurring flows
- Frequency selection UI

### `js/features/category-customization.js`

Centralized:

- Editable category customization list
- Category customization draft handling
- Category color picker rendering

### `js/features/dashboard.js`

Centralized:

- Insight card markup
- Category summary bars
- Recent entries dashboard section
- Forecast card markup

### `js/features/app-shell.js`

Centralized:

- App shell visibility
- Auth/app shell transition behavior
- Header avatar rendering
- User modal content
- Onboarding shell behavior
- Theme application
- Notification button visual state

## Fragility Reduction Work

Several low-risk inline handlers were replaced with safer delegated or static event binding.

Examples:

- Navigation actions
- Chart tab selection
- Chart category selection
- Savings goal actions
- Category selection in forms
- Recurring frequency selection
- Entry filter chips
- Entry edit/delete actions
- Some dashboard and shell actions

This reduced direct template coupling and made the DOM behavior easier to trace and maintain.

## `index.html` After Refactor

`index.html` still acts as the app shell, but it is now primarily responsible for:

- Loading modules
- Holding the DOM structure and styles
- Composing app state with feature renderers
- Wiring app-level event handlers

The file was also reorganized with section markers so the remaining logic is easier to navigate.

## Verification Performed

Technical verification completed:

- The inline script in `index.html` was repeatedly syntax-checked successfully.
- The extracted modules were syntax-checked successfully.
- Smoke tests were performed for:
  - recurring schedule behavior
  - duplicate prevention
  - savings goal independence
  - storage normalization
  - entry rendering/filtering
  - recurring rendering
  - savings goal rendering
  - dashboard and forecast rendering
  - export workbook generation

## Known Limits

The following items still benefit from follow-up work:

- Full manual browser QA is still recommended for end-to-end Firebase-backed flows.
- Some runtime copy normalization still exists as a protection layer and can later be replaced by fully cleaned source text if desired.
- `index.html` is much smaller in responsibility than before, but it still contains composition/wiring code that could be trimmed further over time if needed.

## Recommended Manual QA Checklist

Critical flows to re-test in browser:

- Login/logout
- Create/edit/delete entries
- Apply recurring entries
- Verify weekly/biweekly/monthly cadence
- Savings goal allocation and progress
- Dashboard totals and recent activity
- Charts across all tabs
- Export output
- Theme persistence
- Onboarding behavior
- Notification button state
- Firebase persistence and reload behavior

## Outcome

This pass improved correctness in the most bug-prone financial flows, made savings and recurring behavior more reliable, normalized much of the product copy, and significantly improved maintainability through incremental modularization rather than a risky rewrite.
