const { onValueCreated } = require(
  "firebase-functions/v2/database"
);

const { initializeApp } = require(
  "firebase-admin/app"
);

const { getDatabase } = require(
  "firebase-admin/database"
);

const { getMessaging } = require(
  "firebase-admin/messaging"
);

initializeApp();

exports.sendNewRideNotification = onValueCreated(
  {
    ref: "/rudolfCurrentRide",
    region: "europe-west1",
  },
  async (event) => {
    const ride = event.data.val();

    if (!ride) {
      console.log("No ride data found.");
      return;
    }

    const tokenSnapshot = await getDatabase()
      .ref("/driverNotificationTokens/main/token")
      .get();

    if (!tokenSnapshot.exists()) {
      console.log("No driver notification token found.");
      return;
    }

    const token = tokenSnapshot.val();

    const pickup = ride.pickup || "Passenger pickup";
    const destination =
      ride.destination || "Destination";

    const message = {
      token: token,

      notification: {
        title: "🚗 New Rudolf Ride Request",
        body: `${pickup} → ${destination}`,
      },

      data: {
        type: "new_ride",
        rideId: String(
          ride.id || ride.createdAt || ""
        ),
      },

      webpush: {
        notification: {
          requireInteraction: true,
          tag: "rudolf-new-ride",
        },

        fcmOptions: {
          link: "/driver.html",
        },
      },
    };

    const response = await getMessaging().send(message);

    console.log(
      "New ride notification sent:",
      response
    );
  }
);
