# BudgetLog — Project Summary

## What It Is

BudgetLog is a personal finance PWA (Progressive Web App) built as a mobile-first, dark-theme web app. It lets users log income and expenses, set monthly spending goals, track savings, and visualize financial trends — all synced to the cloud via Firebase. It runs entirely in the browser with no native app install required, and can be added to the home screen on Android and iOS.

**Live URL:** https://budgetlog-b318d.web.app
**Repository:** GitHub (Budget-Tracker)
**Language:** Spanish (UI copy)
**Currency:** MXN (Mexican Peso)

---

## Capabilities

### Core Financial Tracking
- Log income and expenses with description, amount, date, and category
- 10 default categories: Alimentos, Restaurantes, Transporte, Uber/Rappi, Servicios, Compras, Salud, Entretenimiento, Ropa, Ahorro
- Swipe-to-delete entries on mobile
- Edit any existing entry via modal
- Real-time search across description, category, and amount
- Filter entries by type (income/expense) or by individual category

### Dashboard
- Net balance (saldo neto) for the current month
- Income and expense summary cards
- Insight card showing:
  - Savings rate vs. 20% target
  - Biggest spending category of the month
  - Month-over-month expense and income deltas with percentage pills
- Category progress bars vs. monthly goals (with over-budget warning)
- 5 most recent entries
- Cashflow forecast card for the next month based on recurring rules
- Month navigation (previous/next arrows)

### Recurring Entries
- Define recurring income or expenses with frequency: monthly, biweekly (quincenal), or weekly
- Rules store an anchor date; weekly = every 7 days, biweekly = every 14 days, monthly = fixed day of month
- Auto-apply on app open: applies all pending recurring entries up to today for the current month
- Duplicate prevention via `recurringId + recurringDate` identity check
- Future months are not pre-populated

### Savings Goals
- Create named savings goals with a target amount and color
- Savings entries can be linked to a specific goal via `goalId`
- Each goal tracks its own independent progress
- Unassigned savings amounts are surfaced with a notice
- Progress bar per goal

### Charts (5 views)
- **Categorías:** Horizontal bar chart — actual vs. goal per category for the current month
- **Tendencia:** Grouped bar chart — income vs. expenses over last 6 months
- **Saldo neto:** Bar chart — net balance over last 6 months (green/red by sign)
- **Por categoría:** Line chart with goal reference line — one category over 6 months, with a category selector
- **Distribución:** Doughnut/pie chart — expense breakdown by category for current month

### Export
- Downloads an `.xlsx` file with 4 sheets:
  1. **Movimientos** — all entries sorted by date
  2. **Resumen** — monthly totals (income, expense, net, savings rate %)
  3. **Por categoría** — expense matrix by category × month
  4. **Metas** — goal vs. actual for the selected month or full history
- Scope options: current month or full history

### Category Customization
- Rename any of the 10 base categories
- Change category color from a 40-color palette
- Add custom categories beyond the base 10
- Delete custom categories
- Changes sync to Firestore and apply across all devices

### Authentication & Sync
- Google Sign-In via Firebase Auth (popup flow)
- On first login: local `localStorage` data migrated to Firestore automatically
- Auto-debounced save to Firestore (800ms after any change)
- Sync indicator dot in the header (syncing / ok / error states)
- Sign-out clears all in-memory state

### Push Notifications
- Firebase Cloud Messaging (FCM) — web push via service worker
- User opts in from the account modal (tap avatar)
- Daily scheduled Cloud Function (8am Mexico City time) checks each user's budget
- Sends push notification if any category reaches 80% or 100% of its monthly goal
- Notification body: up to 3 category alerts, e.g. `🔴 Alimentos: excediste tu meta (112%)`
- Expired FCM tokens are automatically cleaned from Firestore

### Onboarding
- Multi-step bottom sheet shown to first-time users
- Guides through core features before first entry

### Theme
- Dark mode (default) and light mode toggle
- Persisted in `localStorage`
- Toggle button in the header

### PWA Features
- Installable on Android (Chrome) and iOS (Safari)
- `manifest.json` configured with `display: standalone`
- Pink piggy bank app icon (192×512 PNG)
- `start_url: /` — opens directly to the app
- Background FCM message handling via service worker

---

## Technical Architecture

### Hosting & Infrastructure

| Service | Role |
|---------|------|
| Firebase Hosting | Serves all static files from project root |
| Firebase Firestore | Cloud database — one document per user at `users/{uid}` |
| Firebase Auth | Google Sign-In |
| Firebase Cloud Messaging | Push notifications |
| Firebase Cloud Functions | Scheduled daily alert job (Node.js, Blaze plan) |
| GitHub | Source control (Budget-Tracker repository) |

### File Structure

```
Budget-Tracker/
├── index.html                    ← Main app (140KB) — shell, all CSS, composition logic
├── landing.html                  ← Marketing landing page (not the app entry point)
├── firebase-messaging-sw.js      ← Service worker for background push notifications
├── manifest.json                 ← PWA manifest
├── firebase.json                 ← Firebase Hosting + Functions config
├── .firebaserc                   ← Firebase project binding (budgetlog-b318d)
├── icon-192.png / icon-512.png   ← PWA icons (pink piggy bank)
├── deploy.bat                    ← One-click Firebase Hosting deploy script
├── 404.html                      ← Custom 404 page
├── PROJECT_SUMMARY.md            ← This file
├── FIREBASE_HOSTING_GUIDE.md     ← Firebase guide for collaborators
├── REFACTOR_AND_FIXES_SUMMARY.md ← Refactor documentation
├── functions/
│   └── index.js                  ← Cloud Function: budgetAlerts (daily scheduled)
└── js/
    ├── core/
    │   ├── config.js             ← Firebase config, categories, defaults, color palettes
    │   ├── utils.js              ← Currency/date formatting, month key helpers
    │   ├── selectors.js          ← Data selectors, recurring logic, forecast, savings calc
    │   ├── storage.js            ← localStorage read/write, state normalization
    │   └── cloud.js              ← Firestore load/save, Google auth, sync indicator
    └── features/
        ├── app-shell.js          ← Auth screen, app shell transitions, modals, theme, onboarding
        ├── dashboard.js          ← Insight card, category bars, recent entries, forecast card
        ├── entries.js            ← Entry list rendering, filters, search
        ├── recurring.js          ← Recurring list rendering, pending rule helpers
        ├── savings-goals.js      ← Savings goal cards, color picker, modal state
        ├── charts.js             ← All 5 Chart.js chart renderers + category selector
        ├── export.js             ← XLSX workbook generation (4 sheets)
        ├── selection-ui.js       ← Category grid and frequency selector UI
        └── category-customization.js ← Category rename/recolor/add/delete UI
```

### Module Pattern

All JS modules use the IIFE pattern with a shared global namespace:

- `window.BudgetLogCore` — core modules (config, utils, selectors, storage, cloud)
- `window.BudgetLogFeatures` — feature modules (rendering, charts, export)

Modules must load in dependency order:
`config → utils → selectors → storage → cloud → [features]`

### Typography

All fonts use a single source — **Lexend** (Google Fonts). Controlled via two CSS variables in `:root`:

| Variable | Value | Used for |
|----------|-------|---------|
| `--font-ui` | `'Lexend', sans-serif` | All UI text, labels, buttons |
| `--font-mono` | `'Lexend', sans-serif` | Numbers, amounts, dates, meta text |

A global `* { font-family: var(--font-ui) !important }` override in the CSS ensures no browser default or third-party library can inject a different font. Previously the app used Syne, Inconsolata, and DM Mono — all replaced with Lexend.

### State Shape (Firestore document + localStorage)

```json
{
  "entries": [
    {
      "id": "...",
      "type": "expense | income",
      "amount": 1200,
      "description": "Supermercado",
      "category": "food",
      "date": "2025-03-15",
      "recurringId": null,
      "recurringDate": null,
      "goalId": null
    }
  ],
  "goals": {
    "food": 4000,
    "restaurant": 2000,
    "income": 20000
  },
  "recurring": [
    {
      "id": "...",
      "type": "expense",
      "amount": 8500,
      "description": "Renta",
      "category": "utilities",
      "frequency": "monthly",
      "day": 1,
      "anchorDate": "2025-01-01",
      "createdAt": "2025-01-01",
      "goalId": null
    }
  ],
  "savingsGoals": [
    {
      "id": "...",
      "name": "Vacaciones",
      "target": 15000,
      "color": "#3dd68c"
    }
  ],
  "customCategories": {
    "food": { "label": "Súper", "color": "#5bcff0" }
  },
  "fcmToken": "...",
  "updatedAt": "server timestamp"
}
```

### External Libraries

| Library | Version | Use |
|---------|---------|-----|
| Firebase SDK (compat) | 10.12.2 | Auth, Firestore, Messaging |
| Chart.js | 4.4.1 | All 5 chart views |
| SheetJS (xlsx) | 0.18.5 | Excel export |
| Lexend | Google Fonts | All typography (UI + mono) |

### localStorage Keys

| Key | Content |
|-----|---------|
| `bl_entries` | Entry array |
| `bl_goals` | Goals object |
| `bl_recurring` | Recurring rules array |
| `bl_savings` | Savings goals array |
| `bl_catcustom` | Custom categories object |
| `bl_onboarded` | Onboarding completion flag |
| `bl_theme` | `light` or `dark` |
| `bl_fcm_token` | FCM registration token |

---

## Deployment

### Workflow

Firebase Hosting and GitHub are fully independent. Pushing to GitHub does **not** auto-deploy.

```
1. Make changes to files
2. Commit & push in GitHub Desktop
3. Run: firebase deploy --only hosting
```

### Deploy Commands

```powershell
# Deploy hosting only (most common)
firebase deploy --only hosting

# Deploy Cloud Functions only
firebase deploy --only functions

# Deploy everything
firebase deploy
```

### One-Click Deploy

Double-click `deploy.bat` in the repo root — it navigates to the correct folder, runs the deploy, and shows a success/failure message with the live URL.

### Firebase Project Details

| Property | Value |
|----------|-------|
| Project ID | `budgetlog-b318d` |
| Live URL | https://budgetlog-b318d.web.app |
| Plan | Blaze (required for Cloud Functions) |
| Hosting public dir | `.` (repo root) |

---

## Recent Changes

### Font Unification (Lexend)
All typography migrated from Syne / Inconsolata / DM Mono to **Lexend** only. Changes applied to:
- `index.html` — Google Fonts link updated, all 56 CSS `font-family` declarations replaced with CSS variables, all Chart.js JS font config objects updated, global `!important` override added
- `landing.html` — Same treatment; Playfair Display also removed

### Modular JS Refactor
`index.html` was split into `js/core/` and `js/features/` modules to improve maintainability. The file is now responsible for loading modules, holding DOM structure/styles, and composing app-level wiring only.

### Documentation Added
- `PROJECT_SUMMARY.md` — this file
- `FIREBASE_HOSTING_GUIDE.md` — Firebase products, plans, and hosting walkthrough for collaborators
- `REFACTOR_AND_FIXES_SUMMARY.md` — detailed record of the modular refactor and bug fixes

### Deployment Tooling
- `deploy.bat` — one-click deploy script with success/failure feedback
