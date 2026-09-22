// RUDOLF_OVERLAY_ACTION_HANDLER
(function () {
let pending = null, busy = false;
async function processOverlayAction() {
if (busy || document.hidden || !window.rudolfCloud) return;
const cap = window.Capacitor;
if (!cap) return;
busy = true;
try {
const plugin = cap.Plugins?.RideActions || cap.registerPlugin?.("RideActions");
if (!plugin) return;
if (!pending) pending = await plugin.takeAction();
if (!pending?.rideId || Date.now() > Number(pending.expiresAt)) {
pending = null;
return;
}
if (!["accept", "decline"].includes(pending.action)) {
pending = null; return;
}
if (typeof isOnline === "undefined" || !isOnline) return;
const ride = await window.rudolfCloud.read(CURRENT_RIDE_KEY);
if (document.hidden) return;
if (!ride || String(ride.rideId || "") !== String(pending.rideId)) {
pending = null;
alert("This request no longer matches the current ride."); return;
}
if (!isWaitingForDriver(ride.status)) { pending = null; alert("This ride is no longer waiting for a driver."); return; }
const expiry = Number(pending.expiresAt);
if (!Number.isFinite(expiry) || Date.now() > expiry) {
pending = null; return;
}
if (!isOnline) return;
saveStoredObject(CURRENT_RIDE_KEY, ride);
const action = pending.action;
pending = null;
if (action === "accept") acceptRide();
else declineRide();
} catch (error) {
console.error("Overlay action failed", error);
pending = null;
alert("Could not process the popup action. Check the ride in the app.");
} finally {
busy = false;
}
}
document.addEventListener("visibilitychange", processOverlayAction);
setInterval(processOverlayAction, 1500);
processOverlayAction();
})();
