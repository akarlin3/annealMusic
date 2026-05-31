import Foundation
import Capacitor
import CoreBluetooth

@objc(BiofeedbackBridgePlugin)
public class BiofeedbackBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiofeedbackBridgePlugin"
    public let jsName = "BiofeedbackBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]
    
    private var mockTimer: Timer?
    
    @objc func startScan(_ call: CAPPluginCall) {
        var devices: [[String: Any]] = []
        devices.append([
            "id": "polar-h10-mock-uuid",
            "name": "Polar H10 (Mock)",
            "rssi": -65
        ])
        
        self.notifyListeners("discoverDevice", data: [
            "devices": devices
        ])
        
        call.resolve(["status": "scanning"])
    }
    
    @objc func stopScan(_ call: CAPPluginCall) {
        call.resolve(["status": "idle"])
    }
    
    @objc func connect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId") else {
            call.reject("Missing deviceId")
            return
        }
        
        mockTimer?.invalidate()
        mockTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            let hr = Int.random(in: 68...78)
            let rr = Int(60000.0 / Double(hr)) + Int.random(in: -10...10)
            
            self?.notifyListeners("biosignalFrame", data: [
                "deviceId": deviceId,
                "timestamp": Int(Date().timeIntervalSince1970 * 1000),
                "channels": [
                    "heart_rate": [
                        "value": hr,
                        "unit": "bpm"
                    ],
                    "hrv": [
                        "value": rr,
                        "unit": "rr_ms"
                    ]
                ]
            ])
        }
        
        call.resolve(["status": "connected"])
    }
    
    @objc func disconnect(_ call: CAPPluginCall) {
        mockTimer?.invalidate()
        mockTimer = nil
        call.resolve(["status": "disconnected"])
    }
}
