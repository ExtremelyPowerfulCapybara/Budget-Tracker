# Skill: Working with BudgetLog Cloud Functions

Use this skill when editing `functions/index.js` or adding new Cloud Functions.

---

## Setup

Functions live in `functions/` with their own `package.json` and `node_modules`.
Runtime: Node.js (check `functions/package.json` for version).
Plan required: **Blaze** (pay-as-you-go) — required for any Cloud Function.

---

## Local Testing (Always Do This First)

Never deploy untested functions. Use the Firebase emulator:

```powershell
cd D:\GitHub\Budget-Tracker
firebase emulators:start --only functions
```

For the scheduled `budgetAlerts` function, trigger it manually via the emulator UI at:
`http://localhost:4000`

Or call an HTTP function directly:
```powershell
curl http://localhost:5001/budgetlog-b318d/us-central1/myFunction
```

---

## Current Function: budgetAlerts

```
Schedule: 0 14 * * * (UTC) = 8:00am Mexico City (America/Mexico_City)
Trigger: Cloud Pub/Sub schedule
What it does:
  1. Reads all users from Firestore users collection
  2. For each user with an fcmToken, checks this month's category spending vs goals
  3. Sends FCM push notification if any category is at 80% or 100%+ of goal
  4. Cleans up expired/invalid FCM tokens automatically
```

### Category label resolution order
```js
const label = (customCategories[catId]?.label) || CATEGORY_LABELS[catId] || catId;
```
Always check `customCategories` first — users may have renamed categories.

---

## Adding a New Scheduled Function

```js
exports.myScheduledFunction = functions.pubsub
  .schedule("0 10 * * 1")          // every Monday at 10am UTC
  .timeZone("America/Mexico_City")  // always set timezone
  .onRun(async () => {
    const db = admin.firestore();
    // your logic
    return null;  // always return null
  });
```

Common schedules (cron format):
- Daily 8am MX: `"0 14 * * *"` (UTC)
- Weekly Monday 10am MX: `"0 16 * * 1"` (UTC)
- Monthly 1st 9am MX: `"0 15 1 * *"` (UTC)

---

## Adding a New HTTP Function

```js
exports.myHttpFunction = functions.https.onRequest(async (req, res) => {
  // Always set CORS headers if called from the browser
  res.set('Access-Control-Allow-Origin', 'https://budgetlog-b318d.web.app');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }
  // your logic
  res.json({ success: true });
});
```

---

## Sending FCM Notifications

Always use `admin.messaging().send()` with the `token` field (not `registrationToken`):

```js
const message = {
  token: fcmToken,
  notification: {
    title: "BudgetLog · Título",
    body: "Cuerpo del mensaje"
  },
  webpush: {
    notification: {
      icon: "https://budgetlog-b318d.web.app/icon-192.png",
      badge: "https://budgetlog-b318d.web.app/icon-192.png",
      requireInteraction: false
    },
    fcmOptions: {
      link: "https://budgetlog-b318d.web.app"
    }
  }
};

try {
  await admin.messaging().send(message);
} catch (err) {
  // Always clean up invalid tokens
  if (err.code === "messaging/registration-token-not-registered") {
    await userDocRef.update({ fcmToken: admin.firestore.FieldValue.delete() });
  }
}
```

**Icon/badge URL:** Always use the Firebase Hosting URL: `https://budgetlog-b318d.web.app/icon-192.png`
Never use the old GitHub Pages URL (`extremelypowerfulcapybara.github.io/...`) — it is outdated and incorrect.

---

## Firestore Batch Writes

For operations that touch many users, use batched writes (max 500 per batch):

```js
const BATCH_SIZE = 400; // stay under 500 limit
let batch = db.batch();
let count = 0;

for (const doc of snapshot.docs) {
  batch.update(doc.ref, { someField: newValue });
  count++;
  if (count >= BATCH_SIZE) {
    await batch.commit();
    batch = db.batch();
    count = 0;
  }
}
if (count > 0) await batch.commit();
```

---

## Deploy

```powershell
# Deploy functions only
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:budgetAlerts
```

---

## Common Mistakes

- **Not returning null** from scheduled functions — causes timeout warnings
- **Using `multicast`** — deprecated, use `send()` in a loop or `sendEachForMulticast()`
- **Not handling expired tokens** — FCM tokens expire; always catch `messaging/registration-token-not-registered`
- **Reading customCategories without optional chaining** — old users may not have this field: `customCategories?.[catId]?.label`
- **Deploying without testing** — always run emulator first
