package co.annealmusic.plugins

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Random

@CapacitorPlugin(name = "BiofeedbackBridge")
class BiofeedbackBridge : Plugin() {
    private var mockHandler: Handler? = null
    private var mockRunnable: Runnable? = null
    private val random = Random()

    @PluginMethod
    fun startScan(call: PluginCall) {
        val devices = JSArray()
        val devObj = JSObject()
        devObj.put("id", "polar-h10-mock-android-uuid")
        devObj.put("name", "Polar H10 (Android Mock)")
        devObj.put("rssi", -62)
        devices.put(devObj)

        val notifyObj = JSObject()
        notifyObj.put("devices", devices)
        notifyListeners("discoverDevice", notifyObj)

        val ret = JSObject()
        ret.put("status", "scanning")
        call.resolve(ret);
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        val ret = JSObject()
        ret.put("status", "idle")
        call.resolve(ret)
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val deviceId = call.getString("deviceId")
        if (deviceId == null) {
            call.reject("Missing deviceId")
            return
        }

        stopMockStreaming()

        mockHandler = Handler(Looper.getMainLooper())
        mockRunnable = object : Runnable {
            override fun run() {
                val hr = 68 + random.nextInt(11)
                val rr = (60000.0 / hr).toInt() + random.nextInt(21) - 10

                val channelsObj = JSObject()
                
                val hrObj = JSObject()
                hrObj.put("value", hr)
                hrObj.put("unit", "bpm")
                channelsObj.put("heart_rate", hrObj)

                val rrObj = JSObject()
                rrObj.put("value", rr)
                rrObj.put("unit", "rr_ms")
                channelsObj.put("hrv", rrObj)

                val frame = JSObject()
                frame.put("deviceId", deviceId)
                frame.put("timestamp", System.currentTimeMillis())
                frame.put("channels", channelsObj)

                notifyListeners("biosignalFrame", frame)

                mockHandler?.postDelayed(this, 1000)
            }
        }

        mockHandler?.post(mockRunnable!!)

        val ret = JSObject()
        ret.put("status", "connected")
        call.resolve(ret)
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        stopMockStreaming()
        val ret = JSObject()
        ret.put("status", "disconnected")
        call.resolve(ret)
    }

    private fun stopMockStreaming() {
        mockRunnable?.let { mockHandler?.removeCallbacks(it) }
        mockHandler = null
        mockRunnable = null
    }
}
