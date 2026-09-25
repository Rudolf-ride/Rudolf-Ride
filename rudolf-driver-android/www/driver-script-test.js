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
let driverLocationMap = null;
let driverLocationMarker = null;
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

function toggleDriverAvailability() {
  isOnline = !isOnline;

  localStorage.setItem(
    "rudolfDriverOnline",
    String(isOnline)
  );

  window.rudolfCloud?.write(
  "rudolfDriverAvailability",
  isOnline
);

  updateDriverAvailability();

  if (!isOnline) {
    stopDriverLiveLocation();
  }
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
    rideStatus.textContent =
      ride.status || "New ride request";
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
        if (ride.status === "Searching for driver") {
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

    ride.driver = {
      name: "Rudolf",
      vehicle: "Toyota Corolla",
      plate: "GR 12345",
      rating: 4.8
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
    "position:fixed;inset:0;z-index:100000;overflow:auto;" +
    "box-sizing:border-box;background:#f0f5f4;color:#172b26;" +
    "padding:8px;padding-top:max(8px,env(safe-area-inset-top));" +
    "padding-bottom:max(8px,env(safe-area-inset-bottom));" +
    "font:14px/1.3 system-ui,sans-serif;overscroll-behavior:contain;";

  const card = document.createElement("div");
  card.style.cssText =
    "box-sizing:border-box;max-width:440px;margin:0 auto;" +
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
      "display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid #e5ece9;";
    const title = document.createElement("div");
    title.textContent = label;
    title.style.cssText = "font-size:12px;color:#60736b;";
    const detail = document.createElement("div");
    detail.textContent =
      value === undefined || value === null || value === ""
        ? "Not available" : String(value);
    detail.style.cssText = "min-width:0;font-size:14px;font-weight:600;";
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
    "margin:4px 0;font-size:23px;color:#172b26;");
  heading.id = receiptId + "-title";
  text("p", "✓ Trip completed",
    "margin:0 0 8px;color:#13754b;font-weight:600;");

  row("Completed", ride.completedDateTime);
  row("Trip ID", ride.rideId);
  row("Pickup", ride.pickup);
  row("Destination", ride.destination);
  row("Ride type", ride.rideType);
  row("Total fare", money(ride.totalFare));
  row("Platform fee (15%)", money(ride.platformFee));

  text("div", "Your earnings (85%)",
    "margin-top:10px;color:#13754b;font-weight:600;");
  text("div", money(ride.driverEarnings),
    "font-size:28px;font-weight:800;color:#13754b;");
  text("p", "Trip details saved in Ride History.",
    "font-size:12px;color:#60736b;margin:6px 0 10px;");

  const done = text("button", "DONE",
    "display:block;position:static;width:100%;min-height:44px;" +
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
  const isNewCompletedRide =
    saveCompletedRide(ride);

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

  const alreadySaved =
    rides.some(function (savedRide) {
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

  if (!alreadySaved) {
    rides.push(ride);

    saveStoredObject(
      DRIVER_RIDES_KEY,
      rides
    );

    return true;
  }

  return false;
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
  longitude
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
    driverLocationMap.setView(
      location,
      17
    );

    driverLocationMarker.setLatLng(
      location
    );

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
      )
      .openPopup();

  L.control.layers(
    {
      "Street Map": streetMap,
      "Satellite": satelliteMap
    }
  ).addTo(driverLocationMap);

  setTimeout(function () {
    driverLocationMap.invalidateSize();
  }, 150);
}

function startDriverLiveLocation() {
  const gpsStatus =
    document.getElementById(
      "driver-gps-status"
    );

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

  if (driverLocationWatchId !== null) {
    navigator.geolocation.clearWatch(
      driverLocationWatchId
    );

    driverLocationWatchId = null;
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

        const driverLocation = {
          latitude: latitude,
          longitude: longitude,
          accuracy:
            position.coords.accuracy,
          updatedAt: Date.now()
        };

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
          gpsStatus.textContent =
            "GPS active • Accuracy " +
            Math.round(
              position.coords.accuracy
            ) +
            " metres";
        }

        showDriverLocationMap(
          latitude,
          longitude
        );
      },

      function (error) {
        driverLocationWatchId = null;

        if (gpsStatus) {
          gpsStatus.textContent =
            "Driver GPS error: " +
            error.message;
        }

        alert(
          "Driver GPS error: " +
          error.message +
          " (Code " +
          error.code +
          ")"
        );
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

function showDriverSection(section) {
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

  // RUDOLF AUTO GPS START
  startDriverLiveLocation();

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

  const profile = {
    name: name.trim() || currentName,
    vehicle: vehicle.trim() || currentVehicle,
    plate: plate.trim().toUpperCase() || currentPlate
  };

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
}

window.editDriverProfile = editDriverProfile;

document.addEventListener("DOMContentLoaded", function () {
  applyDriverProfile();
});


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
