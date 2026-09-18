import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
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

const emailInput =
  document.getElementById(
    "driver-email"
  );

const passwordInput =
  document.getElementById(
    "driver-password"
  );

const loginButton =
  document.getElementById(
    "driver-login-btn"
  );

const signupButton =
  document.getElementById(
    "driver-signup-btn"
  );

const message =
  document.getElementById(
    "driver-message"
  );

function showMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

loginButton.addEventListener(
  "click",
  async function () {

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;

    if (!email || !password) {
      showMessage(
        "Enter your email and password."
      );
      return;
    }

    try {

      showMessage("Signing in...");

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage(
        "Sign in successful."
      );

      window.location.replace(
        "index.html"
      );

    } catch (error) {

      console.error(error);

      showMessage(
        "Sign in failed: " +
        error.message
      );
    }
  }
);

signupButton.addEventListener(
  "click",
  async function () {

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;

    if (!email || !password) {
      showMessage(
        "Enter your email and password."
      );
      return;
    }

    if (password.length < 6) {
      showMessage(
        "Password must be at least 6 characters."
      );
      return;
    }

    try {

      showMessage(
        "Creating driver account..."
      );

      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      showMessage(
        "Driver account created."
      );

      window.location.replace(
        "index.html"
      );

    } catch (error) {

      console.error(error);

      showMessage(
        "Account creation failed: " +
        error.message
      );
    }
  }
);

onAuthStateChanged(
  auth,
  function (user) {

    if (user) {
      console.log(
        "Driver authenticated:",
        user.email
      );
    }

  }
);

/* =========================
   DRIVER FORGOT PASSWORD
========================= */

const forgotPasswordButton =
  document.getElementById(
    "driver-forgot-password-btn"
  );

if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener(
    "click",
    async function () {

      const email =
        emailInput.value.trim();

      if (!email) {
        showMessage(
          "Enter your driver email first."
        );
        emailInput.focus();
        return;
      }

      try {
        showMessage(
          "Sending password reset email..."
        );

        await sendPasswordResetEmail(
          auth,
          email
        );

        showMessage(
          "Password reset email sent. Check your inbox."
        );

      } catch (error) {
        console.error(
          "Password reset error:",
          error
        );

        showMessage(
          "Unable to send reset email. Check the email and try again."
        );
      }
    }
  );
}
