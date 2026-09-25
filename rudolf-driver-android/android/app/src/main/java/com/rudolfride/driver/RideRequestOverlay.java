package com.rudolfride.driver;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class RideRequestOverlay {
    private static final String TAG = "RudolfRideOverlay";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static WindowManager manager;
    private static View panel;
    private static String lastId;
    private static final Runnable TIMEOUT = RideRequestOverlay::hide;

    private RideRequestOverlay() {}

    public static void show(
            Context context, String id, String pickup,
            String destination, String fare, String rideType, String rideId) {
        Context app = context.getApplicationContext();
        MAIN.post(() -> {
            try {
                if (!Settings.canDrawOverlays(app)) {
                    Log.w(TAG, "Overlay permission not granted");
                    return;
                }
                if (id != null && id.equals(lastId)) {
                    return;
                }
                hide();
                display(app, pickup, destination, fare, rideType, rideId);
                lastId = id;
            } catch (RuntimeException error) {
                Log.e(TAG, "Could not display ride overlay", error);
                hide();
            }
        });
    }

    private static int dp(Context context, int value) {
        return Math.round(
                value * context.getResources().getDisplayMetrics().density
        );
    }

    private static TextView text(
            Context context, String value, int size, boolean bold) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.rgb(17, 24, 39));
        view.setPadding(dp(context, 16), dp(context, 6),
                dp(context, 16), dp(context, 6));
        if (bold) {
            view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        }
        return view;
    }

    private static String value(String input, String fallback) {
        return input == null || input.trim().isEmpty()
                ? fallback : input.trim();
    }

    private static void display(
            Context app, String pickup, String destination, String fare, String rideType, String rideId) {
        Context context = new ContextThemeWrapper(
                app, android.R.style.Theme_Material_Light_NoActionBar
        );
        manager = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        if (manager == null) {
            throw new IllegalStateException("Window manager unavailable");
        }

        LinearLayout root = new LinearLayout(context);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setElevation(dp(context, 12));

        TextView title = text(context, "Rudolf Ride — NEW REQUEST", 24, true);
        title.setTextColor(Color.WHITE);
        title.setBackgroundColor(Color.rgb(0, 150, 80));
        root.addView(title);

        ScrollView scroll = new ScrollView(context);
        LinearLayout details = new LinearLayout(context);
        details.setOrientation(LinearLayout.VERTICAL);

        details.addView(text(context, "PICKUP", 16, true));
        details.addView(text(context, value(pickup, "Pickup location"), 22, false));

        // 3R DYNAMIC RIDE TYPE — NEW VIEW ONLY
        String rideKey = value(rideType, "Rudolf Ride").toLowerCase(java.util.Locale.ROOT);

        String rideCard =
                rideKey.contains("comfort") ? "🚙\nRudolf Comfort\nExtra comfort for your journey" :
                rideKey.contains("xl") ? "🚐\nRudolf XL\nMore space for passengers and luggage" :
                rideKey.contains("economy") ? "🚘\nRudolf Economy\nAffordable everyday ride" :
                "🚘\nRudolf Ride\nPassenger selected ride";

        TextView rideTypeView = text(context, rideCard, 18, false);
        rideTypeView.setGravity(android.view.Gravity.CENTER);
        rideTypeView.setPadding(dp(context, 16), dp(context, 18),
                dp(context, 16), dp(context, 10));

        details.addView(rideTypeView);

        View detailSpacer = new View(context);
        details.addView(detailSpacer, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        details.addView(text(context, "DESTINATION", 16, true));
        details.addView(text(context, value(destination, "Destination"), 26, false));

        String amount = value(fare, "GH₵ --");
        if (amount.matches("[0-9]+([.][0-9]+)?")) {
            amount = "GH₵ " + amount;
        }
        details.addView(text(context, "FARE: " + amount, 27, true));
        scroll.addView(details);
        scroll.setFillViewport(true);

        root.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        // RUDOLF_OVERLAY_ACTION_BUTTONS
        LinearLayout actions = new LinearLayout(context);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(dp(context, 12), dp(context, 4),
                dp(context, 12), dp(context, 4));

        Button decline = new Button(context);
        decline.setText("DECLINE");
        decline.setTextColor(Color.WHITE);
        decline.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(
                        Color.rgb(185, 28, 28)));
        decline.setEnabled(rideId != null && !rideId.trim().isEmpty()); decline.setOnClickListener(v -> { if (RideOverlayActions.submit(app, rideId, "decline")) hide(); });
        actions.addView(decline, new LinearLayout.LayoutParams(
                0, dp(context, 56), 1f));

        Button accept = new Button(context);
        accept.setText("ACCEPT");
        accept.setTextColor(Color.WHITE);
        accept.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(
                        Color.rgb(0, 150, 80)));
        accept.setEnabled(rideId != null && !rideId.trim().isEmpty()); accept.setOnClickListener(v -> { if (RideOverlayActions.submit(app, rideId, "accept")) hide(); });
        LinearLayout.LayoutParams acceptParams =
                new LinearLayout.LayoutParams(
                        0, dp(context, 56), 1f);
        acceptParams.leftMargin = dp(context, 10);
        actions.addView(accept, acceptParams);

        root.addView(actions);
        root.addView(text(context,
                "Tap Accept or Decline to continue in the driver app.", 14, false));

        Button close = new Button(context);
        close.setText("CLOSE");
        close.setTextSize(18);
        close.setOnClickListener(view -> hide());
        root.addView(close, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(context, 52)
        ));

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        int screenHeight;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            screenHeight = manager.getMaximumWindowMetrics().getBounds().height();
        } else {
            android.util.DisplayMetrics metrics = new android.util.DisplayMetrics();
            manager.getDefaultDisplay().getMetrics(metrics);
            screenHeight = metrics.heightPixels;
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.setTitle("Rudolf Ride request");

        panel = root;
        manager.addView(root, params);
        MAIN.postDelayed(TIMEOUT, 45000);
        Log.i(TAG, "Ride overlay displayed");
    }

    private static void hide() {
        MAIN.removeCallbacks(TIMEOUT);
        if (manager != null && panel != null) {
            try {
                manager.removeViewImmediate(panel);
            } catch (RuntimeException error) {
                Log.w(TAG, "Overlay removal failed", error);
            }
        }
        panel = null;
        manager = null;
    }
}
