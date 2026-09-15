import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
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

const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

const firebaseAuth =
  getAuth(firebaseApp);

const signupButton =
  document.getElementById("signup-btn");

if (signupButton) {
  signupButton.addEventListener(
    "click",
    async function () {
      const emailInput =
        document.getElementById(
          "signup-email"
        );

      const passwordInput =
        document.getElementById(
          "signup-password"
        );

      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;

      if (!email || !password) {
        alert(
          "Please enter your email and password."
        );

        return;
      }

    try {
  await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );

  alert(
    "Account created successfully!"
  );

  return;
} catch (error) {
  alert(
    "Account error: " +
    error.message
  );

  return;
}
      
      console.log(
        "Signup form connected"
      );
    }
  );
}

   const loginButton =
  document.getElementById("login-btn");

if (loginButton) {
  loginButton.addEventListener(
    "click",
    async function () {
      const emailInput =
        document.getElementById(
          "login-email"
        );

      const passwordInput =
        document.getElementById(
          "login-password"
        );

      const message =
        document.getElementById(
          "login-message"
        );

      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;

      if (!email || !password) {
        message.textContent =
          "Please enter your email and password.";

        return;
      }

      try {
        await signInWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );

        message.textContent =
          "Signed in successfully!";
      } catch (error) {
        message.textContent =
          "Sign in failed: " +
          error.message;
      }
    }
  );
}

const forgotPasswordButton =
  document.getElementById(
    "forgot-password-btn"
  );

if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener(
    "click",
    async function () {
      const emailInput =
        document.getElementById(
          "login-email"
        );

      const message =
        document.getElementById(
          "reset-message"
        );

      const email =
        emailInput.value.trim();

      if (!email) {
        message.textContent =
          "Enter your email address first.";

        return;
      }

      try {
        await sendPasswordResetEmail(
          firebaseAuth,
          email
        );

        message.textContent =
          "Password reset email sent!";
      } catch (error) {
        message.textContent =
          "Reset failed: " +
          error.message;
      }
    }
  );
}
