"use strict";

// =====================================
// RUDOLF RIDE DRIVER APP - FULL SCRIPT
// =====================================

const CURRENT_RIDE_KEY = "rudolfCurrentRide";
const DRIVER_ONLINE_KEY = "rudolfDriverOnline";
const DRIVER_RIDES_KEY = "rudolfDriverRides";
const DRIVER_LOCATION_KEY = "rudolfDriverLocation";
const DRIVER_WITHDRAWALS_KEY = "rudolfDriverWithdrawals";

let isOnline =
  localStorage.getItem(DRIVER_ONLINE_KEY) === "true";

let driverLocationWatchId = null;


/* =========================================
   3R DRS-D — DRIVER ACCOUNT ENFORCEMENT

   Admin controls:
   active
   suspended
   blocked

   Protected rule:
   Go Offline is always allowed.
   Go Online requires an active account.
   GPS watcher itself is NOT changed.
   ========================================= */

const DRIVER_ACCOUNT_CONTROL_ROOT =
  "rudolfDriverVerification";

let driverAccountControlUnsubscribe =
  null;

let driverAccountControlListenerStarting =
  false;


function getEffectiveDriverAccountControlState(
  control
) {

  const state =
    String(
      control &&
      control.state
        ? control.state
        : "active"
    ).toLowerCase();


  if (state === "blocked") {
    return "blocked";
  }


  if (state === "suspended") {

    const until =
      new Date(
        control &&
        control.suspendedUntil
          ? control.suspendedUntil
          : ""
      ).getTime();


    if (
      Number.isFinite(until) &&
      until > Date.now()
    ) {
      return "suspended";
    }


    /*
     * Suspension date has passed.
     * Driver may go Online again.
     */
    return "active";
  }


  return "active";
}


function formatDriverRestrictionUntil(
  value
) {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleString();
}


function getDriverRestrictionMessage(
  control
) {

  const state =
    getEffectiveDriverAccountControlState(
      control
    );

  const reason =
    String(
      control &&
      control.reason
        ? control.reason
        : ""
    ).trim();


  if (state === "suspended") {

    const until =
      formatDriverRestrictionUntil(
        control.suspendedUntil
      );


    let message =
      "Account Suspended";


    if (until) {

      message +=
        "\\n\\nYou cannot go Online until " +
        until +
        ".";
    }


    if (reason) {

      message +=
        "\\n\\nReason: " +
        reason;
    }


    return message;
  }


  if (state === "blocked") {

    let message =
      "Account Blocked";


    message +=
      "\\n\\nYou cannot go Online.";


    if (reason) {

      message +=
        "\\n\\nReason: " +
        reason;
    }


    message +=
      "\\n\\nContact Rudolf Ride Admin.";


    return message;
  }


  return "";
}


function setDriverAvailabilityState(
  nextOnline
) {

  isOnline =
    Boolean(nextOnline);


  localStorage.setItem(
    DRIVER_ONLINE_KEY,
    String(isOnline)
  );


  if (
    window.rudolfCloud &&
    typeof window.rudolfCloud.write ===
      "function"
  ) {

    window.rudolfCloud
      .write(
        "rudolfDriverAvailability",
        isOnline
      )
      .catch(function (error) {

        console.error(
          "Driver availability cloud write:",
          error
        );

      });
  }


  updateDriverAvailability();


  if (isOnline) {

    /*
     * Existing protected GPS controller.
     * No extra watcher is created.
     */
    startDriverLiveLocation();

  } else {

    stopRideRingtone();

    stopDriverLiveLocation();
  }
}


function waitForDriverAccountControlReady() {

  return new Promise(
    function (
      resolve,
      reject
    ) {

      const startedAt =
        Date.now();


      const timer =
        setInterval(
          function () {

            const authReady =
              window.rudolfDriverAuth &&
              window.rudolfDriverAuth.uid;

            const cloudReady =
              window.rudolfCloud &&
              typeof window.rudolfCloud.read ===
                "function" &&
              typeof window.rudolfCloud.listen ===
                "function";


            if (
              authReady &&
              cloudReady
            ) {

              clearInterval(timer);

              resolve({
                uid:
                  window
                    .rudolfDriverAuth
                    .uid
              });

              return;
            }


            if (
              Date.now() -
              startedAt >
              8000
            ) {

              clearInterval(timer);

              reject(
                new Error(
                  "Driver account status service is not ready."
                )
              );
            }

          },
          100
        );
    }
  );
}


async function readDriverAccountControl() {

  const identity =
    await waitForDriverAccountControlReady();


  const path =
    DRIVER_ACCOUNT_CONTROL_ROOT +
    "/" +
    identity.uid +
    "/accountControl";


  const control =
    await window.rudolfCloud.read(
      path
    );


  return (
    control &&
    typeof control === "object"
  )
    ? control
    : {};
}


function enforceDriverRestriction(
  control,
  notifyDriver
) {

  const state =
    getEffectiveDriverAccountControlState(
      control
    );


  if (
    state !== "suspended" &&
    state !== "blocked"
  ) {
    return false;
  }


  const wasOnline =
    isOnline;


  if (isOnline) {

    setDriverAvailabilityState(
      false
    );
  }


  if (
    notifyDriver &&
    wasOnline
  ) {

    alert(
      getDriverRestrictionMessage(
        control
      )
    );
  }


  return true;
}


async function startDriverAccountControlListener() {

  if (
    driverAccountControlUnsubscribe ||
    driverAccountControlListenerStarting
  ) {
    return;
  }


  driverAccountControlListenerStarting =
    true;


  try {

    const identity =
      await waitForDriverAccountControlReady();


    const path =
      DRIVER_ACCOUNT_CONTROL_ROOT +
      "/" +
      identity.uid +
      "/accountControl";


    driverAccountControlUnsubscribe =
      window.rudolfCloud.listen(
        path,
        function (control) {

          const record =
            control &&
            typeof control === "object"
              ? control
              : {};


          /*
           * If Admin suspends or blocks an
           * already-Online Driver, immediately
           * force that Driver Offline.
           */
          enforceDriverRestriction(
            record,
            true
          );

        }
      );


    console.log(
      "Driver account-control listener active"
    );


  } catch (error) {

    console.error(
      "Driver account-control listener:",
      error
    );


    setTimeout(
      startDriverAccountControlListener,
      1500
    );


  } finally {

    driverAccountControlListenerStarting =
      false;
  }
}


async function initializeDriverAccountControlEnforcement() {

  const wasOnline =
    isOnline;


  try {

    const control =
      await readDriverAccountControl();


    const restricted =
      enforceDriverRestriction(
        control,
        false
      );


    if (restricted) {

      if (wasOnline) {

        alert(
          getDriverRestrictionMessage(
            control
          )
        );
      }

    } else if (isOnline) {

      /*
       * Account is allowed:
       * resume the existing protected GPS.
       */
      startDriverLiveLocation();

    } else {

      stopDriverLiveLocation();
    }


  } catch (error) {

    console.error(
      "Driver account startup check:",
      error
    );


    /*
     * Fail closed:
     * if account status cannot be verified,
     * do not silently leave Driver Online.
     */
    if (isOnline) {

      setDriverAvailabilityState(
        false
      );


      alert(
        "Unable to verify your Driver account status. " +
        "You have been kept Offline. " +
        "Check your internet connection and try again."
      );

    } else {

      stopDriverLiveLocation();
    }
  }


  startDriverAccountControlListener();
}


/*
 * 3R DRS-D GPS protection:
 * only one navigator.geolocation watcher may exist.
 */
let driverAccuracyCircle = null;
let driverLastKnownLocation = null;
let driverMapFollow = true;
let driverLocationMap = null;
let driverLocationMarker = null;
let passengerPickupMarker = null;
let lastRideSignature = "";


// =====================================
// SAFE LOCAL STORAGE HELPERS
// =====================================

function readStoredObject(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key);

    return value
      ? JSON.parse(value)
      : fallbackValue;

  } catch (error) {
    console.error(
      "Could not read " + key,
      error
    );

    return fallbackValue;
  }
}

function saveStoredObject(key, value) {
  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}

function getCurrentRide() {
  return readStoredObject(
    CURRENT_RIDE_KEY,
    null
  );
}

function saveCurrentRide(ride) {
  // Keep the current localStorage version
  saveStoredObject(
    CURRENT_RIDE_KEY,
    ride
  );

  // Also save the ride to Firebase
  function saveRideToCloud() {
    window.rudolfCloud
      .write(
        CURRENT_RIDE_KEY,
        ride
      )
      .then(function () {
        console.log(
          "Ride saved to Firebase"
        );
      })
      .catch(function (error) {
        console.error(
          "Firebase save failed:",
          error
        );
      });
  }

  if (window.rudolfCloud) {
    saveRideToCloud();
  } else {
    window.addEventListener(
      "rudolfCloudReady",
      saveRideToCloud,
      { once: true }
    );
  }
}

async function toggleDriverAvailability() {

  /*
   * Going Offline is ALWAYS allowed.
   */
  if (isOnline) {

    setDriverAvailabilityState(
      false
    );

    return;
  }


  /*
   * Going Online requires Admin account clearance.
   */
  let control;


  try {

    control =
      await readDriverAccountControl();

  } catch (error) {

    console.error(
      "Driver Online account check:",
      error
    );


    setDriverAvailabilityState(
      false
    );


    alert(
      "Unable to verify your Driver account status. " +
      "Please check your internet connection and try again."
    );

    return;
  }


  const state =
    getEffectiveDriverAccountControlState(
      control
    );


  if (
    state === "suspended" ||
    state === "blocked"
  ) {

    setDriverAvailabilityState(
      false
    );


    alert(
      getDriverRestrictionMessage(
        control
      )
    );


    return;
  }


  /*
   * Active Driver:
   * continue the existing Online + GPS flow.
   */
  setDriverAvailabilityState(
    true
  );
}

// =====================================
// DRIVER ONLINE / OFFLINE
// =====================================

function updateDriverAvailability() {
  const driverStatus =
    document.getElementById("driver-status");

  const availabilityButton =
    document.getElementById("availability-btn");

  const profileStatus =
    document.getElementById(
      "profile-driver-status"
    );

  const headerStatus =
    document.getElementById(
      "header-driver-status"
    );

  if (driverStatus) {
    driverStatus.textContent =
      isOnline
        ? "You're Online"
        : "You're Offline";
  }

  if (availabilityButton) {
    availabilityButton.textContent =
      isOnline
        ? "Go Offline"
        : "Go Online";
  }

  if (profileStatus) {
    profileStatus.textContent =
      isOnline ? "Online" : "Offline";
  }

  if (headerStatus) {
    headerStatus.textContent =
      isOnline ? "🟢 Online" : "🔴 Offline";
  }
}



// =====================================
// RIDE STATUS HELPERS
// =====================================

function isWaitingForDriver(status) {
  return (
    status === "Searching for driver" ||
    status === "Searching for driver..." ||
    status === "Finding a driver" ||
    status === "Finding a driver..."
  );
}

function isAccepted(status) {
  return (
    status === "Ride accepted" ||
    status === "Driver accepted your ride"
  );
}

function isCompleted(status) {
  return status === "Ride completed";
}

function isClosedRide(status) {
  return (
    isCompleted(status) ||
    status === "Ride declined" ||
    status === "Ride canceled" ||
    status === "Ride cancelled"
  );
}

function formatFare(value) {
  const number = Number(
    String(
      value === undefined ? 0 : value
    ).replace(/[^0-9.-]/g, "")
  );

  return (
    "GH₵ " +
    (
      Number.isFinite(number)
        ? number
        : 0
    ).toFixed(2)
  );
}

function getRideSignature(ride) {
  if (!ride) {
    return "no-ride";
  }

  return [
    ride.createdAt || "",
    ride.pickup || "",
    ride.destination || "",
    ride.fare || "",
    ride.status || ""
  ].join("|");
}

// =====================================
// RIDE REQUEST DISPLAY
// =====================================

function createRideButton(
  label,
  className,
  clickHandler
) {
  const button =
    document.createElement("button");

  button.type = "button";
  button.className = className;
  button.textContent = label;

  button.addEventListener(
    "click",
    clickHandler
  );

  return button;
}

function renderRideButtons(ride) {
  const buttonBox =
    document.querySelector(
      ".request-buttons"
    );

  if (!buttonBox) {
    return;
  }

  buttonBox.innerHTML = "";
  

  if (isWaitingForDriver(ride.status)) {
    
    
    buttonBox.appendChild( 
      createRideButton(
        "ACCEPT",
        "accept-btn",
        acceptRide
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "DECLINE",
        "decline-btn",
        declineRide
      )
    );

    return;
  }

  if (isAccepted(ride.status)) {
    buttonBox.appendChild(
      createRideButton(
        "START",
        "accept-btn",
        driverOnTheWay
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "CANCEL",
        "decline-btn",
        declineRide
      )
    );

    return;
  }

  if (
    ride.status ===
    "Driver is on the way"
  ) {
    buttonBox.appendChild(
      createRideButton(
        "ARRIVED",
        "accept-btn",
        arriveAtPickup
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "CANCEL",
        "decline-btn",
        declineRide
      )
    );

    return;
  }

  if (
    ride.status ===
    "Driver has arrived at pickup"
  ) {
    buttonBox.appendChild(
      createRideButton(
        "START TRIP",
        "accept-btn",
        startTrip
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "CANCEL",
        "decline-btn",
        declineRide
      )
    );

    return;
  }

  if (ride.status === "Trip started") {
    buttonBox.appendChild(
      createRideButton(
        "COMPLETE",
        "accept-btn",
        completeTrip
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "CANCEL",
        "decline-btn",
        declineRide
      )
    );
  }
}


function renderCurrentRide(ride) {
    if (!ride || typeof ride !== "object") {
    resetDriverForNextRide();
    return;
    }
  const rideStatus =
    document.getElementById("ride-status");

  const pickup =
    document.getElementById(
      "request-pickup"
    );

  const destination =
    document.getElementById(
      "request-destination"
    );

  const fare =
    document.getElementById(
      "request-fare"
    );
const rideType =
  document.getElementById(
    "request-type"
  );
  if (rideStatus) {
    const cancellationReason = ride.cancellationReason || ride.cancelReason || "";
    const passengerCancelled = ride.status === "Ride canceled" || ride.status === "Ride cancelled";
    if (passengerCancelled && cancellationReason) {
      rideStatus.textContent = ride.status + " — Reason: " + cancellationReason;
    } else {
      rideStatus.textContent = ride.status || "New ride request";
    }
  }
if (rideType) {
  rideType.textContent =
    ride.rideType ||
    "Rudolf Ride";
}
  if (pickup) {
    pickup.textContent =
      ride.pickup || "Not provided";
  }

  if (destination) {
    destination.textContent =
      ride.destination || "Not provided";
  }
  
  if (fare) {
    fare.textContent =
      formatFare(ride.fare);
  }
  if (ride.status !== "Ride declined") {
    renderRideButtons(ride);
  } else {
    const buttonBox = document.querySelector(".request-buttons");
    if (buttonBox) {
      buttonBox.innerHTML = "";
    }
  }

if (
  [
    "Ride accepted",
    "Driver accepted your ride",
    "Driver is on the way",
    "Driver has arrived at pickup",
    "Trip started"
  ].includes(ride.status) &&
  driverLocationWatchId === null
) {
  startDriverLiveLocation();
}
  
}

function resetDriverForNextRide(message) {
  const rideStatus =
    document.getElementById("ride-status");

  const pickup =
    document.getElementById(
      "request-pickup"
    );

  const destination =
    document.getElementById(
      "request-destination"
    );

  const fare =
    document.getElementById(
      "request-fare"
    );

  const buttonBox =
    document.querySelector(
      ".request-buttons"
    );
if (rideStatus) {
  rideStatus.textContent =
    message || "Waiting for ride request";
}

  if (pickup) {
    pickup.textContent =
      "Waiting for request...";
  }

  if (destination) {
    destination.textContent =
      "Waiting for request...";
  }

  if (fare) {
    fare.textContent = "GH₵ 0.00";
  }

  if (buttonBox) {
    buttonBox.innerHTML = "";
  }
}


function loadCurrentRide() {
  const ride = getCurrentRide();

  if (
    !ride ||
    isClosedRide(ride.status)
  ) {
    const emptySignature = ride
      ? "closed|" +
        getRideSignature(ride)
      : "no-ride";

    if (
      lastRideSignature !==
      emptySignature
    ) {
      resetDriverForNextRide();

      lastRideSignature =
        emptySignature;
    }

    return;
  }

  if (
    isWaitingForDriver(ride.status) &&
    !isOnline
  ) {
    if (
      lastRideSignature !==
      "offline-waiting"
    ) {
      resetDriverForNextRide(
        "Go online to receive ride requests."
      );

      lastRideSignature =
        "offline-waiting";
    }

    return;
  }

  const signature =
    getRideSignature(ride);

  if (
    signature !== lastRideSignature
  ) {
    renderCurrentRide(ride);
    lastRideSignature = signature;
  }
}

// ===============================
// RECEIVE RIDES FROM FIREBASE
// ===============================

let stopCloudRideListener = null;

function startCloudRideListener() {
  if (
    !window.rudolfCloud ||
    stopCloudRideListener
  ) {
    return;
  }

  stopCloudRideListener =
    window.rudolfCloud.listen(
      CURRENT_RIDE_KEY,
      function (ride) {
        if (!ride) {
          stopRideRingtone();
          return;
        }

        /*
         * PASSENGER CANCELLATION SYNC
         * If Phone 1 cancels the active ride,
         * immediately clear/reset Phone 2.
         */
        if (
          ride.status === "Ride canceled" ||
          ride.status === "Ride cancelled"
        ) {
          stopRideRingtone();
          stopDriverLiveLocation();

          /*
           * 3R DRS-D — CANCELLATION OWNERSHIP GUARD
           *
           * A passenger cancellation belongs in Driver history
           * only when this Driver had already accepted/owned
           * the same ride.
           *
           * This prevents:
           * Driver offline -> passenger books -> passenger cancels
           * from creating a Driver cancellation receipt.
           */
          const localRideBeforeCancel =
            getCurrentRide();

          const sameRideAsLocal =
            !!localRideBeforeCancel &&
            (
              (
                ride.rideId &&
                localRideBeforeCancel.rideId &&
                String(ride.rideId) ===
                  String(localRideBeforeCancel.rideId)
              ) ||
              (
                ride.createdAt &&
                localRideBeforeCancel.createdAt &&
                String(ride.createdAt) ===
                  String(localRideBeforeCancel.createdAt)
              ) ||
              (
                !ride.rideId &&
                !localRideBeforeCancel.rideId &&
                !ride.createdAt &&
                !localRideBeforeCancel.createdAt &&
                String(ride.pickup || "") ===
                  String(localRideBeforeCancel.pickup || "") &&
                String(ride.destination || "") ===
                  String(localRideBeforeCancel.destination || "") &&
                String(ride.fare || "") ===
                  String(localRideBeforeCancel.fare || "")
              )
            );

          const incomingRideHasDriver =
            !!(
              ride.driver &&
              typeof ride.driver === "object" &&
              Object.keys(ride.driver).length > 0
            );

          const localRideWasDriverOwned =
            sameRideAsLocal &&
            (
              (
                localRideBeforeCancel.driver &&
                typeof localRideBeforeCancel.driver === "object" &&
                Object.keys(
                  localRideBeforeCancel.driver
                ).length > 0
              ) ||
              [
                "Ride accepted",
                "Driver accepted your ride",
                "Driver is on the way",
                "Driver has arrived at pickup",
                "Trip started"
              ].includes(
                localRideBeforeCancel.status
              )
            );

          const driverOwnedCancellation =
            incomingRideHasDriver ||
            localRideWasDriverOwned;

          if (!driverOwnedCancellation) {
            localStorage.removeItem(
              CURRENT_RIDE_KEY
            );

            lastRideSignature =
              "closed|" +
              getRideSignature(ride);

            resetDriverForNextRide();

            console.log(
              "3R DRS-D: ignored cancellation for unaccepted ride"
            );

            return;
          }

          // 3R-DPS-B — preserve passenger cancellation
          try {
            const isNewPassengerCancellation =
              savePassengerCancelledRideHistory(ride);

            renderDriverRides();

            // Show once only for a newly saved passenger cancellation.
            if (isNewPassengerCancellation) {
              showPassengerCancellationPopup(ride);
            }
          } catch (error) {
            console.error(
              "Passenger cancellation history save failed:",
              error
            );
          }

          saveStoredObject(
            CURRENT_RIDE_KEY,
            ride
          );

          lastRideSignature =
            "closed|" + getRideSignature(ride);

          renderCurrentRide(ride);

          setTimeout(function () {
            localStorage.removeItem(
              CURRENT_RIDE_KEY
            );

            lastRideSignature = null;
            resetDriverForNextRide();
          }, 1500);

          return;
        }

        // Ring only for a new ride waiting for the driver
        if (
          ride.status === "Searching for driver" &&
          isOnline
        ) {
          playRideRingtone();
        } else {
          stopRideRingtone();
        }

        // Keep a local copy for the existing app
        saveStoredObject(
  CURRENT_RIDE_KEY,
  ride
);

lastRideSignature = null;
loadCurrentRide();
      

      
      }
    );

  console.log(
    "Driver listening for Firebase rides"
  );
}

if (window.rudolfCloud) {
  startCloudRideListener();
} else {
  window.addEventListener(
    "rudolfCloudReady",
    startCloudRideListener,
    { once: true }
  );
}

// =====================================
// DRIVER RIDE ACTIONS
// =====================================
function changeRideStatus(newStatus) {
  const ride = getCurrentRide();

  if (!ride) {
    alert("There is no active ride.");
    return null;
  }

  ride.status = newStatus;
  ride.updatedAt = Date.now();

  if (newStatus === "Driver accepted your ride") {

    const driverProfile = JSON.parse(
      localStorage.getItem("rudolfDriverProfile") || "{}"
    );

    ride.driver = {
      name: driverProfile.name || "Rudolf",
      vehicle: driverProfile.vehicle || "Toyota Corolla",
      plate: driverProfile.plate || "GR 12345",
      rating: 4.8,
      photoUrl: driverProfile.photoUrl || "",
      phone: localStorage.getItem("rudolfDriverContactPhone") || ""
    };

  }

  saveCurrentRide(ride);

  stopDriverLiveLocation();

  lastRideSignature = "";

  loadCurrentRide();

  return ride;
}

function acceptRide() {
  if (!isOnline) {
    alert(
      "Please go online before accepting a ride."
    );

    return;
  }

  const ride = changeRideStatus(
    "Driver accepted your ride"
  );

  if (ride) {
    startDriverLiveLocation();
  }
}

function declineRide() {
  const ride = getCurrentRide();

  if (!ride) {
    alert("There is no active ride.");
    return;
  }

  ride.status = "Ride declined";
  ride.updatedAt = Date.now();

  saveCurrentRide(ride);

  // 3R ADDITIVE — history failure must never interrupt decline.
  try {
    saveDeclinedRideHistory(ride);
    renderDriverRides();
  } catch (error) {
    console.error(
      "Declined ride history save failed:",
      error
    );
  }

  const rideStatus =
    document.getElementById(
      "ride-status"
    );

  const buttonBox =
    document.querySelector(
      ".request-buttons"
    );

  if (rideStatus) {
    rideStatus.textContent =
      "Ride declined";
  }

  if (buttonBox) {
    buttonBox.innerHTML = "";
  }

  lastRideSignature =
    "closed|" +
    getRideSignature(ride);

  setTimeout(function () {
    resetDriverForNextRide();
  }, 1500);
}

function driverOnTheWay() {
  changeRideStatus(
    "Driver is on the way"
  );
}

function arriveAtPickup() {
  changeRideStatus(
    "Driver has arrived at pickup"
  );
}

function startTrip() {
  changeRideStatus("Trip started");
}


// 3R RECEIPT START — display existing completed-ride data only
function showCompletedRideReceipt(ride) {
  const receiptId = "rudolf-completed-ride-receipt";
  if (document.getElementById(receiptId)) return;

  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.id = receiptId;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", receiptId + "-title");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:100000;overflow:auto;display:flex;flex-direction:column;" +
    "box-sizing:border-box;background:#f0f5f4;color:#172b26;" +
    "padding:8px;padding-top:max(8px,env(safe-area-inset-top));" +
    "padding-bottom:max(8px,env(safe-area-inset-bottom));" +
    "font:700 15px/1.3 system-ui,sans-serif;overscroll-behavior:contain;";

  const card = document.createElement("div");
  card.style.cssText =
    "box-sizing:border-box;width:100%;max-width:440px;margin:0 auto;flex:1 0 auto;display:flex;flex-direction:column;" +
    "padding:14px;background:white;border-radius:16px;" +
    "box-shadow:0 8px 30px #123b2318;overflow-wrap:anywhere;";
  overlay.appendChild(card);

  function text(tag, value, css) {
    const el = document.createElement(tag);
    el.textContent = value;
    el.style.cssText = css || "";
    card.appendChild(el);
    return el;
  }

  function row(label, value) {
    const line = document.createElement("div");
    line.style.cssText =
      "display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:center;padding:10px 0;flex:1 0 auto;border-bottom:1px solid #e5ece9;";
    const title = document.createElement("div");
    title.textContent = label;
    title.style.cssText = "font-size:14px;font-weight:700;color:#172b26;";
    const detail = document.createElement("div");
    detail.textContent =
      value === undefined || value === null || value === ""
        ? "Not available" : String(value);
    detail.style.cssText = "min-width:0;font-size:15px;font-weight:700;";
    line.appendChild(title);
    line.appendChild(detail);
    card.appendChild(line);
  }

  function money(value) {
    if (value === undefined || value === null || value === "") {
      return "Not available";
    }
    const amount = Number(value);
    return Number.isFinite(amount)
      ? "GH₵ " + amount.toFixed(2) : "Not available";
  }

  text("div", "RUDOLF RIDE",
    "color:#13754b;font-weight:800;letter-spacing:2px;");
  const heading = text("h2", "Trip receipt",
    "margin:4px 0;font-size:23px;font-weight:800;color:#172b26;");
  heading.id = receiptId + "-title";
  text("p", "✓ Trip completed",
    "margin:0 0 8px;color:#13754b;font-weight:700;");

  row("Completed", ride.completedDateTime);
  row("Trip ID", ride.rideId);
  row("Pickup", ride.pickup);
  row("Destination", ride.destination);
  row("Ride type", ride.rideType);
  row("Total fare", money(ride.totalFare));
  row("Platform fee (15%)", money(ride.platformFee));

  text("div", "Total fare",
    "margin-top:10px;color:#13754b;font-weight:700;");
  text("div", money(ride.totalFare),
    "font-size:28px;font-weight:800;color:#13754b;");
  text("p", "Trip details saved in Ride History.",
    "font-size:14px;font-weight:700;color:#172b26;margin:6px 0 10px;");

  const done = text("button", "DONE",
    "display:block;position:static;width:100%;min-height:44px;margin-top:10px;flex-shrink:0;" +
    "border:0;border-radius:12px;background:#13754b;color:white;" +
    "font:700 16px system-ui;cursor:pointer;padding:10px;");
  done.type = "button";

  function closeReceipt() {
    overlay.remove();
    if (previousFocus && previousFocus.isConnected) {
      previousFocus.focus();
    }
  }

  done.addEventListener("click", closeReceipt);
  overlay.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeReceipt();
    } else if (event.key === "Tab") {
      event.preventDefault();
      done.focus();
    }
  });

  document.body.appendChild(overlay);
  done.focus({ preventScroll: true });
}
// 3R RECEIPT END

function completeTrip() {
  const ride = getCurrentRide();

  if (!ride) {
    alert("There is no active ride.");
    return;
  }

  const completedAt =
    new Date().toISOString();

  ride.status = "Ride completed";
  ride.completedAt = completedAt;

  ride.completedDateTime =
    new Date(
      completedAt
    ).toLocaleString();

  ride.rideId =
    ride.rideId ||
    ride.createdAt ||
    "ride-" + Date.now();

  // =====================================
  // RUDOLF RIDE COMMISSION — 15%
  // Driver receives 85%
  // =====================================

  const totalFare =
    Number(ride.fare) || 0;

  const platformFee =
    Number((totalFare * 0.15).toFixed(2));

  const driverEarnings =
    Number((totalFare - platformFee).toFixed(2));

  // Save money breakdown with completed ride
  ride.totalFare = totalFare;
  ride.platformFee = platformFee;
  ride.driverEarnings = driverEarnings;
  ride.commissionRate = 15;

  // Save ride first.
  // Earnings are credited only if this is a NEW ride.
  // 3R TEMP DIAGNOSTIC — completed-history flight recorder
  console.log(
    "3R COMPLETE BEFORE SAVE:",
    JSON.stringify(ride),
    "HISTORY:",
    localStorage.getItem(DRIVER_RIDES_KEY)
  );

  const isNewCompletedRide =
    saveCompletedRide(ride);

  console.log(
    "3R COMPLETE AFTER SAVE:",
    "NEW:",
    isNewCompletedRide,
    "HISTORY:",
    localStorage.getItem(DRIVER_RIDES_KEY)
  );

  if (isNewCompletedRide) {
    let todayEarnings =
      Number(
        localStorage.getItem(
          "rudolfDriverEarnings"
        )
      ) || 0;

    todayEarnings += driverEarnings;

    localStorage.setItem(
      "rudolfDriverEarnings",
      todayEarnings
    );
  }

// SEND COMPLETED STATUS TO PASSENGER FIRST
saveCurrentRide(ride);

window.rudolfCloud.write(
  CURRENT_RIDE_KEY,
  ride
);

  // 3R: receipt failure must not interrupt trip cleanup.
  try {
    showCompletedRideReceipt(ride);
  } catch (error) {
    console.error("Receipt display failed:", error);
  }

  // Clear after passenger receives completed status
  setTimeout(function () {

    localStorage.removeItem(
      CURRENT_RIDE_KEY
    );

    window.rudolfCloud.write(
      CURRENT_RIDE_KEY,
      null
    );

    // Current ride is now cleared.
    // Reset driver for the next request.
    lastRideSignature = null;
    resetDriverForNextRide();

    // Refresh figures from completed ride data.
    renderDriverRides();
    loadTodayActivity();

    if (typeof renderDriverWallet === "function") {
      renderDriverWallet();
    }

  }, 3000);
  lastRideSignature = null;
loadCurrentRide();

renderDriverRides();

/*
 * Refresh all earnings immediately after trip completion.
 * No browser refresh should be required.
 */
loadTodayActivity();

if (typeof renderDriverWallet === "function") {
  renderDriverWallet();
}

  const rideStatus =
    document.getElementById(
      "ride-status"
    );

  if (rideStatus) {
    rideStatus.textContent =
      "Ride completed";
  }

  const buttonBox =
    document.querySelector(
      ".request-buttons"
    );

  if (buttonBox) {
    buttonBox.innerHTML = "";
  }

  lastRideSignature =
    "closed|" +
    getRideSignature(ride);

}

// =====================================
// COMPLETED RIDES AND TODAY'S ACTIVITY
// =====================================

function getDriverRides() {
  const rides = readStoredObject(
    DRIVER_RIDES_KEY,
    []
  );

  return Array.isArray(rides)
    ? rides
    : [];
}

function saveCompletedRide(ride) {
  const rides = getDriverRides();

  const existingIndex =
    rides.findIndex(function (savedRide) {
      if (
        savedRide.rideId &&
        ride.rideId
      ) {
        return (
          String(savedRide.rideId) ===
          String(ride.rideId)
        );
      }

      return Boolean(
        savedRide.createdAt &&
        ride.createdAt &&
        String(savedRide.createdAt) ===
        String(ride.createdAt)
      );
    });

  if (existingIndex !== -1) {
    rides[existingIndex] = ride;

    saveStoredObject(
      DRIVER_RIDES_KEY,
      rides
    );

    return false;
  }

  rides.push(ride);

  saveStoredObject(
    DRIVER_RIDES_KEY,
    rides
  );

  return true;
}

function isDateToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() ===
      today.getFullYear() &&

    date.getMonth() ===
      today.getMonth() &&

    date.getDate() ===
      today.getDate()
  );
}

function loadTodayActivity() {
  const rides = getDriverRides();

  /*
   * Today's rides:
   * use the best available ride timestamp.
   */
  const todayRides = rides.filter(function (ride) {
    return isDateToday(
      ride.completedAt ||
      ride.completedDateTime ||
      ride.completedDate ||
      ride.updatedAt ||
      ride.createdAt ||
      ride.date
    );
  });

  /*
   * Only completed rides count toward earnings.
   */
  const completedRides = todayRides.filter(function (ride) {
    return ride.status === "Ride completed";
  });

  /*
   * Calculate DRIVER earnings using the exact
   * same 15% platform / 85% driver logic as Wallet.
   */
  const totalEarnings = completedRides.reduce(
    function (total, ride) {
      const fare =
        Number(
          ride.totalFare !== undefined
            ? ride.totalFare
            : ride.fare
        ) || 0;

      const platformFee =
        Number(
          ride.platformFee !== undefined
            ? ride.platformFee
            : (fare * 0.15)
        ) || 0;

      const driverEarnings =
        Number(
          ride.driverEarnings !== undefined
            ? ride.driverEarnings
            : (fare - platformFee)
        ) || 0;

      return total + driverEarnings;
    },
    0
  );

  const ridesElement =
    document.getElementById("today-rides");

  const completedElement =
    document.getElementById("today-completed");

  const earningsElement =
    document.getElementById("today-earnings");

  if (ridesElement) {
    ridesElement.textContent = todayRides.length;
  }

  if (completedElement) {
    completedElement.textContent = completedRides.length;
  }

  if (earningsElement) {
    earningsElement.textContent =
      "GH₵ " + totalEarnings.toFixed(2);
  }
}
function addRideDetail(
  card,
  label,
  value
) {
  const line =
    document.createElement("p");

  const strong =
    document.createElement("strong");

  strong.textContent = label + ": ";

  line.appendChild(strong);

  line.appendChild(
    document.createTextNode(value)
  );

  card.appendChild(line);
}

function renderDriverRides() {
  const list =
    document.getElementById(
      "driver-rides-list"
    );

  if (!list) {
    return;
  }

  const rides =
    getDriverRides()
      .slice()
      .reverse();

  list.innerHTML = "";

  if (rides.length === 0) {
    const emptyBox =
      document.createElement("div");

    emptyBox.id = "rides-list";
    emptyBox.className = "empty-rides";

    const title =
      document.createElement("h3");

    title.textContent = "No ride yet";

    const text =
      document.createElement("p");

    text.textContent =
      "Your completed rides will appear here.";

    emptyBox.appendChild(title);
    emptyBox.appendChild(text);
    list.appendChild(emptyBox);

    return;
  }

  rides.forEach(function (ride) {
    const card =
      document.createElement("article");

    card.className =
      "ride-history-card ride-card";

    const title =
      document.createElement("h3");

    title.textContent =
      (ride.pickup || "Pickup") +
      " → " +
      (
        ride.destination ||
        "Destination"
      );

    card.appendChild(title);

    addRideDetail(
      card,
      "Ride",
      ride.selectedRide ||
      ride.rideType ||
      "Rudolf Ride"
    );

    addRideDetail(
      card,
      "Fare",
      formatFare(ride.fare)
    );

    addRideDetail(
      card,
      "Status",
      ride.status || "Ride completed"
    );

    const dateValue =
      ride.completedAt ||
      ride.completedDate ||
      ride.date ||
      ride.createdAt ||
      ride.updatedAt;

    const date = new Date(dateValue);

    const dateText =
      Number.isNaN(date.getTime())
        ? (
            ride.completedDateTime ||
            "Date unavailable"
          )
        : date.toLocaleString();

    addRideDetail(
      card,
      "Date",
      dateText
    );

    const detailsButton =
      document.createElement("button");

    detailsButton.type = "button";
    detailsButton.className =
      "ride-view-details-btn";

    detailsButton.textContent =
      "View Details";

    const rideDetailsId =
      ride.rideId ||
      ride.createdAt ||
      "";

    detailsButton.addEventListener(
      "click",
      function () {
        openDriverRideDetails(
          rideDetailsId
        );
      }
    );

    card.appendChild(detailsButton);

    list.appendChild(card);
  });
}

// =====================================
// DRIVER LIVE GPS
// =====================================


function stopDriverLiveLocation() {
  if (
    driverLocationWatchId !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(
      driverLocationWatchId
    );

    driverLocationWatchId = null;
  }

  const gpsStatus =
    document.getElementById(
      "driver-gps-status"
    );

  if (gpsStatus && !isOnline) {
    gpsStatus.textContent =
      "GPS paused while driver is offline.";
  }
}

function showDriverLocationMap(
  latitude,
  longitude,
  accuracy
) {
  const mapBox =
    document.getElementById(
      "driver-location-map"
    );

  if (!mapBox) {
    return;
  }

  if (typeof L === "undefined") {
    const gpsStatus =
      document.getElementById(
        "driver-gps-status"
      );

    if (gpsStatus) {
      gpsStatus.textContent =
        "GPS is active, but the map could not load.";
    }

    return;
  }

  mapBox.style.display = "block";
  mapBox.style.minHeight = "280px";

  const location = [
    Number(latitude),
    Number(longitude)
  ];

  if (driverLocationMap) {
    /*
     * Follow the driver smoothly unless the driver
     * manually drags the map.
     */
    if (driverMapFollow) {
      driverLocationMap.panTo(
        location,
        {
          animate: true,
          duration: 0.5
        }
      );
    }

    driverLocationMarker.setLatLng(
      location
    );

    if (driverAccuracyCircle) {
      driverAccuracyCircle.setLatLng(
        location
      );

      driverAccuracyCircle.setRadius(
        Math.max(
          5,
          Number(accuracy) || 5
        )
      );
    }

    driverLocationMap.invalidateSize();

    return;
  }

  const streetMap = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,

      attribution:
        "© OpenStreetMap contributors"
    }
  );

  const satelliteMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles © Esri"
    }
  );

  driverLocationMap = L.map(
    "driver-location-map",
    {
      center: location,
      zoom: 17,
      layers: [streetMap]
    }
  );

  driverLocationMarker =
    L.marker(location)
      .addTo(driverLocationMap)
      .bindPopup(
        "Your live driver location"
      );

  /*
   * Accuracy circle gives the driver a modern visual
   * indication of GPS precision.
   */
  driverAccuracyCircle =
    L.circle(
      location,
      {
        radius: Math.max(
          5,
          Number(accuracy) || 5
        ),
        weight: 1,
        fillOpacity: 0.08
      }
    ).addTo(driverLocationMap);

  /*
   * Manual dragging disables automatic map following.
   * The Re-center button restores following.
   */
  driverLocationMap.on(
    "dragstart",
    function () {
      driverMapFollow = false;
    }
  );

  L.control.layers(
    {
      "Street Map": streetMap,
      "Satellite": satelliteMap
    }
  ).addTo(driverLocationMap);

  L.control.scale(
    {
      imperial: false,
      position: "bottomleft"
    }
  ).addTo(driverLocationMap);

  setTimeout(function () {
    driverLocationMap.invalidateSize();
  }, 150);
}

function recenterDriverMap() {
  const gpsStatus =
    document.getElementById(
      "driver-gps-status"
    );

  /*
   * If Online and the watcher previously stopped
   * because of a GPS error, safely retry it.
   */
  if (
    isOnline &&
    driverLocationWatchId === null
  ) {
    startDriverLiveLocation();
  }

  const storedLocation =
    driverLastKnownLocation ||
    readStoredObject(
      DRIVER_LOCATION_KEY,
      null
    );

  if (
    !storedLocation ||
    !Number.isFinite(
      Number(storedLocation.latitude)
    ) ||
    !Number.isFinite(
      Number(storedLocation.longitude)
    )
  ) {
    /*
     * Do not manually start GPS while Offline.
     */
    if (
      gpsStatus &&
      !isOnline
    ) {
      gpsStatus.textContent =
        "GPS paused while driver is offline.";
    }

    return;
  }

  driverMapFollow = true;

  showDriverLocationMap(
    Number(storedLocation.latitude),
    Number(storedLocation.longitude),
    Number(
      storedLocation.accuracy || 0
    )
  );

  if (driverLocationMap) {
    driverLocationMap.setView(
      [
        Number(storedLocation.latitude),
        Number(storedLocation.longitude)
      ],
      17,
      {
        animate: true
      }
    );
  }
}



/* =========================================
   3R DRS-D-CDA — PASSENGER PICKUP MARKER

   READ ONLY:
   pickupLatitude
   pickupLongitude

   DOES NOT MODIFY:
   Driver GPS
   Driver map follow
   Driver availability
   Verification
   Live Security
   Popup / ringtone
   Messaging
   ========================================= */

function clearPassengerPickupMarker() {

  if (
    passengerPickupMarker &&
    driverLocationMap
  ) {

    try {

      driverLocationMap.removeLayer(
        passengerPickupMarker
      );

    } catch (error) {

      console.error(
        "Passenger pickup marker clear:",
        error
      );
    }
  }

  passengerPickupMarker = null;
}


function syncPassengerPickupMarker(ride) {

  const status =
    String(
      ride && ride.status
        ? ride.status
        : ""
    ).trim();


  const markerStatuses =
    new Set([
      "Ride accepted",
      "Driver accepted your ride",
      "Driver is on the way",
      "Driver has arrived at pickup"
    ]);


  if (
    !ride ||
    !markerStatuses.has(status)
  ) {

    clearPassengerPickupMarker();

    return;
  }


  const latitude =
    Number(
      ride.pickupLatitude
    );

  const longitude =
    Number(
      ride.pickupLongitude
    );


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {

    clearPassengerPickupMarker();

    return;
  }


  if (
    !driverLocationMap ||
    typeof L === "undefined"
  ) {

    return;
  }


  const pickupLocation = [
    latitude,
    longitude
  ];


  if (passengerPickupMarker) {

    passengerPickupMarker.setLatLng(
      pickupLocation
    );

    return;
  }


  const passengerPickupIcon =
    L.divIcon({

      className:
        "rudolf-passenger-pickup-icon",

      html:
        '<div class="rudolf-passenger-pickup-pin">' +
          '<div class="rudolf-passenger-pickup-dot">' +
            '👤' +
          '</div>' +
        '</div>',

      iconSize: [
        48,
        56
      ],

      iconAnchor: [
        24,
        54
      ],

      popupAnchor: [
        0,
        -50
      ]
    });


  passengerPickupMarker =
    L.marker(
      pickupLocation,
      {
        icon:
          passengerPickupIcon,

        title:
          "Passenger pickup"
      }
    )
      .addTo(
        driverLocationMap
      )
      .bindPopup(
        "<strong>📍 Passenger Pickup</strong>"
      );
}


function startDriverLiveLocation() {
  const gpsStatus =
    document.getElementById(
      "driver-gps-status"
    );

  /*
   * Absolute 3R rule:
   * Offline means GPS stays paused.
   */
  if (!isOnline) {
    if (gpsStatus) {
      gpsStatus.textContent =
        "GPS paused while driver is offline.";
    }

    return;
  }

  if (!navigator.geolocation) {
    if (gpsStatus) {
      gpsStatus.textContent =
        "GPS is not supported on this device.";
    }

    alert(
      "GPS is not supported on this device."
    );

    return;
  }

  /*
   * Protected single-watcher rule.
   * If tracking already exists, reuse it.
   */
  if (driverLocationWatchId !== null) {
    if (gpsStatus) {
      gpsStatus.textContent =
        "GPS active • Live tracking running";
    }

    return;
  }

  if (gpsStatus) {
    gpsStatus.textContent =
      "Connecting to GPS...";
  }

  driverLocationWatchId =
    navigator.geolocation.watchPosition(
      function (position) {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const accuracy =
          Number(
            position.coords.accuracy ||
            0
          );

        const heading =
          Number.isFinite(
            position.coords.heading
          )
            ? position.coords.heading
            : null;

        const speed =
          Number.isFinite(
            position.coords.speed
          ) &&
          position.coords.speed >= 0
            ? position.coords.speed
            : null;

        const driverLocation = {
          latitude: latitude,
          longitude: longitude,
          accuracy: accuracy,
          heading: heading,
          speed: speed,
          updatedAt: Date.now()
        };

        driverLastKnownLocation =
          driverLocation;

        saveStoredObject(
          DRIVER_LOCATION_KEY,
          driverLocation
        );

        if (window.rudolfCloud) {
          window.rudolfCloud
            .write(
              "liveDriverLocation",
              driverLocation
            )
            .catch(function (error) {
              console.error(
                "Driver cloud location error:",
                error
              );
            });
        }

        if (gpsStatus) {
          const gpsParts = [
            "GPS active"
          ];

          if (accuracy > 0) {
            gpsParts.push(
              "±" +
              Math.round(accuracy) +
              " m"
            );
          }

          if (speed !== null) {
            gpsParts.push(
              Math.round(
                speed * 3.6
              ) +
              " km/h"
            );
          }

          if (heading !== null) {
            gpsParts.push(
              Math.round(heading) +
              "° heading"
            );
          }

          gpsStatus.textContent =
            gpsParts.join(" • ");
        }

        showDriverLocationMap(
          latitude,
          longitude,
          accuracy
        );

        syncPassengerPickupMarker(
          getCurrentRide()
        );
      },

      function (error) {
        /*
         * Permission denial is fatal.
         * Temporary timeout/unavailable errors keep
         * the same watcher so Android can recover.
         */
        if (
          error.code === 1 &&
          driverLocationWatchId !== null &&
          navigator.geolocation
        ) {
          navigator.geolocation.clearWatch(
            driverLocationWatchId
          );

          driverLocationWatchId = null;
        }

        if (gpsStatus) {
          gpsStatus.textContent =
            "Driver GPS error: " +
            error.message;
        }

        /*
         * Avoid repeated alert storms for temporary
         * GPS timeout/unavailable events.
         */
        if (error.code === 1) {
          alert(
            "Driver GPS permission is required " +
            "while the driver is Online."
          );
        }
      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
}

// =====================================
// DRIVER PAGE NAVIGATION
// =====================================

// =====================================
// 3R DRS-D — DRIVER VERIFICATION VIEW
// Profile launcher -> verification details
// =====================================

let driverVerificationStatusObserver = null;

function syncDriverVerificationProfileStatus() {

  const source =
    document.getElementById(
      "driver-verification-status"
    );

  const mirror =
    document.getElementById(
      "driver-verification-profile-status"
    );

  if (!source || !mirror) {
    return;
  }

  mirror.textContent =
    source.textContent;

  mirror.className =
    source.className;
}


function initDriverVerificationStatusMirror() {

  const source =
    document.getElementById(
      "driver-verification-status"
    );

  if (!source) {
    return;
  }

  syncDriverVerificationProfileStatus();

  if (
    driverVerificationStatusObserver ||
    typeof MutationObserver === "undefined"
  ) {
    return;
  }

  driverVerificationStatusObserver =
    new MutationObserver(
      syncDriverVerificationProfileStatus
    );

  driverVerificationStatusObserver.observe(
    source,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    }
  );
}


function openDriverVerification() {

  const profileMain =
    document.getElementById(
      "driver-profile-main-view"
    );

  const verificationView =
    document.getElementById(
      "driver-verification-view"
    );

  if (profileMain) {
    profileMain.style.display = "none";
  }

  if (verificationView) {
    verificationView.style.display = "block";
  }

  initDriverVerificationStatusMirror();

  window.scrollTo(
    {
      top: 0,
      behavior: "smooth"
    }
  );
}


function closeDriverVerification() {

  const profileMain =
    document.getElementById(
      "driver-profile-main-view"
    );

  const verificationView =
    document.getElementById(
      "driver-verification-view"
    );

  if (verificationView) {
    verificationView.style.display = "none";
  }

  if (profileMain) {
    profileMain.style.display = "block";
  }

  syncDriverVerificationProfileStatus();

  window.scrollTo(
    {
      top: 0,
      behavior: "smooth"
    }
  );
}


function resetDriverProfileView() {

  const profileMain =
    document.getElementById(
      "driver-profile-main-view"
    );

  const verificationView =
    document.getElementById(
      "driver-verification-view"
    );

  if (profileMain) {
    profileMain.style.display = "block";
  }

  if (verificationView) {
    verificationView.style.display = "none";
  }

  initDriverVerificationStatusMirror();
}


window.openDriverVerification =
  openDriverVerification;

window.closeDriverVerification =
  closeDriverVerification;


if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initDriverVerificationStatusMirror
  );

} else {

  initDriverVerificationStatusMirror();
}


// =====================================
// DRIVER PAGE NAVIGATION
// =====================================
function showDriverSection(section) {

  if (section === "profile") {
    resetDriverProfileView();
  }

  const homeSection =
    document.getElementById(
      "driver-home-section"
    );

  const ridesSection =
    document.getElementById(
      "driver-rides-section"
    );

  const profileSection =
    document.getElementById(
      "driver-profile-section"
    );

  const walletSection =
    document.getElementById(
      "driver-wallet-section"
    );

  const messagesSection =
    document.getElementById(
      "driver-messages-section"
    );

  const withdrawSection =
    document.getElementById(
      "driver-withdraw-section"
    );

  const withdrawReviewSection =
    document.getElementById(
      "driver-withdraw-review-section"
    );

  const navItems =
    document.querySelectorAll(
      ".driver-bottom-nav .nav-item"
    );

  if (homeSection) {
    homeSection.style.setProperty(
      "display",
      section === "home" ? "grid" : "none",
      "important"
    );
  }

  if (ridesSection) {
    ridesSection.style.display =
      section === "rides"
        ? "block"
        : "none";
  }

  if (profileSection) {
    profileSection.style.display =
      section === "profile"
        ? "block"
        : "none";
  }

  if (walletSection) {
    walletSection.style.display =
      section === "wallet"
        ? "block"
        : "none";
  }

  if (messagesSection) {
    messagesSection.style.display =
      section === "messages"
        ? "block"
        : "none";
  }

  if (withdrawSection) {
    withdrawSection.style.display =
      section === "withdraw"
        ? "block"
        : "none";
  }

  if (withdrawReviewSection) {
    withdrawReviewSection.style.display =
      section === "withdraw-review"
        ? "block"
        : "none";
  }

  const sectionOrder = [
    "home",
    "rides",
    "profile",
    "wallet"
  ];

  navItems.forEach(
    function (item, index) {
      item.classList.toggle(
        "active",
        sectionOrder[index] === section
      );
    }
  );

  if (section === "rides") {
    renderDriverRides();
  }

  if (section === "wallet") {
    renderDriverWallet();
  }

  if (section === "withdraw") {
    renderWithdrawBalance();
  }

  if (
    section === "home" &&
    driverLocationMap
  ) {
    setTimeout(function () {
      driverLocationMap.invalidateSize();
    }, 150);
  }
}


// =====================================
// START DRIVER APP
// =====================================

function initializeDriverApp() {
  const availabilityButton =
    document.getElementById(
      "availability-btn"
    );

  if (availabilityButton) {
    availabilityButton.addEventListener(
      "click",
      toggleDriverAvailability
    );
  }

  updateDriverAvailability();
  renderDriverRides();
  loadTodayActivity();
  loadCurrentRide();

  /*
   * 3R DRS-D ACCOUNT + GPS STARTUP:
   *
   * Verify Admin account control first.
   * Only an Active Driver may resume Online GPS.
   */
  initializeDriverAccountControlEnforcement();

  setInterval(
    loadCurrentRide,
    1000
  );

  setInterval(
    loadTodayActivity,
    60000
  );
}


// HTML BUTTON CONNECTIONS
window.startDriverLiveLocation =
  startDriverLiveLocation;

window.recenterDriverMap =
  recenterDriverMap;

window.toggleDriverAvailability =
  toggleDriverAvailability;

window.showDriverSection =
  showDriverSection;


if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeDriverApp
  );

} else {
  initializeDriverApp();
}

// =====================================
// FIREBASE RIDE LISTENER
// =====================================
function startDriverCloudRideListener() {

  if (
    !window.rudolfCloud ||
    typeof window.rudolfCloud.listen !== "function"
  ) {
    setTimeout(
      startDriverCloudRideListener,
      500
    );
    return;
  }

  window.rudolfCloud.listen(
    "rudolfCurrentRide",
    function(cloudRide) {

      console.log(
        "FIREBASE RIDE RECEIVED:",
        cloudRide
      );

      if (
        !cloudRide ||
        typeof cloudRide !== "object"
      ) {
        return;
      }

      localStorage.setItem(
        CURRENT_RIDE_KEY,
        JSON.stringify(cloudRide)
      );

      lastRideSignature = null;

      loadCurrentRide();

    }
  );

  console.log(
    "Driver Firebase ride listener started"
  );
}

//startDriverCloudRideListener();
/* =====================================
   RUDOLF RIDE — NEW RIDE RINGTONE
===================================== */

const rideRingtone = new Audio("old-bell.mp3");
rideRingtone.loop = true;
rideRingtone.preload = "auto";

function playRideRingtone() {
  rideRingtone.currentTime = 0;

  rideRingtone.play().catch(function (error) {
    console.error("RINGTONE ERROR:", error);
  });
}

function stopRideRingtone() {
  rideRingtone.pause();
  rideRingtone.currentTime = 0;
}







/* =========================================
   3R DRS-D — DRIVER PUBLIC PROFILE PHOTO
   Separate from verification selfie/documents.
   ========================================= */

const DRIVER_PROFILE_PHOTO_UPLOAD_URL =
  "https://paystack-backend-gamma.vercel.app/driver-profile-photo-upload-url";


function setDriverProfilePhotoState(
  text
) {
  const state =
    document.getElementById(
      "driver-profile-photo-state"
    );

  if (state) {
    state.textContent =
      text || "";
  }
}


function applyDriverAvatarPhoto(
  photoUrl
) {
  const avatars = [
    document.getElementById(
      "header-driver-avatar"
    ),

    document.getElementById(
      "profile-driver-avatar"
    )
  ];

  avatars.forEach(
    function (avatar) {

      if (!avatar) {
        return;
      }

      if (photoUrl) {

        avatar.textContent = "";

        avatar.style.backgroundImage =
          'url("' +
          String(photoUrl)
            .replaceAll('"', "%22") +
          '")';

        avatar.style.backgroundSize =
          "cover";

        avatar.style.backgroundPosition =
          "center";

        avatar.style.backgroundRepeat =
          "no-repeat";

      } else {

        avatar.style.backgroundImage =
          "none";

        avatar.textContent = "R";
      }
    }
  );
}


function chooseDriverProfilePhoto() {

  const input =
    document.getElementById(
      "driver-profile-photo-input"
    );

  if (input) {
    input.click();
  }
}


async function uploadDriverProfilePhoto(
  file
) {

  const button =
    document.getElementById(
      "driver-profile-photo-button"
    );

  try {

    if (!file) {
      return;
    }


    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];


    if (
      !allowedTypes.includes(
        String(
          file.type || ""
        ).toLowerCase()
      )
    ) {
      throw new Error(
        "Choose a JPG, PNG or WEBP image."
      );
    }


    if (
      !file.size ||
      file.size >
        5 * 1024 * 1024
    ) {
      throw new Error(
        "Profile picture must be 5 MB or smaller."
      );
    }


    const auth =
      window.rudolfDriverAuth;


    if (
      !auth ||
      !auth.uid ||
      typeof auth.getIdToken !==
        "function"
    ) {
      throw new Error(
        "Driver authentication is not ready."
      );
    }


    if (button) {
      button.disabled = true;
      button.textContent =
        "Uploading...";
    }


    setDriverProfilePhotoState(
      "Preparing profile picture..."
    );


    const idToken =
      await auth.getIdToken();


    const permissionResponse =
      await fetch(
        DRIVER_PROFILE_PHOTO_UPLOAD_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " +
              idToken
          },

          body: JSON.stringify({
            name:
              file.name || "profile.jpg",

            contentType:
              file.type,

            size:
              file.size
          })
        }
      );


    let permission = {};

    try {
      permission =
        await permissionResponse.json();
    } catch (error) {
      permission = {};
    }


    if (
      !permissionResponse.ok ||
      !permission.success ||
      !permission.uploadUrl ||
      !permission.photoUrl
    ) {
      throw new Error(
        permission.message ||
        "Could not prepare profile picture upload."
      );
    }


    setDriverProfilePhotoState(
      "Uploading profile picture..."
    );


    const uploadResponse =
      await fetch(
        permission.uploadUrl,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              file.type
          },

          body:
            file
        }
      );


    if (!uploadResponse.ok) {
      throw new Error(
        "Profile picture upload failed."
      );
    }


    const profile =
      readStoredObject(
        "rudolfDriverProfile",
        {}
      );


    profile.photoUrl =
      permission.photoUrl;

    profile.photoPath =
      permission.path || "";

    profile.photoUpdatedAt =
      new Date().toISOString();


    saveStoredObject(
      "rudolfDriverProfile",
      profile
    );


    applyDriverProfile();


    setDriverProfilePhotoState(
      "✅ Profile picture uploaded"
    );


    alert(
      "✅ Profile picture updated successfully"
    );


  } catch (error) {

    console.error(
      "Driver profile picture upload:",
      error
    );

    setDriverProfilePhotoState(
      "❌ " +
      (
        error &&
        error.message
          ? error.message
          : "Upload failed"
      )
    );

    alert(
      "❌ " +
      (
        error &&
        error.message
          ? error.message
          : "Profile picture upload failed"
      )
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent =
        "📷 Choose Profile Picture";
    }
  }
}


function initDriverProfilePhotoUpload() {

  const input =
    document.getElementById(
      "driver-profile-photo-input"
    );

  if (
    input &&
    input.dataset.profilePhotoBound !==
      "yes"
  ) {

    input.dataset.profilePhotoBound =
      "yes";

    input.addEventListener(
      "change",
      function () {

        const file =
          input.files &&
          input.files[0]
            ? input.files[0]
            : null;

        if (file) {
          uploadDriverProfilePhoto(
            file
          );
        }

        input.value = "";
      }
    );
  }


  const profile =
    readStoredObject(
      "rudolfDriverProfile",
      {}
    );


  if (profile.photoUrl) {

    setDriverProfilePhotoState(
      "✅ Profile picture ready"
    );

    applyDriverAvatarPhoto(
      profile.photoUrl
    );
  }
}


window.chooseDriverProfilePhoto =
  chooseDriverProfilePhoto;


if (
  document.readyState ===
    "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initDriverProfilePhotoUpload
  );

} else {

  initDriverProfilePhotoUpload();
}


/* =========================================
   RUDOLF RIDE — EDIT DRIVER PROFILE
   ========================================= */

function editDriverProfile() {
  const savedProfile = JSON.parse(
    localStorage.getItem("rudolfDriverProfile") || "{}"
  );

  const currentName =
    savedProfile.name ||
    document.getElementById("profile-driver-name")?.textContent.trim() ||
    "Rudolf";

  const currentVehicle =
    savedProfile.vehicle ||
    document.getElementById("profile-driver-vehicle")?.textContent.trim() ||
    "Toyota Corolla";

  const currentPlate =
    savedProfile.plate ||
    document.getElementById("profile-driver-plate")?.textContent.trim() ||
    "GR 12345";

  const name = prompt("Driver name:", currentName);
  if (name === null) return;

  const vehicle = prompt("Vehicle:", currentVehicle);
  if (vehicle === null) return;

  const plate = prompt("Plate number:", currentPlate);
  if (plate === null) return;

  const profile =
    Object.assign(
      {},
      savedProfile,
      {
        name:
          name.trim() ||
          currentName,

        vehicle:
          vehicle.trim() ||
          currentVehicle,

        plate:
          plate.trim()
            .toUpperCase() ||
          currentPlate
      }
    );

  localStorage.setItem(
    "rudolfDriverProfile",
    JSON.stringify(profile)
  );

  applyDriverProfile();

  alert("✅ Profile updated successfully");
}

function applyDriverProfile() {
  const profile = JSON.parse(
    localStorage.getItem("rudolfDriverProfile") || "{}"
  );

  if (profile.name) {
    const nameEl = document.getElementById("profile-driver-name");
    if (nameEl) nameEl.textContent = profile.name;
  }

  if (profile.vehicle) {
    const vehicleEl = document.getElementById("profile-driver-vehicle");
    if (vehicleEl) vehicleEl.textContent = profile.vehicle;
  }

  if (profile.plate) {
    const plateEl = document.getElementById("profile-driver-plate");
    if (plateEl) plateEl.textContent = profile.plate;
  }

  applyDriverAvatarPhoto(
    profile.photoUrl || ""
  );
}

window.editDriverProfile = editDriverProfile;

document.addEventListener("DOMContentLoaded", function () {
  applyDriverProfile();
});


/* =========================================
   3R DRS-D — DRIVER CONTACT PHONE
   Home contact only. Separate from vehicle,
   plate and Mobile Money withdrawal details.
   ========================================= */

const DRIVER_CONTACT_PHONE_KEY =
  "rudolfDriverContactPhone";

function applyDriverContactPhone() {
  const phone =
    localStorage.getItem(
      DRIVER_CONTACT_PHONE_KEY
    ) || "";

  const phoneEl =
    document.getElementById(
      "driver-contact-phone"
    );

  if (phoneEl) {
    phoneEl.textContent =
      phone || "Tap to set";
  }
}

function editDriverContactPhone() {
  const currentPhone =
    localStorage.getItem(
      DRIVER_CONTACT_PHONE_KEY
    ) || "";

  const entered = prompt(
    "Driver contact phone number:",
    currentPhone
  );

  if (entered === null) return;

  const cleanPhone =
    entered
      .trim()
      .replace(/\s+/g, "")
      .replace(/-/g, "");

  if (
    !/^0\d{9}$/.test(cleanPhone) &&
    !/^\+233\d{9}$/.test(cleanPhone) &&
    !/^233\d{9}$/.test(cleanPhone)
  ) {
    alert(
      "Please enter a valid Ghana phone number."
    );
    return;
  }

  localStorage.setItem(
    DRIVER_CONTACT_PHONE_KEY,
    cleanPhone
  );

  applyDriverContactPhone();

  alert(
    "✅ Driver contact number saved."
  );
}

window.editDriverContactPhone =
  editDriverContactPhone;

document.addEventListener(
  "DOMContentLoaded",
  applyDriverContactPhone
);


/* =========================================
   RUDOLF RIDE — LIVE DRIVER WALLET
   ========================================= */

function renderDriverWallet() {
  const rides = getDriverRides();

  const completedRides = rides.filter(function (ride) {
    return ride.status === "Ride completed";
  });

  let totalFares = 0;
  let totalDriverEarnings = 0;
  let totalPlatformFees = 0;

  completedRides.forEach(function (ride) {
    const fare =
      Number(
        ride.totalFare !== undefined
          ? ride.totalFare
          : ride.fare
      ) || 0;

    const platformFee =
      Number(
        ride.platformFee !== undefined
          ? ride.platformFee
          : (fare * 0.15)
      ) || 0;

    const driverEarnings =
      Number(
        ride.driverEarnings !== undefined
          ? ride.driverEarnings
          : (fare - platformFee)
      ) || 0;

    totalFares += fare;
    totalPlatformFees += platformFee;
    totalDriverEarnings += driverEarnings;
  });

  const walletBalance =
    document.getElementById("wallet-balance");

  const totalFaresBox =
    document.getElementById("wallet-total-fares");

  const earningsBox =
    document.getElementById("wallet-driver-earnings");

  const platformFeeBox =
    document.getElementById("wallet-platform-fee");

  const completedTripsBox =
    document.getElementById("wallet-completed-trips");

  const transactionsBox =
    document.getElementById("wallet-transactions");

  const totalWithdrawals =
    getTotalDriverWithdrawals();

  const availableBalance =
    Math.max(
      0,
      totalDriverEarnings - totalWithdrawals
    );

  if (walletBalance) {
    walletBalance.textContent =
      "GH₵ " + availableBalance.toFixed(2);
  }

  if (totalFaresBox) {
    totalFaresBox.textContent =
      "GH₵ " + totalFares.toFixed(2);
  }

  if (earningsBox) {
    earningsBox.textContent =
      "GH₵ " + totalDriverEarnings.toFixed(2);
  }

  if (platformFeeBox) {
    platformFeeBox.textContent =
      "GH₵ " + totalPlatformFees.toFixed(2);
  }

  if (completedTripsBox) {
    completedTripsBox.textContent =
      String(completedRides.length);
  }

  if (!transactionsBox) {
    return;
  }

  const withdrawals =
    getDriverWithdrawals();

  if (
    completedRides.length === 0 &&
    withdrawals.length === 0
  ) {
    transactionsBox.innerHTML =
      '<p class="wallet-empty">' +
      'No wallet transactions yet.' +
      '</p>';

    return;
  }

  transactionsBox.innerHTML = "";

    /* Combine withdrawals and completed rides */
    const walletTransactions = [];

    withdrawals.forEach(function (withdrawal) {
      walletTransactions.push({
        type: "withdrawal",
        data: withdrawal,
        time:
          new Date(
            withdrawal.createdAt ||
            withdrawal.createdDateTime ||
            0
          ).getTime() || 0
      });
    });

    completedRides.forEach(function (ride) {
      walletTransactions.push({
        type: "ride",
        data: ride,
        time:
          new Date(
            ride.completedAt ||
            ride.completedDateTime ||
            ride.updatedAt ||
            ride.createdAt ||
            0
          ).getTime() || 0
      });
    });

    /* Newest transaction first */
    walletTransactions.sort(function (a, b) {
      return b.time - a.time;
    });

    walletTransactions.forEach(function (item) {
      const transaction =
        document.createElement("div");

      transaction.className =
        "wallet-transaction";

      if (item.type === "withdrawal") {
        const withdrawal = item.data;

        const amount =
          Number(withdrawal.amount) || 0;

        const dateText =
          withdrawal.createdDateTime ||
          (withdrawal.createdAt
            ? new Date(
                withdrawal.createdAt
              ).toLocaleString()
            : "Withdrawal");

        transaction.innerHTML =
          "<div>" +
            "<strong>Withdrawal completed</strong>" +
            "<span>" + dateText + "</span>" +
          "</div>" +
          "<div>" +
            "<strong>- GH₵ " +
              amount.toFixed(2) +
            "</strong>" +
            "<span>" +
              (withdrawal.network || "Mobile Money") +
              " • " +
              (withdrawal.id || "—") +
            "</span>" +
          "</div>";

      } else {
        const ride = item.data;

        const fare =
          Number(
            ride.totalFare !== undefined
              ? ride.totalFare
              : ride.fare
          ) || 0;

        const platformFee =
          Number(
            ride.platformFee !== undefined
              ? ride.platformFee
              : (fare * 0.15)
          ) || 0;

        const driverEarnings =
          Number(
            ride.driverEarnings !== undefined
              ? ride.driverEarnings
              : (fare - platformFee)
          ) || 0;

        const dateText =
          ride.completedDateTime ||
          (ride.completedAt
            ? new Date(
                ride.completedAt
              ).toLocaleString()
            : "Completed ride");

        const displayRideId =
          ride.rideId ||
          ride.createdAt ||
          "Unavailable";

        transaction.innerHTML =
          "<div>" +
            "<strong>Ride completed</strong>" +
            "<span>" + dateText + "</span>" +
            "<span>Ride ID: " + displayRideId + "</span>" +
          "</div>" +
          "<div>" +
            "<strong>+ GH₵ " +
              driverEarnings.toFixed(2) +
            "</strong>" +
            "<span>Fare GH₵ " +
              fare.toFixed(2) +
              " • Fee GH₵ " +
              platformFee.toFixed(2) +
            "</span>" +
          "</div>";
      }

      transactionsBox.appendChild(transaction);
    });
}

window.renderDriverWallet =
  renderDriverWallet;


/* =========================================
   RUDOLF RIDE — DRIVER RIDE DETAILS
   ========================================= */

function openDriverRideDetails(rideId) {
  const rides = getDriverRides();

  const ride = rides.find(function (item) {
    return String(
      item.rideId ||
      item.createdAt ||
      ""
    ) === String(rideId);
  });

  if (!ride) {
    console.error(
      "Ride details not found:",
      rideId
    );
    return;
  }

  const ridesSection =
    document.getElementById(
      "driver-rides-section"
    );

  const detailsSection =
    document.getElementById(
      "driver-ride-details-section"
    );

  const content =
    document.getElementById(
      "ride-details-content"
    );

  if (!detailsSection || !content) {
    return;
  }

  const fare =
    Number(
      ride.totalFare !== undefined
        ? ride.totalFare
        : ride.fare
    ) || 0;

  const platformFee =
    Number(
      ride.platformFee !== undefined
        ? ride.platformFee
        : fare * 0.15
    ) || 0;

  const driverEarnings =
    Number(
      ride.driverEarnings !== undefined
        ? ride.driverEarnings
        : fare - platformFee
    ) || 0;

  const dateValue =
    ride.completedAt ||
    ride.completedDate ||
    ride.date ||
    ride.createdAt ||
    ride.updatedAt;

  const date = new Date(dateValue);

  const dateText =
    Number.isNaN(date.getTime())
      ? (
          ride.completedDateTime ||
          "Date unavailable"
        )
      : date.toLocaleString();

  const displayRideId =
    ride.rideId ||
    ride.createdAt ||
    "Unavailable";

  const rideType =
    ride.selectedRide ||
    ride.rideType ||
    "Rudolf Ride";

  content.innerHTML = "";

  const details = [
    ["📍 Pickup", ride.pickup || "Unavailable"],
    ["🏁 Destination", ride.destination || "Unavailable"],
    ["🚗 Ride Type", rideType],
    ["🆔 Ride ID", displayRideId],
    ["📅 Date", dateText],
    ["💵 Total Fare", "GH₵ " + fare.toFixed(2)],
    [
      "👑 Rudolf Ride Fee (15%)",
      "GH₵ " + platformFee.toFixed(2)
    ],
    [
      "💰 Driver Earnings (85%)",
      "GH₵ " + driverEarnings.toFixed(2)
    ],
    ["✅ Status", ride.status || "Ride completed"]
  ];

  details.forEach(function (item) {
    const row =
      document.createElement("div");

    row.className =
      "ride-details-row";

    const label =
      document.createElement("span");

    const value =
      document.createElement("strong");

    label.textContent = item[0];
    value.textContent = item[1];

    row.appendChild(label);
    row.appendChild(value);
    content.appendChild(row);
  });

  if (ridesSection) {
    ridesSection.style.display = "none";
  }

  detailsSection.style.display = "block";

  window.scrollTo(0, 0);
}

function closeDriverRideDetails() {
  const detailsSection =
    document.getElementById(
      "driver-ride-details-section"
    );

  if (detailsSection) {
    detailsSection.style.display = "none";
  }

  showDriverSection("rides");
}

const rideDetailsBackButton =
  document.getElementById(
    "ride-details-back-btn"
  );

if (rideDetailsBackButton) {
  rideDetailsBackButton.addEventListener(
    "click",
    closeDriverRideDetails
  );
}

window.openDriverRideDetails =
  openDriverRideDetails;

window.closeDriverRideDetails =
  closeDriverRideDetails;


/* =========================================
   RUDOLF RIDE — WITHDRAW LIVE BALANCE
   ========================================= */

function getDriverWithdrawBalance() {
  const rides = getDriverRides();

  const completedRides = rides.filter(function (ride) {
    return ride.status === "Ride completed";
  });

  let totalDriverEarnings = 0;

  completedRides.forEach(function (ride) {
    const fare =
      Number(
        ride.totalFare !== undefined
          ? ride.totalFare
          : ride.fare
      ) || 0;

    const platformFee =
      Number(
        ride.platformFee !== undefined
          ? ride.platformFee
          : fare * 0.15
      ) || 0;

    const driverEarnings =
      Number(
        ride.driverEarnings !== undefined
          ? ride.driverEarnings
          : fare - platformFee
      ) || 0;

    totalDriverEarnings += driverEarnings;
  });

  const totalWithdrawals =
    getTotalDriverWithdrawals();

  return Math.max(
    0,
    totalDriverEarnings - totalWithdrawals
  );
}

function renderWithdrawBalance() {
  const balance = getDriverWithdrawBalance();

  const balanceBox =
    document.getElementById("withdraw-available-balance");

  if (balanceBox) {
    balanceBox.textContent =
      "GH₵ " + balance.toFixed(2);
  }
}

function setMaximumWithdrawal() {
  const balance = getDriverWithdrawBalance();

  const amountInput =
    document.getElementById("withdraw-amount");

  if (amountInput) {
    amountInput.value = balance.toFixed(2);
  }
}

window.renderWithdrawBalance =
  renderWithdrawBalance;

window.setMaximumWithdrawal =
  setMaximumWithdrawal;


/* =========================================
   RUDOLF RIDE — WITHDRAWAL PREVIEW
   ========================================= */

function previewWithdrawal() {
  const amountInput =
    document.getElementById("withdraw-amount");

  const networkInput =
    document.getElementById("withdraw-network");

  const phoneInput =
    document.getElementById("withdraw-phone");

  const nameInput =
    document.getElementById("withdraw-name");

  const amount =
    Number(amountInput?.value || 0);

  const network =
    networkInput?.value || "";

  const phone =
    phoneInput?.value.trim() || "";

  const accountName =
    nameInput?.value.trim() || "";

  const availableBalance =
    getDriverWithdrawBalance();

  /* Amount validation */
  if (amount <= 0) {
    alert("Please enter a withdrawal amount.");
    amountInput?.focus();
    return;
  }

  if (amount > availableBalance) {
    alert(
      "Insufficient balance.\n\n" +
      "Available: GH₵ " +
      availableBalance.toFixed(2)
    );
    amountInput?.focus();
    return;
  }

  /* Network validation */
  if (!network) {
    alert("Please select your Mobile Money network.");
    networkInput?.focus();
    return;
  }

  /* Phone validation */
  const cleanPhone =
    phone.replace(/\s+/g, "");

  if (!/^0\d{9}$/.test(cleanPhone)) {
    alert(
      "Please enter a valid 10-digit Ghana Mobile Money number."
    );
    phoneInput?.focus();
    return;
  }

  /* Account name validation */
  if (accountName.length < 2) {
    alert("Please enter the Mobile Money account name.");
    nameInput?.focus();
    return;
  }

  /* Fill Review Withdrawal screen */

  const reviewAmount =
    document.getElementById("review-withdraw-amount");

  const reviewNetwork =
    document.getElementById("review-withdraw-network");

  const reviewPhone =
    document.getElementById("review-withdraw-phone");

  const reviewName =
    document.getElementById("review-withdraw-name");

  if (reviewAmount) {
    reviewAmount.textContent =
      "GH₵ " + amount.toFixed(2);
  }

  if (reviewNetwork) {
    reviewNetwork.textContent = network;
  }

  if (reviewPhone) {
    reviewPhone.textContent = cleanPhone;
  }

  if (reviewName) {
    reviewName.textContent = accountName;
  }

  showDriverSection("withdraw-review");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

window.previewWithdrawal =
  previewWithdrawal;


/* =========================================
   RUDOLF RIDE — WITHDRAWAL STORAGE
   ========================================= */

function getDriverWithdrawals() {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          DRIVER_WITHDRAWALS_KEY
        ) || "[]"
      );

    return Array.isArray(saved)
      ? saved
      : [];
  } catch (error) {
    console.error(
      "Could not load withdrawals:",
      error
    );

    return [];
  }
}

function saveDriverWithdrawals(withdrawals) {
  localStorage.setItem(
    DRIVER_WITHDRAWALS_KEY,
    JSON.stringify(withdrawals)
  );
}

function getTotalDriverWithdrawals() {
  const withdrawals =
    getDriverWithdrawals();

  return withdrawals.reduce(
    function (total, withdrawal) {
      return total +
        (Number(withdrawal.amount) || 0);
    },
    0
  );
}

window.getDriverWithdrawals =
  getDriverWithdrawals;

window.getTotalDriverWithdrawals =
  getTotalDriverWithdrawals;


/* =========================================
   RUDOLF RIDE — CONFIRM WITHDRAWAL
   Local wallet transaction
   ========================================= */

function confirmWithdrawal() {
  const amount = Number(
    document.getElementById("withdraw-amount")?.value || 0
  );

  const network =
    document.getElementById("withdraw-network")?.value || "";

  const phone = (
    document.getElementById("withdraw-phone")?.value || ""
  ).replace(/\s+/g, "");

  const accountName = (
    document.getElementById("withdraw-name")?.value || ""
  ).trim();

  const availableBalance =
    getDriverWithdrawBalance();

  if (amount <= 0) {
    alert("Invalid withdrawal amount.");
    showDriverSection("withdraw");
    return;
  }

  if (amount > availableBalance) {
    alert(
      "Your available balance has changed.\n\n" +
      "Available: GH₵ " +
      availableBalance.toFixed(2)
    );

    renderWithdrawBalance();
    showDriverSection("withdraw");
    return;
  }

  if (
    !network ||
    !/^0\d{9}$/.test(phone) ||
    accountName.length < 2
  ) {
    alert("Please check your withdrawal details.");
    showDriverSection("withdraw");
    return;
  }

  const withdrawals =
    getDriverWithdrawals();

  const withdrawal = {
    id: "WD" + Date.now(),
    amount: amount,
    network: network,
    phone: phone,
    accountName: accountName,
    status: "Completed",
    createdAt: new Date().toISOString(),
    createdDateTime: new Date().toLocaleString()
  };

  withdrawals.push(withdrawal);
  saveDriverWithdrawals(withdrawals);

  const amountInput =
    document.getElementById("withdraw-amount");

  const networkInput =
    document.getElementById("withdraw-network");

  const phoneInput =
    document.getElementById("withdraw-phone");

  const nameInput =
    document.getElementById("withdraw-name");

  if (amountInput) amountInput.value = "";
  if (networkInput) networkInput.value = "";
  if (phoneInput) phoneInput.value = "";
  if (nameInput) nameInput.value = "";

  renderDriverWallet();
  renderWithdrawBalance();

  alert(
    "Withdrawal successful!\n\n" +
    "GH₵ " +
    amount.toFixed(2) +
    " withdrawn to " +
    network +
    ".\n\nReference: " +
    withdrawal.id
  );

  showDriverSection("wallet");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

window.confirmWithdrawal =
  confirmWithdrawal;

/* =========================================
   3R DRIVER ACCEPTANCE RATE — ISOLATED OBSERVER
   Does not modify ride actions or ride flow.
   ========================================= */

const DRIVER_ACCEPTANCE_STATS_KEY =
  "rudolfDriverAcceptanceStats";

function getDriverAcceptanceStats() {
  const saved = readStoredObject(
    DRIVER_ACCEPTANCE_STATS_KEY,
    null
  );

  if (
    !saved ||
    !Number.isFinite(Number(saved.accepted)) ||
    !Number.isFinite(Number(saved.total))
  ) {
    return {
      accepted: 96,
      total: 100,
      decisions: {}
    };
  }

  if (
    !saved.decisions ||
    typeof saved.decisions !== "object"
  ) {
    saved.decisions = {};
  }

  saved.accepted = Number(saved.accepted);
  saved.total = Number(saved.total);

  return saved;
}

function getAcceptanceRideKey(ride) {
  if (!ride || typeof ride !== "object") {
    return "";
  }

  if (ride.createdAt) {
    return "createdAt:" + String(ride.createdAt);
  }

  if (ride.rideId) {
    return "rideId:" + String(ride.rideId);
  }

  const fallback = [
    ride.pickup || "",
    ride.destination || "",
    ride.fare || ""
  ].join("|");

  return fallback.replace(/\|/g, "")
    ? "ride:" + fallback
    : "";
}

function renderDriverAcceptanceRate(stats) {
  const box =
    document.getElementById(
      "driver-acceptance-rate"
    );

  if (!box) {
    return;
  }

  const percentage =
    stats.total > 0
      ? Math.round(
          (stats.accepted / stats.total) * 100
        )
      : 100;

  box.textContent =
    percentage + "%";
}

function trackDriverAcceptanceRate() {
  const stats =
    getDriverAcceptanceStats();

  const ride =
    getCurrentRide();

  if (
    ride &&
    typeof ride === "object"
  ) {
    const rideKey =
      getAcceptanceRideKey(ride);

    if (
      rideKey &&
      !stats.decisions[rideKey]
    ) {
      if (isAccepted(ride.status)) {
        stats.total += 1;
        stats.accepted += 1;

        stats.decisions[rideKey] =
          "accepted";

        saveStoredObject(
          DRIVER_ACCEPTANCE_STATS_KEY,
          stats
        );

      } else if (
        ride.status === "Ride declined"
      ) {
        stats.total += 1;

        stats.decisions[rideKey] =
          "declined";

        saveStoredObject(
          DRIVER_ACCEPTANCE_STATS_KEY,
          stats
        );
      }
    }
  }

  renderDriverAcceptanceRate(stats);
}

function startDriverAcceptanceTracker() {
  trackDriverAcceptanceRate();

  setInterval(
    trackDriverAcceptanceRate,
    1000
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    startDriverAcceptanceTracker,
    { once: true }
  );
} else {
  startDriverAcceptanceTracker();
}

/* =========================================
   END 3R DRIVER ACCEPTANCE RATE
   ========================================= */

// =====================================
// 3R DECLINED HISTORY — STORAGE START
// Separate from completed ride storage.
// =====================================

const DRIVER_DECLINED_RIDES_KEY =
  "rudolfDriverDeclinedRides";

function getDeclinedDriverRides() {
  const rides = readStoredObject(
    DRIVER_DECLINED_RIDES_KEY,
    []
  );

  return Array.isArray(rides) ? rides : [];
}

function getDeclinedRideHistoryId(ride) {
  if (!ride) return "";

  return String(
    ride.rideId ||
    ride.createdAt ||
    [
      ride.pickup || "",
      ride.destination || "",
      ride.fare || ""
    ].join("|")
  );
}

function saveDeclinedRideHistory(ride) {
  if (!ride || ride.status !== "Ride declined") {
    return false;
  }

  const rides = getDeclinedDriverRides();
  const rideId = getDeclinedRideHistoryId(ride);

  const alreadySaved = rides.some(function (savedRide) {
    return (
      getDeclinedRideHistoryId(savedRide) === rideId
    );
  });

  if (alreadySaved) {
    return false;
  }

  const savedRide =
    JSON.parse(JSON.stringify(ride));

  savedRide.declinedAt =
    savedRide.updatedAt || Date.now();

  rides.push(savedRide);

  saveStoredObject(
    DRIVER_DECLINED_RIDES_KEY,
    rides
  );

  return true;
}

// =====================================
// 3R DECLINED HISTORY — STORAGE END
// =====================================

// =====================================
// 3R DECLINED HISTORY — DETAILS START
// Additive declined-request details only.
// =====================================
function formatDeclinedRideDate(ride) {
  const value =
    ride.declinedAt ||
    ride.updatedAt ||
    ride.createdAt;

  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

function findDeclinedRide(historyId) {
  return getDeclinedDriverRides().find(
    function (ride) {
      return (
        getDeclinedRideHistoryId(ride) ===
        String(historyId)
      );
    }
  );
}

function getDeclinedRideDetailItems(ride) {
  const rideType =
    ride.selectedRide ||
    ride.rideType ||
    "Rudolf Ride";

  const rideId =
    ride.rideId ||
    ride.createdAt ||
    "Unavailable";

  return [
    ["Pickup", ride.pickup || "Unavailable"],
    ["Destination", ride.destination || "Unavailable"],
    ["Ride Type", rideType],
    ["Ride ID", rideId],
    ["Date", formatDeclinedRideDate(ride)],
    ["Fare offered", formatFare(ride.fare)],
    ["Status", "Ride declined"]
  ];
}

function openDeclinedRideDetails(historyId) {
  const ride =
    findDeclinedRide(historyId);

  if (!ride) {
    console.error(
      "Declined ride details not found:",
      historyId
    );
    return;
  }

  const ridesSection =
    document.getElementById(
      "driver-rides-section"
    );

  const detailsSection =
    document.getElementById(
      "driver-ride-details-section"
    );

  const content =
    document.getElementById(
      "ride-details-content"
    );

  if (!detailsSection || !content) {
    return;
  }

  content.innerHTML = "";

  const items =
    getDeclinedRideDetailItems(ride);

  items.forEach(function (item) {
    const row =
      document.createElement("div");

    row.className =
      "ride-details-row";

    const label =
      document.createElement("span");

    const value =
      document.createElement("strong");

    label.textContent =
      item[0];

    value.textContent =
      item[1];

    row.appendChild(label);
    row.appendChild(value);
    content.appendChild(row);
  });

  if (ridesSection) {
    ridesSection.style.display = "none";
  }

  detailsSection.style.display = "block";
  window.scrollTo(0, 0);
}

// =====================================
// 3R DECLINED HISTORY — DETAILS END
// =====================================

// =====================================
// 3R DECLINED HISTORY — CARDS START
// Additive declined-request cards only.
// =====================================
function createDeclinedRideCard(ride) {
  const card =
    document.createElement("article");

  card.className =
    "ride-history-card ride-card";

  const title =
    document.createElement("h3");

  title.textContent =
    (ride.pickup || "Pickup") +
    " → " +
    (ride.destination || "Destination");

  card.appendChild(title);

  addRideDetail(
    card,
    "Ride",
    ride.selectedRide ||
    ride.rideType ||
    "Rudolf Ride"
  );

  addRideDetail(
    card,
    "Fare offered",
    formatFare(ride.fare)
  );

  addRideDetail(
    card,
    "Status",
    "Ride declined"
  );

  if (card.lastElementChild) {
    card.lastElementChild.classList.add(
      "declined-status-line"
    );
  }

  addRideDetail(
    card,
    "Date",
    formatDeclinedRideDate(ride)
  );

  const button =
    document.createElement("button");

  button.type = "button";
  button.className =
    "ride-view-details-btn";
  button.textContent =
    "View Details";

  const historyId =
    getDeclinedRideHistoryId(ride);

  button.addEventListener(
    "click",
    function () {
      openDeclinedRideDetails(historyId);
    }
  );

  card.appendChild(button);
  return card;
}

function renderDeclinedRideHistory() {
  const list =
    document.getElementById("driver-rides-list");

  if (!list) return;

  const oldSection =
    document.getElementById(
      "driver-declined-rides-history"
    );

  if (oldSection) {
    oldSection.remove();
  }

  // 3R: a completed ride must never appear as declined.
  const completedRides =
    getDriverRides();

  const declinedRides =
    getDeclinedDriverRides()
      .filter(function (declinedRide) {
        return !completedRides.some(function (completedRide) {
          return (
            (
              declinedRide.rideId &&
              completedRide.rideId &&
              String(declinedRide.rideId) ===
              String(completedRide.rideId)
            ) ||
            (
              declinedRide.createdAt &&
              completedRide.createdAt &&
              String(declinedRide.createdAt) ===
              String(completedRide.createdAt)
            )
          );
        });
      })
      .slice()
      .reverse();

  if (declinedRides.length === 0) {
    return;
  }

  const emptyBox =
    list.querySelector("#rides-list");

  if (emptyBox) {
    emptyBox.remove();
  }

  const section =
    document.createElement("section");

  section.id =
    "driver-declined-rides-history";

  const heading =
    document.createElement("h3");

  heading.textContent =
    "Declined requests";

  section.appendChild(heading);

  declinedRides.forEach(function (ride) {
    section.appendChild(
      createDeclinedRideCard(ride)
    );
  });

  list.appendChild(section);
}

// =====================================
// 3R DECLINED HISTORY — CARDS END
// =====================================

// =====================================
// 3R TEMP COMPLETED-RIDE RUNTIME DIAGNOSTIC START
// Diagnostic only. No ride behaviour is changed.
// =====================================
function render3RCompletedRideDiagnostic() {
  const list =
    document.getElementById("driver-rides-list");

  if (!list) {
    return;
  }

  const oldBox =
    document.getElementById(
      "rr-3r-completed-diagnostic"
    );

  if (oldBox) {
    oldBox.remove();
  }

  const completedRides =
    getDriverRides();

  const declinedRides =
    getDeclinedDriverRides();

  const rawCompleted =
    localStorage.getItem(
      DRIVER_RIDES_KEY
    );

  const lastCompleted =
    completedRides.length
      ? completedRides[
          completedRides.length - 1
        ]
      : null;

  const box =
    document.createElement("div");

  box.id =
    "rr-3r-completed-diagnostic";

  box.style.cssText =
    "width:100%;box-sizing:border-box;" +
    "padding:10px;margin:0 0 10px;" +
    "border:2px dashed #111;" +
    "border-radius:10px;background:#fff6cc;" +
    "color:#111;font-size:12px;" +
    "font-weight:800;line-height:18px;";

  box.textContent =
    "3R DIAGNOSTIC — Completed stored: " +
    completedRides.length +
    " | Declined stored: " +
    declinedRides.length +
    " | Raw completed key: " +
    (rawCompleted ? "YES" : "NO") +
    " | Last status: " +
    (
      lastCompleted &&
      lastCompleted.status
        ? lastCompleted.status
        : "NONE"
    );

  list.prepend(box);
}
// =====================================
// 3R TEMP COMPLETED-RIDE RUNTIME DIAGNOSTIC END
// =====================================

// =====================================
// 3R DECLINED HISTORY — CONNECTION START
// Original My Rides renderer remains unchanged.
// =====================================
const originalRenderDriverRides3R =
  renderDriverRides;

renderDriverRides = function () {
  originalRenderDriverRides3R();

  try {
    renderDeclinedRideHistory();
  } catch (error) {
    console.error(
      "Declined history render failed:",
      error
    );
  }

  try {
    render3RCompletedRideDiagnostic();
  } catch (error) {
    console.error(
      "3R completed diagnostic failed:",
      error
    );
  }
};

// =====================================
// 3R DECLINED HISTORY — CONNECTION END
// =====================================

// =====================================
// 3R-DPS-B PASSENGER CANCELLATION POPUP START
// Phone 2 Driver only.
// =====================================

function showPassengerCancellationPopup(ride) {
  if (!ride) return;

  const popupId =
    "rudolf-passenger-cancellation-popup";

  // DOM protection against duplicate visible popups.
  if (document.getElementById(popupId)) {
    return;
  }

  const previousFocus = document.activeElement;

  const overlay =
    document.createElement("div");

  overlay.id = popupId;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute(
    "aria-labelledby",
    popupId + "-title"
  );

  overlay.style.cssText =
    "position:fixed;inset:0;z-index:100001;overflow:auto;" +
    "display:flex;flex-direction:column;box-sizing:border-box;" +
    "background:#fff4f2;color:#2d1a18;padding:8px;" +
    "padding-top:max(8px,env(safe-area-inset-top));" +
    "padding-bottom:max(8px,env(safe-area-inset-bottom));" +
    "font:700 15px/1.3 system-ui,sans-serif;" +
    "overscroll-behavior:contain;";

  const card =
    document.createElement("div");

  card.style.cssText =
    "box-sizing:border-box;width:100%;max-width:440px;" +
    "margin:0 auto;flex:1 0 auto;display:flex;" +
    "flex-direction:column;padding:14px;background:white;" +
    "border-radius:16px;box-shadow:0 8px 30px #5b1a141f;" +
    "overflow-wrap:anywhere;";

  overlay.appendChild(card);

  function textElement(tag, value, css) {
    const element =
      document.createElement(tag);

    element.textContent = value;
    element.style.cssText = css || "";
    card.appendChild(element);

    return element;
  }

  function row(label, value) {
    const line =
      document.createElement("div");

    line.style.cssText =
      "display:grid;grid-template-columns:105px minmax(0,1fr);" +
      "gap:8px;align-items:center;padding:10px 0;" +
      "border-bottom:1px solid #f1dedb;";

    const title =
      document.createElement("div");

    title.textContent = label;
    title.style.cssText =
      "font-size:14px;font-weight:800;color:#53251f;";

    const detail =
      document.createElement("div");

    detail.textContent =
      value === undefined ||
      value === null ||
      value === ""
        ? "Not available"
        : String(value);

    detail.style.cssText =
      "min-width:0;font-size:15px;font-weight:700;";

    line.appendChild(title);
    line.appendChild(detail);
    card.appendChild(line);
  }

  function fareText(value) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "Not available";
    }

    const cleaned =
      String(value).replace(/[^\d.-]/g, "");

    const amount = Number(cleaned);

    if (Number.isFinite(amount)) {
      return "GH₵ " + amount.toFixed(2);
    }

    return String(value);
  }

  textElement(
    "div",
    "RUDOLF RIDE",
    "color:#b42318;font-weight:900;letter-spacing:2px;"
  );

  const heading = textElement(
    "h2",
    "Passenger canceled ride",
    "margin:5px 0 3px;font-size:24px;font-weight:900;color:#b42318;"
  );

  heading.id = popupId + "-title";

  textElement(
    "p",
    "The passenger has canceled this trip.",
    "margin:0 0 12px;font-size:15px;font-weight:800;color:#53251f;"
  );

  textElement(
    "div",
    "CANCELLATION REASON",
    "margin-top:4px;font-size:13px;font-weight:900;color:#b42318;"
  );

  textElement(
    "div",
    ride.cancellationReason ||
      ride.cancelReason ||
      "No reason provided",
    "margin:5px 0 12px;padding:14px;border-radius:12px;" +
      "background:#fff0ed;border:2px solid #e6a49c;" +
      "font-size:20px;font-weight:900;color:#8a1c13;"
  );

  row("Pickup", ride.pickup);
  row("Destination", ride.destination);
  row("Ride type", ride.rideType);
  row("Fare offered", fareText(ride.fare));
  row("Trip ID", ride.rideId);

  textElement(
    "p",
    "Cancellation saved in Ride History.",
    "margin:12px 0 4px;font-size:14px;font-weight:800;color:#53251f;"
  );

  const done = textElement(
    "button",
    "DONE",
    "display:block;width:100%;min-height:48px;margin-top:auto;" +
      "border:0;border-radius:12px;background:#b42318;color:white;" +
      "font:800 16px system-ui;cursor:pointer;padding:11px;"
  );

  done.type = "button";

  function closePopup() {
    overlay.remove();

    if (
      previousFocus &&
      previousFocus.isConnected
    ) {
      previousFocus.focus();
    }
  }

  done.addEventListener(
    "click",
    closePopup
  );

  overlay.addEventListener(
    "keydown",
    function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup();
      } else if (event.key === "Tab") {
        event.preventDefault();
        done.focus();
      }
    }
  );

  document.body.appendChild(overlay);

  try {
    done.focus({ preventScroll: true });
  } catch (_) {
    done.focus();
  }
}

// =====================================
// 3R-DPS-B PASSENGER CANCELLATION POPUP END
// =====================================

// =====================================
// 3R PASSENGER CANCELLATION HISTORY — STORAGE START
// Phone 2 Driver only.
// =====================================

const DRIVER_PASSENGER_CANCELLED_RIDES_KEY =
  "rudolfDriverPassengerCancelledRides";

function getPassengerCancelledDriverRides() {
  const rides = readStoredObject(
    DRIVER_PASSENGER_CANCELLED_RIDES_KEY,
    []
  );

  return Array.isArray(rides) ? rides : [];
}

function getPassengerCancelledRideHistoryId(ride) {
  if (!ride) return "";

  return String(
    ride.rideId ||
    ride.createdAt ||
    [
      ride.pickup || "",
      ride.destination || "",
      ride.fare || ""
    ].join("|")
  );
}

function savePassengerCancelledRideHistory(ride) {
  if (
    !ride ||
    (
      ride.status !== "Ride canceled" &&
      ride.status !== "Ride cancelled"
    )
  ) {
    return false;
  }

  const rides =
    getPassengerCancelledDriverRides();

  const historyId =
    getPassengerCancelledRideHistoryId(ride);

  const alreadySaved =
    rides.some(function (savedRide) {
      return (
        getPassengerCancelledRideHistoryId(savedRide) ===
        historyId
      );
    });

  if (alreadySaved) {
    return false;
  }

  const savedRide =
    JSON.parse(JSON.stringify(ride));

  savedRide.passengerCancelledAt =
    savedRide.updatedAt || Date.now();

  rides.push(savedRide);

  saveStoredObject(
    DRIVER_PASSENGER_CANCELLED_RIDES_KEY,
    rides
  );

  return true;
}

// =====================================
// 3R PASSENGER CANCELLATION HISTORY — STORAGE END
// =====================================

// =====================================
// 3R PASSENGER CANCELLATION HISTORY — CARDS START
// Phone 2 Driver only.
// =====================================

function formatPassengerCancelledRideDate(ride) {
  const value =
    ride.passengerCancelledAt ||
    ride.updatedAt ||
    ride.createdAt;

  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

function createPassengerCancelledRideCard(ride) {
  const card =
    document.createElement("article");

  card.className =
    "ride-history-card ride-card";

  // Red identification for Passenger cancellation.
  card.style.borderLeft =
    "4px solid #c62828";

  const title =
    document.createElement("h3");

  title.textContent =
    (ride.pickup || "Pickup") +
    " → " +
    (ride.destination || "Destination");

  card.appendChild(title);

  addRideDetail(
    card,
    "Ride",
    ride.selectedRide ||
    ride.rideType ||
    "Rudolf Ride"
  );

  addRideDetail(
    card,
    "Fare offered",
    formatFare(ride.fare)
  );

  addRideDetail(
    card,
    "Status",
    "Passenger canceled"
  );

  if (card.lastElementChild) {
    card.lastElementChild.classList.add(
      "declined-status-line"
    );
  }

  addRideDetail(
    card,
    "Cancellation reason",
    ride.cancellationReason ||
    ride.cancelReason ||
    "No reason provided"
  );

  addRideDetail(
    card,
    "Date",
    formatPassengerCancelledRideDate(ride)
  );

  return card;
}

function renderPassengerCancelledRideHistory() {
  const list =
    document.getElementById(
      "driver-rides-list"
    );

  if (!list) return;

  const oldSection =
    document.getElementById(
      "driver-passenger-cancelled-rides-history"
    );

  if (oldSection) {
    oldSection.remove();
  }

  const cancelledRides =
    getPassengerCancelledDriverRides()
      .slice()
      .reverse();

  if (cancelledRides.length === 0) {
    return;
  }

  // Remove "No ride yet" when a Passenger
  // cancellation history exists.
  const emptyBox =
    list.querySelector("#rides-list");

  if (emptyBox) {
    emptyBox.remove();
  }

  const section =
    document.createElement("section");

  section.id =
    "driver-passenger-cancelled-rides-history";

  const heading =
    document.createElement("h3");

  heading.textContent =
    "Passenger cancellations";

  section.appendChild(heading);

  cancelledRides.forEach(function (ride) {
    section.appendChild(
      createPassengerCancelledRideCard(ride)
    );
  });

  // Keep existing order:
  // Completed rides
  // Passenger cancellations
  // Driver declined requests
  const declinedSection =
    document.getElementById(
      "driver-declined-rides-history"
    );

  if (
    declinedSection &&
    declinedSection.parentNode === list
  ) {
    list.insertBefore(
      section,
      declinedSection
    );
  } else {
    list.appendChild(section);
  }
}

// =====================================
// 3R PASSENGER CANCELLATION HISTORY — CARDS END
// =====================================


// =====================================
// 3R PASSENGER CANCELLATION HISTORY — CONNECTION START
// Preserve all existing My Rides behaviour.
// =====================================

const renderDriverRidesBeforePassengerCancel3R =
  renderDriverRides;

renderDriverRides = function () {
  renderDriverRidesBeforePassengerCancel3R();

  try {
    renderPassengerCancelledRideHistory();
  } catch (error) {
    console.error(
      "Passenger cancellation history render failed:",
      error
    );
  }
};

// =====================================
// 3R PASSENGER CANCELLATION HISTORY — CONNECTION END
// =====================================


/* =========================================================
   3R DRS-D — CALL CURRENT PASSENGER
   Phone 2 Driver only.
   Reads passengerPhone from the active Firebase ride and
   opens the device phone dialer.
========================================================= */

async function callCurrentPassenger() {
  try {
    const response = await fetch(
      "https://rudolf-ride-default-rtdb.europe-west1.firebasedatabase.app/rudolfCurrentRide.json",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "Unable to read current ride (" + response.status + ")"
      );
    }

    const ride = await response.json();

    if (!ride || typeof ride !== "object") {
      alert("There is no active passenger ride to call.");
      return;
    }

    const endedStatuses = new Set([
      "Ride declined",
      "Ride canceled",
      "Ride cancelled",
      "Ride completed"
    ]);

    if (endedStatuses.has(String(ride.status || "").trim())) {
      alert("There is no active passenger ride to call.");
      return;
    }

    const passengerPhone = String(
      ride.passengerPhone || ""
    ).trim();

    if (!passengerPhone) {
      alert("Passenger phone number is not available for this ride.");
      return;
    }

    const dialNumber = passengerPhone.replace(/[^\d+]/g, "");

    if (!dialNumber) {
      alert("Passenger phone number is invalid.");
      return;
    }

    window.location.href = "tel:" + dialNumber;
  } catch (error) {
    console.error("Call passenger error:", error);
    alert("Unable to open the passenger phone number right now.");
  }
}

window.callCurrentPassenger = callCurrentPassenger;
