import { Capacitor } from "@capacitor/core";
import OneSignal from "@onesignal/capacitor-plugin";

const ONESIGNAL_APP_ID = "37313947-2360-4bf3-ab26-21310fced263";

async function getPushDiagnostics() {
  const permission = await OneSignal.Notifications.hasPermission();

  let oneSignalId = null;
  let subscriptionId = null;
  let optedIn = null;

  try {
    oneSignalId = await OneSignal.User.getOnesignalId();
  } catch (error) {
    console.warn("OneSignal ID check failed:", error);
  }

  try {
    subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
  } catch (error) {
    console.warn("Subscription ID check failed:", error);
  }

  try {
    optedIn = await OneSignal.User.pushSubscription.getOptedInAsync();
  } catch (error) {
    console.warn("Opt-in check failed:", error);
  }

  return {
    permission,
    oneSignalId,
    subscriptionId,
    optedIn
  };
}

async function startMobilePush() {
  const button = document.getElementById("enable-fcm-btn");

  if (!button) {
    throw new Error("Notification button missing");
  }

  if (!Capacitor.isNativePlatform()) {
    button.textContent = "Open the APK to enable mobile alerts";
    button.disabled = true;
    return;
  }

  button.disabled = true;
  button.textContent = "Preparing notifications...";

  await OneSignal.initialize(ONESIGNAL_APP_ID);

  window.rudolfMobilePush = OneSignal;

  button.disabled = false;
  button.textContent = "🔔";

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      await OneSignal.Notifications.requestPermission(true);

      const result = await getPushDiagnostics();

      console.log("RUDOLF NATIVE PUSH DIAGNOSTIC:", result);

      button.textContent =
        result.permission && result.subscriptionId
          ? "✅ Mobile Alerts Ready"
          : "⚠️ Check Notifications";

      alert(
        "RUDOLF RIDE NATIVE PUSH\n\n" +
        "Permission: " + result.permission + "\n" +
        "Opted In: " + result.optedIn + "\n" +
        "OneSignal ID: " + (result.oneSignalId || "NOT READY") + "\n" +
        "Subscription ID: " + (result.subscriptionId || "NOT READY")
      );
    } catch (error) {
      console.error("Notification setup failed:", error);

      button.textContent = "Retry Notifications";

      alert(
        "Notification setup failed:\n\n" +
        (error?.message || String(error))
      );
    } finally {
      button.disabled = false;
    }
  });
}

startMobilePush().catch(error => {
  console.error("Mobile push setup:", error);

  const button = document.getElementById("enable-fcm-btn");

  if (button) {
    button.textContent = "Notification setup failed";
  }

  alert(
    "Mobile push setup failed:\n\n" +
    (error?.message || String(error))
  );
});
