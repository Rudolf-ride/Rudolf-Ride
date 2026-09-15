"use strict";

// =====================================
// RUDOLF RIDE DRIVER APP - FULL SCRIPT
// =====================================

const CURRENT_RIDE_KEY = "rudolfCurrentRide";
const DRIVER_ONLINE_KEY = "rudolfDriverOnline";
const DRIVER_RIDES_KEY = "rudolfDriverRides";
const DRIVER_LOCATION_KEY = "rudolfDriverLocation";

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
        "Accept Ride",
        "accept-btn",
        acceptRide
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "Decline",
        "decline-btn",
        declineRide
      )
    );

    return;
  }

  if (isAccepted(ride.status)) {
    buttonBox.appendChild(
      createRideButton(
        "Start Driving",
        "accept-btn",
        driverOnTheWay
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "Cancel Ride",
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
        "Arrived at Pickup",
        "accept-btn",
        arriveAtPickup
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "Cancel Ride",
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
        "Start Trip",
        "accept-btn",
        startTrip
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "Cancel Ride",
        "decline-btn",
        declineRide
      )
    );

    return;
  }

  if (ride.status === "Trip started") {
    buttonBox.appendChild(
      createRideButton(
        "Complete Trip",
        "accept-btn",
        completeTrip
      )
    );

    buttonBox.appendChild(
      createRideButton(
        "Cancel Ride",
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

  if (ride.status === "Driver accepted your ride") {
    rideStatus.textContent = "Ride accepted ✓";
  } else {
    rideStatus.textContent =
      ride.status || "New ride request";
  }

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

  // ADD DRIVER EARNINGS
  const earnings =
    Number(ride.fare) || 0;

  let todayEarnings =
    Number(
      localStorage.getItem(
        "rudolfDriverEarnings"
      )
    ) || 0;

  todayEarnings += earnings;

  localStorage.setItem(
    "rudolfDriverEarnings",
    todayEarnings
  );
  saveCompletedRide(ride);

// SEND COMPLETED STATUS TO PASSENGER FIRST
saveCurrentRide(ride);

window.rudolfCloud.write(
  CURRENT_RIDE_KEY,
  ride
);

// Clear after passenger receives update
setTimeout(function () {

  localStorage.removeItem(
    CURRENT_RIDE_KEY
  );

  window.rudolfCloud.write(
    CURRENT_RIDE_KEY,
    null
  );

}, 3000);
  lastRideSignature = null;
loadCurrentRide();

renderDriverRides();
loadTodayActivity();
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

  setTimeout(function () {
    resetDriverForNextRide();
  }, 1500);
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
  }
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

  const todayRides =
    rides.filter(function (ride) {
      return isDateToday(
        ride.completedAt ||
        ride.completedDate ||
        ride.date ||
        ride.createdAt ||
        ride.updatedAt
      );
    });

  const completedRides =
    todayRides.filter(function (ride) {
      return (
        ride.status ===
        "Ride completed"
      );
    });

  const totalEarnings =
    completedRides.reduce(
      function (total, ride) {
        const fare = Number(
          String(
            ride.fare === undefined
              ? 0
              : ride.fare
          ).replace(
            /[^0-9.-]/g,
            ""
          )
        );

        return (
          total +
          (
            Number.isFinite(fare)
              ? fare
              : 0
          )
        );
      },
      0
    );

  const ridesElement =
    document.getElementById(
      "today-rides"
    );

  const completedElement =
    document.getElementById(
      "today-completed"
    );

  const earningsElement =
    document.getElementById(
      "today-earnings"
    );

  if (ridesElement) {
    ridesElement.textContent =
      todayRides.length;
  }

  if (completedElement) {
    completedElement.textContent =
      completedRides.length;
  }

  if (earningsElement) {
    earningsElement.textContent =
      "GH₵ " +
      totalEarnings.toFixed(2);
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

  const navItems =
    document.querySelectorAll(
      ".driver-bottom-nav .nav-item"
    );

  if (homeSection) {
    homeSection.style.display =
      section === "home"
        ? "block"
        : "none";
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

  const sectionOrder = [
    "home",
    "rides",
    "profile"
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

startDriverCloudRideListener();
/* =====================================
   RUDOLF RIDE — NEW RIDE RINGTONE
===================================== */

const rideRingtone = new Audio("old-bell.mp3");
rideRingtone.loop = true;
rideRingtone.preload = "auto";

function playRideRingtone() {
  rideRingtone.currentTime = 0;

  rideRingtone.play()
    .then(function () {
      alert("🔊 SOUND STARTED");
    })
    .catch(function (error) {
      alert(
        "SOUND ERROR: " +
        error.name +
        " - " +
        error.message
      );
      console.error("RINGTONE ERROR:", error);
    });
}

function stopRideRingtone() {
  rideRingtone.pause();
  rideRingtone.currentTime = 0;
}



console.log("RUDOLF RINGTONE CODE LOADED");
alert("🔔 RINGTONE CODE LOADED");

