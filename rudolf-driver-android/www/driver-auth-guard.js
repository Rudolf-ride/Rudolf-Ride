import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

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

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

const auth = getAuth(app);

onAuthStateChanged(
  auth,
  function (user) {

    if (!user) {

      console.log(
        "No Driver session."
      );

      window.location.replace(
        "driver-login.html"
      );

      return;
    }

    console.log(
      "Driver session active:",
      user.email
    );
  }
);


/* =========================
   DRIVER MENU + LOGOUT
========================= */

const menuBtn =
  document.getElementById(
    "driver-menu-btn"
  );

const menuDropdown =
  document.getElementById(
    "driver-menu-dropdown"
  );

const logoutBtn =
  document.getElementById(
    "driver-logout-btn"
  );

if (menuBtn && menuDropdown) {

  menuBtn.addEventListener(
    "click",
    function () {

      const isHidden =
        menuDropdown.style.display ===
        "none";

      menuDropdown.style.display =
        isHidden ? "block" : "none";
    }
  );
}

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    async function () {

      try {

        await signOut(auth);

        window.location.replace(
          "driver-login.html"
        );

      } catch (error) {

        console.error(
          "Driver logout error:",
          error
        );

        alert(
          "Could not logout. Please try again."
        );
      }
    }
  );
}
