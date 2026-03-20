importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBL5BbVbQLkDe8Gr74yz1Rq6J9cxF-t3pY",
  authDomain: "budgetlog-b318d.firebaseapp.com",
  projectId: "budgetlog-b318d",
  storageBucket: "budgetlog-b318d.firebasestorage.app",
  messagingSenderId: "646922985575",
  appId: "1:646922985575:web:0a3808229d0e1bb1a3b4c2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/badge-96.png'
  });
});
