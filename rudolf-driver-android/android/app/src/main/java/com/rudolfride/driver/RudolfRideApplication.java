package com.rudolfride.driver;

import android.app.Application;

import com.onesignal.Continue;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;

public class RudolfRideApplication extends Application {

    private static final String ONESIGNAL_APP_ID =
            "37313947-2360-4bf3-ab26-21310fced263";

    @Override
    public void onCreate() {
        super.onCreate();

        OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);

        OneSignal.initWithContext(
                this,
                ONESIGNAL_APP_ID
        );

        OneSignal.getNotifications()
                .requestPermission(
                        false,
                        Continue.none()
                );
    }
}
