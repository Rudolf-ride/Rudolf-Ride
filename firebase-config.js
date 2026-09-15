// =====================================
// RUDOLF RIDE FIREBASE CONFIG
// =====================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js";


// Firebase settings
const firebaseConfig = {

  apiKey:
    "AIzaSyBijD8OEhArIajTPJKS_qFEUFG9LUE2zhM",

  authDomain:
    "rudolf-ride.firebaseapp.com",

  databaseURL:
    "https://rudolf-ride-default-rtdb.europe-west1.firebasedatabase.app",

  projectId:
    "rudolf-ride",

  storageBucket:
    "rudolf-ride.firebasestorage.app",

  messagingSenderId:
    "266115753713",

  appId:
    "1:266115753713:web:acd980615d49459cfeab50"
};


// Start Firebase
const app = initializeApp(firebaseConfig);


// Database
const database = getDatabase(app);


// Cloud bridge
window.rudolfCloud = {

  write: function(path, value) {

    return set(
      ref(database, path),
      value
    );

  },


  listen: function(path, callback) {

    return onValue(
      ref(database, path),
      function(snapshot) {

        callback(
          snapshot.val()
        );

      }
    );

  },


  read: function(path) {

    return get(
      ref(database, path)
    )
    .then(function(snapshot){

      return snapshot.val();

    });

  }

};



// =====================================
// FIREBASE CLOUD MESSAGING
// =====================================

const messaging = getMessaging(app);

window.rudolfFCM = {

  enableNotifications: async function() {

    try {

      if (!("serviceWorker" in navigator)) {
        throw new Error(
          "Service workers are not supported."
        );
      }

      if (!("Notification" in window)) {
        throw new Error(
          "Notifications are not supported."
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "Notification permission was not granted."
        );
      }

      const registration =
        await navigator.serviceWorker.register(
          "./firebase-messaging-sw.js"
        );

      await navigator.serviceWorker.ready;

      const token = await getToken(
        messaging,
        {
          vapidKey:
            "BGXwGF9Lq79eFaOxDxn5acSy6x5hg1vSfW9UHOfpPr53Oc0oB_5blWX9hlxUg-xr5UuurRsrQz0tbC1xrnafUG8",

          serviceWorkerRegistration:
            registration
        }
      );

      if (!token) {
        throw new Error(
          "Firebase did not return an FCM token."
        );
      }

      console.log(
        "Rudolf Ride FCM token:",
        token
      );

      // Save this driver's FCM token
      alert("STEP 1: FCM TOKEN GENERATED");

      try {
        await window.rudolfCloud.write(
          "driverNotificationTokens/main",
          {
            token: token,
            updatedAt: new Date().toISOString()
          }
        );

        alert("STEP 2: DATABASE WRITE SUCCESS");
      } catch (dbError) {
        alert(
          "STEP 2 FAILED - DATABASE WRITE: " +
          dbError.code + " | " + dbError.message
        );
        throw dbError;
      }

      console.log(
        "FCM TOKEN SAVED SUCCESSFULLY"
      );

      alert(
        "DRIVER NOTIFICATIONS ENABLED"
      );

      return token;

    } catch (error) {

      console.error(
        "Rudolf Ride FCM error:",
        error
      );

      throw error;

    }

  }

};


onMessage(
  messaging,
  function(payload) {

    console.log(
      "Rudolf Ride foreground FCM:",
      payload
    );

  }
);

// Tell other scripts Firebase is ready
window.dispatchEvent(
  new Event("rudolfCloudReady")
);


console.log(
  "Rudolf Ride Firebase connected"
);