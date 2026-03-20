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
            badge: "https://budgetlog-b318d.web.app/icon-192.png",
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
