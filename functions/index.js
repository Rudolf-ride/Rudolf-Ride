const { onValueCreated } = require(
  "firebase-functions/v2/database"
);

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

    if (ride.status !== "Searching for driver") {
      console.log(
        "Ride is not waiting for a driver:",
        ride.status
      );
      return;
    }

    const pickup =
      ride.pickup || "Passenger pickup";

    const destination =
      ride.destination || "Destination";

    const fare =
      ride.fare ?? "";


    const rideType =

      ride.rideType ||

      ride.selectedRide ||

      "Rudolf Ride";

    const subscriptionId =
      "db6c81f6-a53d-4567-8d9e-db37a4a21393";

    const response = await fetch(
      "https://paystack-backend-gamma.vercel.app/send-driver-notification",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup,
          destination,
          fare,
          rideType,
          rideId: String(ride.id || ride.createdAt || ""),
          subscriptionId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OneSignal notification failed:",
        response.status,
        data
      );

      throw new Error(
        "OneSignal notification request failed"
      );
    }

    console.log(
      "OneSignal driver notification sent:",
      data
    );
  }
);
