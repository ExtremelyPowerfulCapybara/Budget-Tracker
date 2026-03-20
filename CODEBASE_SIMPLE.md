# BudgetLog — How It All Works (Plain English)

This document explains how BudgetLog is built and why decisions were made the way they were.
You don't need to know JavaScript deeply to follow along — just a general sense of how websites work.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [How the App is Served](#how-the-app-is-served)
3. [How Files are Organized](#how-files-are-organized)
4. [How Modules Talk to Each Other](#how-modules-talk-to-each-other)
5. [The Core Files](#the-core-files)
   - [Config — The App's Settings Sheet](#config--the-apps-settings-sheet)
   - [Utils — The Toolbox](#utils--the-toolbox)
   - [Storage — Memory and Saving](#storage--memory-and-saving)
   - [Cloud — Talking to Firebase](#cloud--talking-to-firebase)
   - [Selectors — Doing the Math](#selectors--doing-the-math)
6. [The Feature Files](#the-feature-files)
   - [App Shell — Screens and Chrome](#app-shell--screens-and-chrome)
   - [Dashboard — The Summary View](#dashboard--the-summary-view)
   - [Entries — The Transaction List](#entries--the-transaction-list)
   - [Recurring — Automatic Transactions](#recurring--automatic-transactions)
   - [Charts — The Graphs](#charts--the-graphs)
   - [Savings Goals — Progress Tracking](#savings-goals--progress-tracking)
   - [Export — Downloading to Excel](#export--downloading-to-excel)
   - [Selection UI — Reusable Pickers](#selection-ui--reusable-pickers)
   - [Category Customization — Renaming Things](#category-customization--renaming-things)
7. [index.html — The Control Room](#indexhtml--the-control-room)
8. [The Backend: Cloud Functions](#the-backend-cloud-functions)
9. [Firebase: What Each Service Does](#firebase-what-each-service-does)
10. [How Data Moves Through the App](#how-data-moves-through-the-app)
11. [Where All the Data Lives](#where-all-the-data-lives)

---

## The Big Picture

BudgetLog is a **Progressive Web App (PWA)** — a website that behaves like a mobile app. You can add it to your phone's home screen and it works offline.

Under the hood it is simpler than most apps you'd encounter in the wild:

- There is no complex build process. The files you write are the files the browser downloads and runs.
- There is no framework like React or Vue. The app builds its own HTML strings and injects them into the page.
- The "backend" is entirely Firebase — a set of cloud services from Google that handle saving data, logging in, and sending notifications.

Everything visible to the user — every screen, button, and card — comes from one file: `index.html`. The JavaScript files are helpers that `index.html` loads and uses.

---

## How the App is Served

Firebase Hosting is the web server. When a user visits the app URL, Firebase sends them `index.html`. The browser then reads that file, sees references to the JavaScript files, and downloads those too.

There is no server-side rendering, no API that builds pages, no database queries on page load. Everything runs in the browser. The JavaScript files fetch the user's data from Firestore (Firebase's database) directly from the browser once the user is signed in.

This is called a **client-side app**. The server just delivers files; all the logic runs on the user's device.

---

## How Files are Organized

```
Budget-Tracker/
├── index.html              ← The entire app lives here
├── js/
│   ├── core/               ← Shared building blocks
│   │   ├── config.js       ← App-wide constants (categories, colors, defaults)
│   │   ├── utils.js        ← Small helper functions
│   │   ├── storage.js      ← Reading/writing data locally and to the cloud
│   │   ├── cloud.js        ← Firebase sign-in and Firestore sync
│   │   └── selectors.js    ← Calculations that derive data from state
│   └── features/           ← One file per major feature
│       ├── app-shell.js
│       ├── dashboard.js
│       ├── entries.js
│       ├── recurring.js
│       ├── charts.js
│       ├── savings-goals.js
│       ├── export.js
│       ├── selection-ui.js
│       └── category-customization.js
├── functions/
│   └── index.js            ← Backend code (runs on Google's servers, not the browser)
└── firestore.rules         ← Security rules for the database
```

The split between `core/` and `features/` is intentional. Core files are tools that any part of the app can use. Feature files are responsible for one specific section of the UI. Core files load first because features depend on them.

---

## How Modules Talk to Each Other

Each JavaScript file is self-contained — it runs in isolation and then registers its functions onto a shared global object that other files can access.

Think of it like workers at a company each pinning their contact cards to a shared bulletin board. When `index.html` needs to format a currency value, it looks at the bulletin board, finds the `utils` card, and calls its `MXN` function. No file needs to know where another file physically lives.

The two bulletin boards are:
- **`window.BudgetLogCore`** — for shared tools (utils, storage, selectors, config, cloud)
- **`window.BudgetLogFeatures`** — for UI feature modules (dashboard, entries, charts, etc.)

The load order of the `<script>` tags in `index.html` matters: core files must load before features, because features immediately try to access the core bulletin board when they start up.

---

## The Core Files

### Config — The App's Settings Sheet

`js/core/config.js`

This file is a list of values that never change while the app runs. Think of it as the app's configuration spreadsheet.

- **Categories** — The 10 built-in expense buckets (Food, Transport, Health, etc.) with their fixed IDs, Spanish names, and assigned colors. The IDs are permanent — if you see `'food'` anywhere in the codebase, it always refers to the Alimentos category.
- **Frequencies** — The three options for recurring transactions: monthly, every two weeks, weekly.
- **Default Goals** — The starting monthly budget targets (in MXN) that new users get. For example, food defaults to $4,000/month.
- **Month Names** — Spanish month names in an array, used everywhere the app displays a month label.
- **Color Palettes** — Two sets of preset colors: one for custom categories and one for savings goals.

Nothing in this file does anything — it is pure data that other files read.

---

### Utils — The Toolbox

`js/core/utils.js`

A collection of small, general-purpose helper functions that get reused constantly throughout the app.

- **MXN(number)** — Takes a raw number like `1234.5` and turns it into `$1,234.50`. The `es-MX` locale setting ensures commas and periods appear in the Mexican convention.
- **toISODate / parseISODate** — Convert between JavaScript date objects and the `YYYY-MM-DD` text format used everywhere in the data. The app always stores dates as text strings (not timestamps) to avoid timezone confusion.
- **addDays** — Takes a date string and adds N days to it, returning a new date string. Used to calculate when weekly and biweekly recurring transactions should fire.
- **monthKey** — Produces a short `YYYY-MM` string (e.g. `2026-03`) from a year and month number. This key is how the app groups transactions — every transaction's month is extracted as this key and compared.
- **entryMonth** — Extracts just the `YYYY-MM` part from a transaction's date. The single most-used function for filtering.
- **escapeHtml (esc)** — Converts characters like `<`, `>`, and `"` into safe equivalents before putting user text into HTML. This prevents a security issue called XSS, where malicious text in a description field could otherwise execute code.

---

### Storage — Memory and Saving

`js/core/storage.js`

This file manages how data gets saved and loaded, in two places: the browser's own local storage and Firestore (the cloud database).

**Local Storage** is a small amount of memory the browser keeps on the device — like a notepad that survives page refreshes. The app saves a copy there so the app works offline.

**Firestore** is the main database in the cloud. When you sign in on a different device, your data comes from there.

The most important function here is **`normalizeState`**. Every time data is loaded — whether from local storage or Firestore — it passes through this function. Its job is defensive: it ensures every field exists and has a valid value, even if the stored data is missing something (because it was saved by an older version of the app that didn't have that field yet). For example, if an entry was saved before the notes field existed, `normalizeState` just leaves notes undefined and carries forward everything else.

**`serializeCloudState`** does the reverse: before saving to Firestore, it strips out any temporary or local-only information, ensuring only clean data goes to the cloud.

---

### Cloud — Talking to Firebase

`js/core/cloud.js`

Handles the three moments when the app needs to communicate with Firebase directly: signing in, loading data, and saving data.

**Sign-in** opens Google's login popup. When the user completes it, Firebase Auth returns a user object with their unique ID, name, email, and profile photo.

**Loading data** happens right after sign-in. The app looks for an existing Firestore document for this user. If it finds one, it loads it. If it doesn't (first sign-in ever), it checks whether the user had data saved locally on this device — and if so, migrates that data up to the cloud automatically, showing a toast message confirming the migration.

**Saving data** writes the entire current state to Firestore as one document. The write always includes a timestamp field (`updatedAt`) set by the server, not the client, so there is a reliable record of when the last sync happened.

The small **sync indicator dot** in the header is controlled here too — it shows a pulsing animation while a save is in progress, and turns red if there's an error.

---

### Selectors — Doing the Math

`js/core/selectors.js`

Everything that *calculates* something from the data lives here. These functions never look at the screen or save anything — they just take data in and return computed results.

**Month totals** — Filters transactions by month and sums income and expenses separately.

**Recurring engine** — The most complex part of the selectors. It handles the logic of: *given a recurring rule (e.g. "Netflix, $200, monthly on the 5th"), which specific dates in a given month should have entries, and have they already been generated?* The key steps are:
  1. Calculate all dates the rule fires in the target month.
  2. Check which dates don't already have an entry (to avoid duplicates).
  3. For the current month, only generate entries up to today — not future dates.
  4. For past months, generate everything.

**Forecast** — Estimates the *next* month's income and expense totals purely from recurring rules, without touching actual transaction history.

**Savings calculations** — Determines how much money has been put toward each savings goal by summing savings-category transactions that are linked to that goal's ID.

**Budget rollover** — When this feature is active, a category's effective goal for the current month is not just its base goal — it's the base goal *plus* any unspent amount from last month. For example, if the Health goal is $500 and only $200 was spent last month, $300 carries over, making this month's effective goal $800.

---

## The Feature Files

Feature files are responsible for producing the HTML that appears on screen. They never directly change what's visible — they return strings of HTML, and `index.html` puts those strings into the page. This keeps the display logic testable and separate from the app's wiring.

### App Shell — Screens and Chrome

`js/features/app-shell.js`

Controls the highest-level screen states: showing the loading spinner, the sign-in screen, or the main app. Also handles small header pieces like the user avatar (falls back to initials if no profile photo exists), the theme toggle (dark/light mode), the notifications button state, and the onboarding carousel.

---

### Dashboard — The Summary View

`js/features/dashboard.js`

Produces the HTML for three sections of the dashboard:

**Insight card** — The "Resumen del mes" summary showing your savings rate (income minus expenses as a percentage of income), the biggest spending category, and whether income/expenses are up or down compared to last month. The percentage change appears as small colored pill badges — green means better, orange means worse.

**Category bars** — One horizontal bar per category that has spending or a goal. Each bar shows how much was spent vs the goal, as both a progress bar and a percentage. When budget rollover is enabled, the bar's goal amount is the rolled-over effective goal, not just the base goal.

**Forecast card** — Shows projected income and expense for *next* month based on recurring rules. Only appears if the user has recurring transactions set up.

---

### Entries — The Transaction List

`js/features/entries.js`

Handles how individual transactions are displayed and filtered.

**Each transaction card** shows: a colored dot (the category's color, or green for income), the description, the date and category, any savings goal link, an optional notes line in italics, the amount, and edit/delete buttons.

**Filtering** can be by type (income/expense), by specific category, or by search text. When a search query is typed, the filter changes behavior entirely: instead of showing only the current month, it searches across *all* transaction history and hides the month selector, since you're looking globally. Clearing the search restores the current month view.

**Swipe to delete** on mobile is handled by touch event attributes on each card. The card slides to reveal a trash icon, and releasing triggers deletion.

---

### Recurring — Automatic Transactions

`js/features/recurring.js`

Renders the list of recurring transaction rules. Each rule card shows the description, frequency, start date, amount, and an optional savings goal link. Two action buttons appear on every card: an edit pencil that pre-fills the creation form with the rule's current values, and a delete X.

The module also provides a helper that flattens the list of pending dates (dates where an entry should have been created but wasn't yet) into a flat list used by the "Apply" banner.

---

### Charts — The Graphs

`js/features/charts.js`

All five charts use Chart.js, a charting library loaded from a CDN. Each chart is rendered by its own function, all sharing a common set of visual defaults: dark background tooltips, muted grid lines, Lexend Mono font on the axes, and consistent color conventions (green = income, red = expense).

A critical rule: before drawing a chart on a canvas, the previous chart on that canvas must be explicitly destroyed. Otherwise Chart.js throws an error. This is why every chart function calls `destroyChart()` first.

The five charts:
- **Category bars** — Horizontal bars, current month, actual vs goal
- **Trend** — Side-by-side bars for income and expenses over the last 3, 6, or 12 months
- **Net** — Single bars showing monthly net (income minus expenses), colored green or red per bar
- **Category line** — One category's spending trend over 6 months, with a dashed goal reference line
- **Pie** — Donut chart of this month's expense distribution by category

The Trend and Net charts have a 3M / 6M / 12M toggle. The selected range is stored as a number in `index.html` and passed to the chart function when rendering.

---

### Savings Goals — Progress Tracking

`js/features/savings-goals.js`

Renders savings goal cards showing name, color, amount saved vs target, and a progress bar. When a goal is 100% funded, the percentage label changes to "Completada."

If the user has multiple savings goals and some savings transactions aren't linked to any specific goal, a notice appears explaining that unassigned savings exist and how to fix it.

The module also handles the color grid in the goal creation modal, where users pick from 8 preset colors when creating or editing a goal.

---

### Export — Downloading to Excel

`js/features/export.js`

When the user exports data, this function uses the SheetJS library to build a spreadsheet file in memory and trigger a download. No server is involved — the file is assembled entirely in the browser.

The spreadsheet has four tabs:
1. **Movimientos** — Every transaction ever recorded, one per row, with all fields including notes.
2. **Resumen** — Monthly totals and savings rate, one row per month.
3. **Por categoría** — A pivot table: categories across rows, months across columns, spending at each intersection.
4. **Metas** — How actual spending compared to goals for a selected month.

---

### Selection UI — Reusable Pickers

`js/features/selection-ui.js`

Two small components used in multiple forms:

**Category grid** — A row of pill buttons, one per category, where the selected one is highlighted with the category's own color. Used in the log form, edit modal, and recurring form.

**Frequency grid** — The same pattern for the three frequency options on the recurring form.

Both use `data-` attributes on the buttons so that one delegated click handler in `index.html` can handle selection for all instances.

---

### Category Customization — Renaming Things

`js/features/category-customization.js`

Powers the category editing panel where users can rename categories, change their colors, add new custom categories, or delete custom ones (built-in categories can be renamed/recolored but not deleted).

The key design choice here is the **draft pattern**: when the user opens the customization panel, a copy of all categories is made. All edits happen on the copy. Only when the user explicitly saves does the draft replace the live category list. This means the user can make changes and cancel without any consequences.

---

## `index.html` — The Control Room

`index.html` is where everything comes together. It is responsible for:

**All the CSS** — Every visual style in the app is defined here. The design system uses CSS variables (named values like `--accent` or `--surface`) so that the entire color palette can be swapped by toggling one class on the body element (which is how dark/light mode works).

**The HTML structure** — The app shell, all view panels, the navigation bar, and all modals are defined here as static HTML. JavaScript then fills the dynamic content into these containers.

**State** — Every piece of data the app is working with lives in variables declared in the inline script: the lists of entries, goals, recurring rules, savings goals, and custom categories. There is one copy of each, in memory, at all times. When data changes, the relevant array or object is updated and then saved.

**Event handling** — Rather than attaching a click handler to every single button individually, the app uses **event delegation**: one listener is attached to a container (like the entire entry list), and when a click happens anywhere inside it, the code checks which button was actually clicked by looking at its `data-` attributes. This is more efficient and works even for buttons that are dynamically created.

**The auth lifecycle** — When the page loads, Firebase Auth immediately tells the app whether a user is signed in. This callback is the starting gun: if signed in, load data and render the app; if not, show the sign-in screen. Everything flows from this moment.

**Rendering** — After any change to data, a render function is called to update the screen. Render functions ask the feature modules to produce HTML strings, then set `container.innerHTML` to those strings. The old HTML is discarded and replaced — there is no partial updating of the DOM.

---

## The Backend: Cloud Functions

The two Cloud Functions run on Google's servers on a schedule, completely independent of any user having the app open. They are the only code in this project that doesn't run in a browser.

### Daily Budget Alerts

Runs every day at 8:00am Mexico City time.

Goes through every user account in the database. For each user who has notifications enabled (identified by having a saved FCM token), it checks their current month's spending against their goals. If any category has reached 50%, 80%, or 100% of its goal, a push notification is sent. The notification body lists up to three alerts.

If a push notification fails because the user's token is stale (they might have cleared their browser data or reinstalled), the token is automatically deleted from the database so it won't be tried again.

### Weekly Digest

Runs every Monday at 9:00am Mexico City time.

For each user with notifications enabled, it looks at the last 56 days of spending. It computes:
- How much was spent per category in the last 7 days
- The average weekly spending per category over the 7 weeks before that

If any category's last-7-days spending is more than 20% above its average, that's flagged as a spike. The notification includes total spending for the week, the top 2 categories by amount, and any spikes marked with a ⚠️ warning.

---

## Firebase: What Each Service Does

| Service | Role in this app |
|---------|-----------------|
| **Firebase Hosting** | Delivers the HTML, CSS, and JS files to the browser. Acts as the web server. |
| **Firebase Auth** | Handles Google sign-in. Provides the user's identity (ID, name, email, photo). |
| **Cloud Firestore** | The database. Stores one document per user containing all their data. |
| **Firebase Cloud Messaging** | Sends push notifications to the user's browser or phone. |
| **Cloud Functions** | Runs scheduled background jobs (budget alerts, weekly digest) on Google's servers. |
| **Firestore Security Rules** | Enforces that users can only read and write their own data — not anyone else's. |

---

## How Data Moves Through the App

**When the user logs in:**
1. Firebase Auth confirms the user's identity.
2. The app looks up the user's document in Firestore.
3. If found, all their entries, goals, and settings are loaded into memory.
4. If not found (first ever login), any data saved locally on this device gets migrated to the cloud.
5. The app checks for any recurring transactions that should have been applied and weren't (e.g. if the user didn't open the app for a few days), and generates those entries automatically.
6. The dashboard renders.

**When the user saves a transaction:**
1. The new transaction object is added to the in-memory list.
2. The list is saved to the browser's local storage (instant, offline-safe).
3. The list is also sent to Firestore (async, requires internet).
4. The relevant section of the UI re-renders.

**When a push notification arrives:**
- This happens entirely server-side. The Cloud Function reads the database, decides whether a notification is warranted, and sends it via Firebase Cloud Messaging. The app doesn't need to be open.

---

## Where All the Data Lives

All user data is stored as one big document in Firestore. The five main sections:

**Entries** — The list of every transaction ever recorded. Each entry has a type (income or expense), an amount, a description, a date, a category, and optionally notes, a recurring rule link, and a savings goal link.

**Goals** — A simple set of monthly budget targets, one number per category. These don't change month to month — the same goal applies to every month unless the user edits it.

**Recurring** — Rules that describe repeating transactions. Each rule stores the amount, category, frequency, and an anchor date (used to calculate exactly which days the rule fires for weekly and biweekly schedules).

**Savings Goals** — Named targets with a dollar amount and a color. Individual entries can be linked to a savings goal to track progress toward it.

**Custom Categories** — Any categories the user has renamed or recolored, plus any brand-new categories they've added. This is stored separately from the built-in category list so the defaults can always be restored.

Everything is loaded at sign-in, kept in memory while the app is open, and written back to Firestore on every change. There is no "save" button — changes are persisted automatically.
