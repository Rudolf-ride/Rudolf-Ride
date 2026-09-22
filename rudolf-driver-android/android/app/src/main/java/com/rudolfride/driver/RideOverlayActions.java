package com.rudolfride.driver;
import android.content.*;
import android.widget.Toast;
public final class RideOverlayActions {
private RideOverlayActions() {}
public static boolean submit(Context app, String rideId, String action) {
if (rideId == null || rideId.trim().isEmpty()) return false;
if (!"accept".equals(action) && !"decline".equals(action)) return false;
SharedPreferences prefs = app.getSharedPreferences("rudolfOverlayAction", Context.MODE_PRIVATE);
boolean saved = prefs.edit().putString("rideId", rideId).putString("action", action)
.putLong("expiresAt", System.currentTimeMillis() + 45000L).commit();
if (!saved) return false;
try {
Intent intent = new Intent(app, MainActivity.class);
intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
app.startActivity(intent);
return true;
} catch (RuntimeException error) {
prefs.edit().clear().commit();
Toast.makeText(app, "Could not open driver app. Try again.", Toast.LENGTH_LONG).show();
return false;
}
}
}
