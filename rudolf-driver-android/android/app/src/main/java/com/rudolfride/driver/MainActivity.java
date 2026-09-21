package com.rudolfride.driver;

import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        boolean allowed = true;

        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager notificationManager =
                    getSystemService(NotificationManager.class);

            allowed =
                    notificationManager != null &&
                    notificationManager.canUseFullScreenIntent();
        }

        Toast.makeText(
                this,
                "Full-screen intent allowed: " +
                        (allowed ? "YES" : "NO"),
                Toast.LENGTH_LONG
        ).show();
    }
}
