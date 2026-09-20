package com.rudolfride.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.Keep;
import androidx.core.app.NotificationCompat;

import com.onesignal.notifications.IDisplayableMutableNotification;
import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.INotificationServiceExtension;

import org.json.JSONObject;

@Keep
public class RideNotificationServiceExtension
        implements INotificationServiceExtension {

    private static final String CHANNEL_ID =
            "rudolf_ride_requests_v1";

    @Override
    public void onNotificationReceived(
            INotificationReceivedEvent event) {

        Context context = event.getContext();

        IDisplayableMutableNotification notification =
                event.getNotification();

        if (context == null || notification == null) {
            return;
        }

        /*
         * High importance channel required for
         * Android full-screen notification intents.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            NotificationManager manager =
                    (NotificationManager)
                            context.getSystemService(
                                    Context.NOTIFICATION_SERVICE
                            );

            if (manager != null) {

                NotificationChannel channel =
                        new NotificationChannel(
                                CHANNEL_ID,
                                "Incoming ride requests",
                                NotificationManager.IMPORTANCE_HIGH
                        );

                channel.setDescription(
                        "Urgent incoming Rudolf Ride requests"
                );

                channel.enableVibration(true);

                channel.setLockscreenVisibility(
                        Notification.VISIBILITY_PUBLIC
                );

                manager.createNotificationChannel(channel);
            }
        }

        /*
         * Read ride information when available.
         * Defaults keep Stage 1 safe even if the
         * backend has not supplied additional data yet.
         */
        JSONObject data = notification.getAdditionalData();

        String pickup = data != null
                ? data.optString(
                        "pickup",
                        "Pickup location"
                )
                : "Pickup location";

        String destination = data != null
                ? data.optString(
                        "destination",
                        "Destination"
                )
                : "Destination";

        String fare = data != null
                ? data.optString(
                        "fare",
                        "GH₵ --"
                )
                : "GH₵ --";

        Intent fullScreenIntent =
                new Intent(
                        context,
                        RideAlertActivity.class
                );

        fullScreenIntent.putExtra(
                "pickup",
                pickup
        );

        fullScreenIntent.putExtra(
                "destination",
                destination
        );

        fullScreenIntent.putExtra(
                "fare",
                fare
        );

        fullScreenIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        String notificationId =
                notification.getNotificationId();

        int requestCode =
                notificationId != null
                        ? notificationId.hashCode()
                        : (int) System.currentTimeMillis();

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        context,
                        requestCode,
                        fullScreenIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT |
                        PendingIntent.FLAG_IMMUTABLE
                );

        notification.setExtender(builder -> {

            builder
                    .setChannelId(CHANNEL_ID)
                    .setPriority(
                            NotificationCompat.PRIORITY_MAX
                    )
                    .setVisibility(
                            NotificationCompat.VISIBILITY_PUBLIC
                    )
                    .setFullScreenIntent(
                            pendingIntent,
                            true
                    );
        });
    }
}
