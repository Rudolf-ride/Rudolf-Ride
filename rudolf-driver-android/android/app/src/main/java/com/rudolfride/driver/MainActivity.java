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

        // RUDOLF_OVERLAY_PERMISSION_SETUP
        if (!android.provider.Settings.canDrawOverlays(this)
                && savedInstanceState == null) {
            new android.app.AlertDialog.Builder(this)
                    .setTitle("Enable ride popups")
                    .setMessage(
                            "Allow Rudolf Ride to display over other apps "
                            + "for incoming ride popups. Select Rudolf Ride "
                            + "in Settings and enable the permission."
                    )
                    .setPositiveButton("Open settings", (dialog, which) -> {
                        try {
                            startActivity(new android.content.Intent(
                                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    android.net.Uri.parse("package:" + getPackageName())
                            ));
                        } catch (android.content.ActivityNotFoundException e) {
                            Toast.makeText(
                                    this,
                                    "Overlay settings are unavailable on this device.",
                                    Toast.LENGTH_LONG
                            ).show();
                        }
                    })
                    .setNegativeButton("Later", null)
                    .show();
        }


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
