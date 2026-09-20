package com.rudolfride.driver;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class RideAlertActivity extends Activity {

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return (int) (value * density);
    }

    private TextView makeText(
            String text,
            float size,
            boolean bold,
            int color
    ) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setPadding(dp(18), dp(14), dp(18), dp(14));

        if (bold) {
            view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        }

        return view;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        /*
         * Wake/show screen support.
         * This activity is NOT connected to OneSignal yet.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        String pickup = getIntent().getStringExtra("pickup");
        String destination = getIntent().getStringExtra("destination");
        String fare = getIntent().getStringExtra("fare");

        if (pickup == null || pickup.trim().isEmpty()) {
            pickup = "Pickup location";
        }

        if (destination == null || destination.trim().isEmpty()) {
            destination = "Destination";
        }

        if (fare == null || fare.trim().isEmpty()) {
            fare = "GH₵ --";
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        /*
         * GREEN RUDOLF RIDE HEADER
         */
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setGravity(Gravity.CENTER);
        header.setPadding(dp(20), dp(30), dp(20), dp(26));
        header.setBackgroundColor(Color.rgb(0, 170, 90));

        TextView title = makeText(
                "Rudolf Ride",
                32,
                true,
                Color.WHITE
        );
        title.setGravity(Gravity.CENTER);

        TextView driverLabel = makeText(
                "DRIVER",
                15,
                true,
                Color.WHITE
        );
        driverLabel.setGravity(Gravity.CENTER);

        header.addView(title);
        header.addView(driverLabel);

        root.addView(
                header,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        /*
         * BLACK NEW RIDE BAR
         */
        TextView requestTitle = makeText(
                "NEW RIDE REQUEST",
                20,
                true,
                Color.WHITE
        );
        requestTitle.setGravity(Gravity.CENTER);
        requestTitle.setBackgroundColor(Color.rgb(17, 24, 39));

        root.addView(
                requestTitle,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        dp(68)
                )
        );

        /*
         * RIDE INFORMATION
         */
        LinearLayout details = new LinearLayout(this);
        details.setOrientation(LinearLayout.VERTICAL);
        details.setPadding(dp(18), dp(20), dp(18), dp(10));

        TextView pickupLabel = makeText(
                "PICKUP",
                13,
                true,
                Color.DKGRAY
        );

        TextView pickupValue = makeText(
                pickup,
                20,
                true,
                Color.BLACK
        );

        TextView destinationLabel = makeText(
                "DESTINATION",
                13,
                true,
                Color.DKGRAY
        );

        TextView destinationValue = makeText(
                destination,
                20,
                true,
                Color.BLACK
        );

        TextView fareLabel = makeText(
                "FARE",
                13,
                true,
                Color.DKGRAY
        );

        TextView fareValue = makeText(
                fare,
                30,
                true,
                Color.rgb(0, 150, 80)
        );

        details.addView(pickupLabel);
        details.addView(pickupValue);
        details.addView(destinationLabel);
        details.addView(destinationValue);
        details.addView(fareLabel);
        details.addView(fareValue);

        root.addView(
                details,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        0,
                        1f
                )
        );

        /*
         * BUTTON AREA
         */
        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(dp(18), dp(12), dp(18), dp(24));

        Button decline = new Button(this);
        decline.setText("DECLINE");
        decline.setTextSize(17);
        decline.setTypeface(Typeface.DEFAULT, Typeface.BOLD);

        Button accept = new Button(this);
        accept.setText("ACCEPT");
        accept.setTextSize(17);
        accept.setTypeface(Typeface.DEFAULT, Typeface.BOLD);

        LinearLayout.LayoutParams buttonParams =
                new LinearLayout.LayoutParams(
                        0,
                        dp(64),
                        1f
                );

        buttonParams.setMargins(dp(5), 0, dp(5), 0);

        buttons.addView(decline, buttonParams);
        buttons.addView(accept, buttonParams);

        root.addView(
                buttons,
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                )
        );

        /*
         * TEMPORARY behavior for Stage 1.
         * We are testing ONLY the screen.
         */
        decline.setOnClickListener(v -> finish());
        accept.setOnClickListener(v -> finish());

        setContentView(root);
    }
}
