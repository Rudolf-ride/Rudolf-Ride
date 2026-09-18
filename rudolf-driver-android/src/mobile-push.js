
import { Capacitor } from "@capacitor/core";
import OneSignal from "@onesignal/capacitor-plugin";

async function startMobilePush() {
  const button = document.getElementById("enable-fcm-btn");
  if (!button) throw new Error("Notification button missing");

  if (!Capacitor.isNativePlatform()) {
    button.textContent = "Open the APK to enable mobile alerts";
    button.disabled = true;
    return;
  }

  button.disabled = true;
  button.textContent = "Preparing notifications...";

  await OneSignal.initialize(
    "37313947-2360-4bf3-ab26-21310fced263"
  );
  window.rudolfMobilePush = OneSignal;

  button.disabled = false;
  button.textContent = "Enable Notifications";

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await OneSignal.Notifications.requestPermission(true);
      const allowed = await OneSignal.Notifications.hasPermission();
      button.textContent = allowed
        ? "Notification permission granted"
        : "Enable Notifications";
      alert(allowed
        ? "Permission granted. Next we must verify Android push registration and delivery."
        : "Notifications are not allowed. Check this app's notification settings.");
    } catch (error) {
      button.textContent = "Retry Notifications";
      alert("Notification setup failed: " + error.message);
    } finally {
      button.disabled = false;
    }
  });
}

startMobilePush().catch(error => {
  console.error("Mobile push setup:", error);
  const button = document.getElementById("enable-fcm-btn");
  if (button) button.textContent = "Notification setup failed";
  alert("Mobile push setup failed: " + error.message);
});
