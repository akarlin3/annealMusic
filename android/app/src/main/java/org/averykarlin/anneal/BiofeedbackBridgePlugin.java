package org.averykarlin.anneal;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Random;

@CapacitorPlugin(name = "BiofeedbackBridge")
public class BiofeedbackBridgePlugin extends Plugin {
    private static final String TAG = "BiofeedbackBridgePlugin";
    private Handler mockHandler;
    private Runnable mockRunnable;
    private final Random random = new Random();

    @PluginMethod
    public void startScan(PluginCall call) {
        JSArray devices = new JSArray();
        JSObject devObj = new JSObject();
        devObj.put("id", "polar-h10-mock-android-uuid");
        devObj.put("name", "Polar H10 (Android Mock)");
        devObj.put("rssi", -62);
        devices.put(devObj);

        JSObject notifyObj = new JSObject();
        notifyObj.put("devices", devices);
        notifyListeners("discoverDevice", notifyObj);

        JSObject ret = new JSObject();
        ret.put("status", "scanning");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", "idle");
        call.resolve(ret);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        final String deviceId = call.getString("deviceId");
        if (deviceId == null) {
            call.reject("Missing deviceId");
            return;
        }

        stopMockStreaming();

        mockHandler = new Handler(Looper.getMainLooper());
        mockRunnable = new Runnable() {
            @Override
            public void run() {
                int hr = 68 + random.nextInt(11);
                int rr = (int) (60000.0 / hr) + random.nextInt(21) - 10;

                JSObject channelsObj = new JSObject();
                
                JSObject hrObj = new JSObject();
                hrObj.put("value", hr);
                hrObj.put("unit", "bpm");
                channelsObj.put("heart_rate", hrObj);

                JSObject rrObj = new JSObject();
                rrObj.put("value", rr);
                rrObj.put("unit", "rr_ms");
                channelsObj.put("hrv", rrObj);

                JSObject frame = new JSObject();
                frame.put("deviceId", deviceId);
                frame.put("timestamp", System.currentTimeMillis());
                frame.put("channels", channelsObj);

                notifyListeners("biosignalFrame", frame);

                if (mockHandler != null) {
                    mockHandler.postDelayed(this, 1000);
                }
            }
        };

        mockHandler.post(mockRunnable);

        JSObject ret = new JSObject();
        ret.put("status", "connected");
        call.resolve(ret);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        stopMockStreaming();
        JSObject ret = new JSObject();
        ret.put("status", "disconnected");
        call.resolve(ret);
    }

    private void stopMockStreaming() {
        if (mockHandler != null && mockRunnable != null) {
            mockHandler.removeCallbacks(mockRunnable);
            mockHandler = null;
            mockRunnable = null;
        }
    }
}
