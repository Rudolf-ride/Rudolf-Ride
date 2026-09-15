// =====================================
// RUDOLF RIDE DRIVER - FCM SERVICE WORKER
// =====================================

importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyBijD8OEhArIajTPJKS_qFEUFG9LUE2zhM",
  authDomain: "rudolf-ride.firebaseapp.com",
  databaseURL: "https://rudolf-ride-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rudolf-ride",
  storageBucket: "rudolf-ride.firebasestorage.app",
  messagingSenderId: "266115753713",
  appId: "1:266115753713:web:acd980615d49459cfeab50"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {

  console.log(
    "Rudolf Ride background notification:",
    payload
  );

  /*
   * If FCM already supplies a notification payload,
   * the browser/FCM can display it.
   *
   * For data-only messages, create our notification.
   */
  if (payload.notification) {
    return;
  }

  const title =
    payload.data?.title ||
    "🚗 New Rudolf Ride";

  const options = {
    body:
      payload.data?.body ||
      "You have a new ride request.",

    tag: "rudolf-ride-request",

    data: {
      url:
        payload.data?.url ||
        "/driver.html"
    }
  };

  return self.registration.showNotification(
    title,
    options
  );
});


self.addEventListener(
  "notificationclick",
  function(event) {

    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      "/driver.html";

    event.waitUntil(
      clients.openWindow(targetUrl)
    );

  }
);
