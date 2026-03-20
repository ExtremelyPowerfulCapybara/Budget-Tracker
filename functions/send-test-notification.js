/**
 * Smoke test: send a real FCM notification to the first user in Firestore
 * that has an fcmToken.
 *
 * Usage (from repo root):
 *   node functions/send-test-notification.js
 *
 * Requires: firebase-admin (already a dep in functions/), GOOGLE_APPLICATION_CREDENTIALS
 * or just run via: cd functions && node send-test-notification.js
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'budgetlog-b318d' });

async function main() {
  const db = admin.firestore();
  const snapshot = await db.collection('users').get();

  const targets = snapshot.docs
    .map(doc => ({ uid: doc.id, token: doc.data().fcmToken }))
    .filter(u => !!u.token);

  if (!targets.length) {
    console.error('❌ No users with fcmToken found in Firestore.');
    console.log('   → Make sure you activated notifications in the app first.');
    process.exit(1);
  }

  console.log(`Found ${targets.length} user(s) with FCM token(s).`);

  for (const { uid, token } of targets) {
    console.log(`\nSending to uid=${uid} token=${token.slice(0, 20)}...`);
    try {
      const msgId = await admin.messaging().send({
        token,
        notification: {
          title: '🧪 BudgetLog · Prueba',
          body: 'Si ves esto, las notificaciones funcionan correctamente.'
        },
        webpush: {
          notification: {
            icon: 'https://budgetlog-b318d.web.app/icon-192.png',
            requireInteraction: true
          },
          fcmOptions: {
            link: 'https://budgetlog-b318d.web.app'
          }
        }
      });
      console.log(`✅ Sent! Message ID: ${msgId}`);
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered') {
        console.error(`❌ Token is expired/invalid for uid=${uid}`);
        console.log('   → Deactivate and reactivate notifications in the app to get a fresh token.');
      } else {
        console.error(`❌ Error: ${err.code} — ${err.message}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
