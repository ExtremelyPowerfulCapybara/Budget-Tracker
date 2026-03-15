# Firebase — Complete Guide

A comprehensive guide covering what Firebase is, what it can do, its pricing plans, and how to host a static site or PWA on it.

---

## What is Firebase?

Firebase is Google's app development platform — a suite of backend tools that lets you build, host, and scale apps without managing your own servers. It lives on Google Cloud infrastructure and covers everything from hosting and databases to authentication and push notifications.

---

## Firebase Products & What They Do

### 🌐 Hosting
Serve static files (HTML, CSS, JS, images) and single-page apps from a global CDN. Comes with automatic HTTPS and a free `.web.app` domain out of the box. Supports custom domains too.

**Good for:** Websites, PWAs, landing pages, dashboards.

---

### 🔐 Authentication
Ready-made sign-in flows with Google, Apple, Facebook, GitHub, email/password, phone, and more. No backend code needed — the SDK handles tokens and sessions.

**Good for:** Any app that needs user accounts.

---

### 🗄️ Firestore (Cloud Firestore)
A flexible, scalable NoSQL document database. Supports real-time listeners so the UI updates instantly when data changes. Works offline too — syncs when connection is restored.

**Good for:** Real-time apps, syncing data across devices, anything that needs to scale.

---

### 📦 Realtime Database
Firebase's original database. Simpler than Firestore — stores everything as a single JSON tree. Lower latency for simple reads, but less flexible for complex queries.

**Good for:** Presence indicators, live chat, simple synchronized state.

---

### ☁️ Cloud Functions
Run backend Node.js code without a server. Functions trigger on events (HTTP request, database write, new user, scheduled time, etc.).

**Good for:** Sending emails, processing payments, push notification logic, scheduled jobs.

> ⚠️ Requires Blaze (pay-as-you-go) plan — not available on the free Spark plan.

---

### 📁 Cloud Storage
Store and serve user-uploaded files — images, videos, PDFs, audio. Integrates with Firebase Auth so you can control who can read/write what.

**Good for:** Profile photos, file uploads, media libraries.

---

### 📲 Cloud Messaging (FCM)
Send push notifications to Android, iOS, and web (PWA) apps. Free, unlimited. This is what BudgetLog uses for budget alert notifications.

**Good for:** Any app that needs to notify users of events.

---

### 📊 Analytics
Free, unlimited Google Analytics built in. Tracks events, user journeys, retention, and funnels. No extra setup if you use the Firebase SDK.

**Good for:** Understanding how users interact with your app.

---

### 🧪 A/B Testing & Remote Config
Change your app's behavior without releasing a new version. Roll out features to a percentage of users, run experiments, or toggle flags remotely.

**Good for:** Feature flags, gradual rollouts, UI experiments.

---

### 🛡️ App Check
Protect your backend resources from abuse by verifying that traffic comes from your actual app, not bots or scraping scripts.

**Good for:** Protecting Firestore, Storage, and Functions from unauthorized access.

---

### 📈 Performance Monitoring & Crashlytics
Track how fast your app loads, where it's slow, and what crashes are occurring in production — with stack traces and device info.

**Good for:** Diagnosing performance bottlenecks and bugs in production.

---

## Pricing Plans

### Spark — Free

The default plan. No credit card needed.

| Product | Free Limit |
|---------|-----------|
| Hosting | 10 GB storage, 10 GB/month transfer |
| Firestore | 1 GB storage, 50K reads/day, 20K writes/day, 20K deletes/day |
| Realtime Database | 1 GB storage, 10 GB/month transfer |
| Authentication | 10,000 phone auth/month, unlimited email/social |
| Cloud Storage | 5 GB storage, 1 GB/day download |
| Cloud Messaging (FCM) | Unlimited (always free) |
| Analytics | Unlimited (always free) |
| **Cloud Functions** | ❌ Not available |
| **Cloud Run** | ❌ Not available |

**Best for:** Personal projects, prototypes, small apps with low traffic.

---

### Blaze — Pay As You Go

You connect a credit card, but you only pay for what you use beyond the free tier. The free tier limits still apply — you won't be charged unless you exceed them.

| Product | Free Tier | Then |
|---------|-----------|------|
| Hosting | 10 GB storage, 10 GB/month transfer | $0.026/GB storage, $0.15/GB transfer |
| Firestore | Same as Spark | $0.06/100K reads, $0.18/100K writes |
| Cloud Functions | ✅ Unlocked | 2M invocations/month free, then $0.40/million |
| Cloud Storage | 5 GB, 1 GB/day download | $0.026/GB storage |
| Authentication (phone) | 10,000/month | $0.0055 per verification |

**Best for:** Apps in production, anything that uses Cloud Functions (required for scheduled jobs, background processing, server-side logic).

> 💡 You can set **budget alerts** in the Google Cloud console to get notified before costs grow unexpectedly. Most small apps stay well within the free tier even on Blaze.

---

### Spark vs Blaze — Quick Decision

| Situation | Plan |
|-----------|------|
| Static site / PWA, no server-side logic | Spark (free) |
| Need Cloud Functions (scheduled tasks, emails, etc.) | Blaze |
| App in production with real users | Blaze (but likely still $0/month) |
| High-traffic app or enterprise | Blaze |

---

## Hosting a Static Site / PWA — Step by Step

### Prerequisites

- [Node.js](https://nodejs.org) installed (v18+)
- A Google account
- Your project files ready (HTML, JS, CSS, images)

---

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

---

### 2. Log In

```bash
firebase login
```

Opens a browser window — sign in with your Google account.

---

### 3. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name → follow the prompts
3. Skip Google Analytics if you don't need it

---

### 4. Initialize Firebase in Your Project Folder

Navigate to your project folder in the terminal, then run:

```bash
firebase init hosting
```

Answer the prompts like this:

| Prompt | Answer |
|--------|--------|
| Use an existing project? | Yes → select your project |
| Public directory? | `.` (just a dot — files are in the root) |
| Single-page app? | `No` (unless using React Router, etc.) |
| Set up GitHub auto-builds? | `No` |
| Overwrite index.html? | `No` |

This creates `firebase.json` and `.firebaserc`.

---

### 5. Deploy

```bash
firebase deploy --only hosting
```

When it finishes:

```
Hosting URL: https://your-project-id.web.app
```

Share that link — it's live immediately.

---

### 6. Redeploying After Changes

```bash
firebase deploy --only hosting
```

No rebuild step for plain HTML/JS/CSS projects.

---

## File Structure

```
your-project/
├── index.html              ← entry point (served at /)
├── firebase.json           ← Firebase config (auto-generated)
├── .firebaserc             ← project name (auto-generated)
├── firebase-messaging-sw.js  ← if using FCM push notifications
├── manifest.json           ← if PWA
├── icon-192.png
└── icon-512.png
```

---

## firebase.json Reference

Minimal config for a static site:

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

With Cloud Functions also deployed:

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default"
    }
  ],
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

---

## Useful Commands

| Command | What it does |
|---------|--------------|
| `firebase deploy --only hosting` | Deploy hosting only |
| `firebase deploy --only functions` | Deploy functions only |
| `firebase deploy` | Deploy everything |
| `firebase serve` | Preview locally at `localhost:5000` |
| `firebase projects:list` | List all your Firebase projects |
| `firebase use <project-id>` | Switch active project |
| `firebase logout` | Log out |
| `firebase open hosting:site` | Open your live site in the browser |

---

## Notes

- Your site is live at both `your-project.web.app` and `your-project.firebaseapp.com`
- HTTPS is automatic — no setup or certificate management needed
- Cloud Functions require the **Blaze** plan, but hosting alone works on the free **Spark** plan
- To add a custom domain: Firebase Console → Hosting → Add custom domain → follow the DNS verification steps
- Multiple sites can share one Firebase project (useful for separating a landing page from an app)
