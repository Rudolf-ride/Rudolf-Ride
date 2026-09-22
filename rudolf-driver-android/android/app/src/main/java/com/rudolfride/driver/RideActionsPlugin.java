package com.rudolfride.driver;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RideActions")
public class RideActionsPlugin extends Plugin {
    @PluginMethod
    public synchronized void takeAction(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
                "rudolfOverlayAction", Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("rideId", prefs.getString("rideId", ""));
        result.put("action", prefs.getString("action", ""));
        result.put("expiresAt", prefs.getLong("expiresAt", 0));
        if (!prefs.edit().clear().commit()) {
            call.reject("Could not consume ride action");
            return;
        }
        call.resolve(result);
    }
}
