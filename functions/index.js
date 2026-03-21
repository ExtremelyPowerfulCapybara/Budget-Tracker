const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Runs daily at 8am Mexico City time (UTC-6 = 14:00 UTC)
exports.budgetAlerts = functions.pubsub
  .schedule("0 14 * * *")
  .timeZone("America/Mexico_City")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const snapshot = await db.collection("users").get();

    const CATEGORY_LABELS = {
      food: "Alimentos", restaurant: "Restaurantes", transport: "Transporte",
      uber: "Uber/Rappi", utilities: "Servicios", shopping: "Compras",
      health: "Salud", entertainment: "Entretenimiento", clothing: "Ropa", savings: "Ahorro"
    };

    const sends = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const { fcmToken, entries = [], goals = {}, customCategories = {} } = data;

      // FIX 1: Skip if no FCM token
      if (!fcmToken) return;

      // FIX 2: Skip if no goals set — nothing to compare against
      if (!goals || Object.keys(goals).length === 0) return;

      // Get this month's expenses
      const monthEntries = entries.filter(e =>
        e.type === "expense" && e.date && e.date.startsWith(monthKey)
      );

      // Check each category against its goal
      const alerts = [];
      for (const [catId, goal] of Object.entries(goals)) {
        if (!goal || catId === "income") continue;

        const spent = monthEntries
          .filter(e => e.category === catId)
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);

        // FIX 3: Skip categories with zero spending and no goal breach
        if (spent === 0) continue;

        const pct = spent / goal;

        // FIX 4: Resolve label — check customCategories first, then fallback map
        const label = (customCategories[catId]?.label) || CATEGORY_LABELS[catId] || catId;

        if (pct >= 1.0) {
          alerts.push(`🔴 ${label}: excediste tu meta (${Math.round(pct * 100)}%)`);
        } else if (pct >= 0.8) {
          alerts.push(`🟡 ${label}: 80%+ de tu meta gastado`);
        } else if (pct >= 0.5) {
          alerts.push(`🔵 ${label}: 50% de tu meta gastado`);
        }
      }

      if (!alerts.length) return;

      const message = {
        token: fcmToken,
        notification: {
          title: "BudgetLog · Resumen del día",
          body: alerts.slice(0, 3).join(" · ")
        },
        webpush: {
          notification: {
            // FIX 5: Updated to correct Firebase Hosting URL
            icon: "https://budgetlog-b318d.web.app/icon-192.png",
            badge: "https://budgetlog-b318d.web.app/badge-96.png",
            requireInteraction: false
          },
          fcmOptions: {
            // FIX 5: Updated to correct Firebase Hosting URL
            link: "https://budgetlog-b318d.web.app"
          }
        }
      };

      try {
        await admin.messaging().send(message);
      } catch (err) {
        if (err.code === "messaging/registration-token-not-registered") {
          // Token expired — clean it up
          await doc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
        } else {
          // FIX 6: Log unexpected errors instead of silently swallowing them
          console.error(`FCM send error for user ${doc.id}:`, err.code, err.message);
        }
      }
    });

    await Promise.all(sends);
    return null;
  });

// Runs every Monday at 9am Mexico City time (UTC-6 = 15:00 UTC)
exports.weeklyDigest = functions.pubsub
  .schedule("0 15 * * 1")
  .timeZone("America/Mexico_City")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();

    const CATEGORY_LABELS = {
      food: "Alimentos", restaurant: "Restaurantes", transport: "Transporte",
      uber: "Uber/Rappi", utilities: "Servicios", shopping: "Compras",
      health: "Salud", entertainment: "Entretenimiento", clothing: "Ropa", savings: "Ahorro"
    };

    // Build ISO date strings for the last 7 days and last 8 weeks (56 days)
    function toDateStr(d) {
      return d.toISOString().slice(0, 10);
    }
    const day7Ago = new Date(now); day7Ago.setDate(now.getDate() - 7);
    const day56Ago = new Date(now); day56Ago.setDate(now.getDate() - 56);
    const last7Start = toDateStr(day7Ago);
    const last56Start = toDateStr(day56Ago);

    const snapshot = await db.collection("users").get();

    const sends = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const { fcmToken, entries = [], customCategories = {} } = data;

      if (!fcmToken) return;

      const expenses = entries.filter(e =>
        e.type === "expense" && e.date && e.date >= last56Start
      );

      if (!expenses.length) return;

      // Last 7 days spending per category
      const last7 = expenses.filter(e => e.date >= last7Start);
      if (!last7.length) return;

      const spendByCategory = {};
      for (const e of last7) {
        spendByCategory[e.category] = (spendByCategory[e.category] || 0) + (Number(e.amount) || 0);
      }

      // 8-week average per category (weeks 1–8 before today, each 7 days)
      // prior 7 weeks = days 8–56 ago (exclude the most recent 7-day window)
      const prior7Weeks = expenses.filter(e => e.date < last7Start);
      const avgByCategory = {};
      for (const e of prior7Weeks) {
        avgByCategory[e.category] = (avgByCategory[e.category] || 0) + (Number(e.amount) || 0);
      }
      // prior7Weeks covers 7 weeks → divide by 7 to get weekly average
      for (const catId of Object.keys(avgByCategory)) {
        avgByCategory[catId] = avgByCategory[catId] / 7;
      }

      // Total spent last 7 days
      const totalSpent = Object.values(spendByCategory).reduce((s, v) => s + v, 0);

      // Top 2 categories by spend
      const sorted = Object.entries(spendByCategory)
        .sort((a, b) => b[1] - a[1]);
      const top2 = sorted.slice(0, 2);

      // Spending spikes: 20%+ above 7-week average
      const spikes = sorted.filter(([catId, spent]) => {
        const avg = avgByCategory[catId] || 0;
        return avg > 0 && spent >= avg * 1.2;
      });

      function resolveLabel(catId) {
        return (customCategories?.[catId]?.label) || CATEGORY_LABELS[catId] || catId;
      }
      function fmt(n) {
        return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      const parts = [];
      parts.push(`Total 7 días: ${fmt(totalSpent)}`);
      if (top2.length) {
        parts.push("Top: " + top2.map(([catId, v]) => `${resolveLabel(catId)} ${fmt(v)}`).join(", "));
      }
      for (const [catId, spent] of spikes) {
        const avg = avgByCategory[catId];
        const pct = Math.round(((spent - avg) / avg) * 100);
        parts.push(`⚠️ ${resolveLabel(catId)}: +${pct}% vs promedio`);
      }

      const message = {
        token: fcmToken,
        notification: {
          title: "BudgetLog · Resumen semanal",
          body: parts.slice(0, 3).join(" · ")
        },
        webpush: {
          notification: {
            icon: "https://budgetlog-b318d.web.app/icon-192.png",
            badge: "https://budgetlog-b318d.web.app/badge-96.png",
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
        if (err.code === "messaging/registration-token-not-registered") {
          await doc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
        } else {
          console.error(`FCM weekly digest error for user ${doc.id}:`, err.code, err.message);
        }
      }
    });

    await Promise.all(sends);
    return null;
  });

// Returns the caller's pending invite, if any.
// Called on every login — uses Admin SDK to query server-side (no client list permission needed).
exports.getPendingInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const email = context.auth.token.email;
  if (!email) throw new functions.https.HttpsError('failed-precondition', 'No email on account');

  const db = admin.firestore();
  const snap = await db.collection('invites')
    .where('inviteeEmail', '==', email)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
});

// Atomically removes a member from a space and clears their spaceId pointer.
// Only the space creator can call this. Creator cannot remove themselves.
exports.removeMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const { spaceId, memberUid } = data;
  if (!spaceId || !memberUid) throw new functions.https.HttpsError('invalid-argument', 'spaceId and memberUid required');

  const db = admin.firestore();
  await db.runTransaction(async (tx) => {
    const spaceRef = db.collection('spaces').doc(spaceId);
    const spaceDoc = await tx.get(spaceRef);
    if (!spaceDoc.exists) throw new functions.https.HttpsError('not-found', 'Space not found');

    const spaceData = spaceDoc.data();
    if (spaceData.createdBy !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the creator can remove members');
    }
    if (memberUid === spaceData.createdBy) {
      throw new functions.https.HttpsError('invalid-argument', 'Creator cannot be removed');
    }

    const memberRef = db.collection('users').doc(memberUid);
    tx.update(spaceRef, { members: admin.firestore.FieldValue.arrayRemove(memberUid) });
    tx.update(memberRef, { spaceId: null });
  });

  return { success: true };
});

// Deletes a shared space: clears all members' spaceId, deletes the space doc,
// and cleans up any pending invites for the space.
// Only the space creator can call this.
exports.deleteSpace = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const { spaceId } = data;
  if (!spaceId) throw new functions.https.HttpsError('invalid-argument', 'spaceId required');

  const db = admin.firestore();

  // Transaction: read members, clear their spaceId, delete space doc
  await db.runTransaction(async (tx) => {
    const spaceRef = db.collection('spaces').doc(spaceId);
    const spaceDoc = await tx.get(spaceRef);
    if (!spaceDoc.exists) throw new functions.https.HttpsError('not-found', 'Space not found');

    const spaceData = spaceDoc.data();
    if (spaceData.createdBy !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the creator can delete the space');
    }

    const members = spaceData.members || [];
    for (const uid of members) {
      tx.update(db.collection('users').doc(uid), { spaceId: null });
    }
    tx.delete(spaceRef);
  });

  // Clean up orphaned invites (batched write, outside transaction)
  const invitesSnap = await db.collection('invites').where('spaceId', '==', spaceId).get();
  if (!invitesSnap.empty) {
    const batch = db.batch();
    invitesSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  return { success: true };
});
