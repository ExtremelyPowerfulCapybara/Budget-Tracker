# BudgetLog — Claude Code Context

Personal finance PWA for tracking income/expenses, savings goals, and budget targets.
Spanish UI, MXN currency, mobile-first dark theme.

**Live URL:** https://budgetlog-b318d.web.app
**Firebase project:** budgetlog-b318d (Blaze plan)

---

## Stack

- **Frontend:** Plain HTML/CSS/JS — NO bundler, NO npm build step, NO framework
- **Hosting:** Firebase Hosting (public dir = repo root `.`)
- **Database:** Cloud Firestore (one doc per user at `users/{uid}`)
- **Auth:** Firebase Auth — Google Sign-In only
- **Push:** Firebase Cloud Messaging (FCM) via service worker
- **Functions:** Cloud Functions (Node.js) — `functions/index.js`
- **Charts:** Chart.js 4.4.1 via CDN
- **Export:** SheetJS (xlsx) 0.18.5 via CDN
- **Fonts:** Lexend + Lexend Mono via Google Fonts

---

## Critical Rules

1. **No bundler ever.** No webpack, vite, rollup, parcel. Files are served as-is.
2. **No npm dependencies in the frontend.** CDN only for Chart.js and SheetJS.
3. **IIFE module pattern** — every JS file wraps in `(function(){ ... })()`.
4. **Namespaces:** core modules use `window.BudgetLogCore`, feature modules use `window.BudgetLogFeatures`.
5. **Script load order matters:** `config → utils → selectors → storage → cloud → [features]`
6. **UI language is Spanish.** All user-visible strings, labels, toasts, placeholders.
7. **Currency is MXN.** Format: `$1,234.56` using `utils.MXN()` helper.
8. **Font:** Lexend only. Use `var(--font-ui)` for all text, `var(--font-mono)` for numbers/amounts/dates.
9. **Never hardcode colors.** Use CSS variables (`var(--accent)`, `var(--income)`, etc.) or category colors from config.
10. **State is flat.** All app state lives in one object: `{ entries, goals, recurring, savingsGoals, customCategories }`.

---

## File Structure

```
Budget-Tracker/
├── CLAUDE.md                     ← you are here
├── index.html                    ← main app (140KB) — all CSS + app shell + composition
├── landing.html                  ← marketing page, not the app entry point
├── firebase-messaging-sw.js      ← FCM service worker
├── manifest.json                 ← PWA manifest
├── firebase.json                 ← hosting + functions config
├── .firebaserc                   ← project binding
├── deploy.bat                    ← one-click deploy script
├── functions/
│   └── index.js                  ← Cloud Function: budgetAlerts (daily scheduled)
└── js/
    ├── core/
    │   ├── config.js             ← categories, colors, defaults, Firebase config
    │   ├── utils.js              ← MXN(), date helpers, month key helpers
    │   ├── selectors.js          ← recurring logic, forecast, savings calcs
    │   ├── storage.js            ← localStorage keys, read/write, normalization
    │   └── cloud.js              ← Firestore load/save, Google auth
    └── features/
        ├── app-shell.js          ← auth screen, modals, theme, onboarding
        ├── dashboard.js          ← insight card, category bars, forecast
        ├── entries.js            ← entry list, filters, search
        ├── recurring.js          ← recurring list rendering
        ├── savings-goals.js      ← savings goal cards and modal
        ├── charts.js             ← all 5 chart renderers (Chart.js)
        ├── export.js             ← XLSX export (4 sheets)
        ├── selection-ui.js       ← category grid, frequency selector
        └── category-customization.js ← rename/recolor/add/delete categories
```

---

## State Shape

```js
{
  entries: [
    {
      id: string,           // unique, e.g. "1711234567890"
      type: "income"|"expense",
      amount: number,       // always positive
      description: string,
      category: string,     // category id from CATEGORIES
      date: "YYYY-MM-DD",
      recurringId: string|null,
      recurringDate: string|null,
      goalId: string|null   // links to savingsGoals[].id
    }
  ],
  goals: {
    food: number,           // monthly spend target per category
    restaurant: number,
    // ... one per category + income
    income: number
  },
  recurring: [
    {
      id: string,
      type: "income"|"expense",
      amount: number,
      description: string,
      category: string,
      frequency: "monthly"|"biweekly"|"weekly",
      day: number,          // day of month (monthly only)
      anchorDate: "YYYY-MM-DD",
      createdAt: "YYYY-MM-DD",
      lastApplied: string|null,  // "YYYY-MM"
      goalId: string|null
    }
  ],
  savingsGoals: [
    {
      id: string,
      name: string,
      target: number,
      color: string         // hex
    }
  ],
  customCategories: {
    [categoryId]: { label: string, color: string, isCustom?: boolean }
  }
}
```

---

## Categories

Default 10 (IDs are fixed, labels/colors can be customized):
`food`, `restaurant`, `transport`, `uber`, `utilities`, `shopping`, `health`, `entertainment`, `clothing`, `savings`

Custom categories can be added — they get a user-defined ID and live in `customCategories`.

---

## CSS Variables (Design System)

```css
--bg: #0e0f13          /* page background */
--surface: #16181f     /* card background */
--surface2: #1e2029    /* input/button background */
--border: #2a2d38      /* borders */
--text: #f0f0f5        /* primary text */
--muted: #6b6f80       /* secondary text */
--accent: #5b8af0      /* primary blue */
--income: #3dd68c      /* green */
--expense: #f05b5b     /* red */
--font-ui: 'Lexend', sans-serif
--font-mono: 'Lexend Mono', monospace
```

---

## Firestore

- Collection: `users`
- Document: `users/{uid}` — one doc per user, contains entire state
- Write: `userDocRef.set({ ...state, updatedAt: serverTimestamp() })`
- Read: `userDocRef.get()` → `doc.data()`
- FCM token stored at `users/{uid}.fcmToken`

---

## Cloud Functions

`functions/index.js` — `budgetAlerts`:
- Scheduled: daily at 8am Mexico City time (`0 14 * * *` UTC)
- Reads all users, checks monthly expense % vs goals
- Sends FCM push at 80% and 100% thresholds (up to 3 alerts per notification)
- Auto-cleans expired FCM tokens

Deploy functions: `firebase deploy --only functions`
Test locally: `firebase emulators:start --only functions`

---

## Deploy

```powershell
firebase deploy --only hosting    # most common
firebase deploy --only functions  # when Cloud Function changed
firebase deploy                   # everything
```

Or double-click `deploy.bat` for hosting deploy.

GitHub push does NOT auto-deploy — always run firebase deploy manually after pushing.

---

## Skills Available

Read `.claude/skills/` before working on specific areas:

| Skill | File | When to use |
|-------|------|-------------|
| New feature | `.claude/skills/new-feature/SKILL.md` | Adding a new tab or major section |
| New module | `.claude/skills/new-module/SKILL.md` | Creating a new js/features/ file |
| State changes | `.claude/skills/state-changes/SKILL.md` | Modifying state shape or Firestore doc |
| Cloud Functions | `.claude/skills/cloud-functions/SKILL.md` | Editing or adding Cloud Functions |
| Charts | `.claude/skills/charts/SKILL.md` | Adding or modifying Chart.js charts |
| Testing | `.claude/skills/testing/SKILL.md` | Writing tests for selectors or utilities |
