import Foundation
import Capacitor
import HealthKit

@objc(HealthBridgePlugin)
public class HealthBridgePlugin: CapacitorPluginBase, CAPBridgedPlugin {
    public let identifier = "HealthBridgePlugin"
    public let jsName = "HealthBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logMindfulSession", returnType: CAPPluginReturnPromise)
    ]
    
    private let healthStore = HKHealthStore()
    
    @objc func requestPermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        
        guard let mindfulType = HKObjectType.categoryType(forIdentifier: .mindfulSession) else {
            call.reject("Mindful session type is not available")
            return
        }
        
        let writeTypes: Set<HKSampleType> = [mindfulType]
        
        healthStore.requestAuthorization(toShare: writeTypes, read: nil) { (success, error) in
            if success {
                call.resolve(["granted": true])
            } else {
                call.reject(error?.localizedDescription ?? "Permission denied")
            }
        }
    }
    
    @objc func logMindfulSession(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }
        
        guard let mindfulType = HKObjectType.categoryType(forIdentifier: .mindfulSession) else {
            call.reject("Mindful session type is not available")
            return
        }
        
        guard let startDateString = call.getString("startDate"),
              let endDateString = call.getString("endDate") else {
            call.reject("Missing startDate or endDate")
            return
        }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var start = formatter.date(from: startDateString)
        if start == nil {
            formatter.formatOptions = [.withInternetDateTime]
            start = formatter.date(from: startDateString)
        }
        
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var end = formatter.date(from: endDateString)
        if end == nil {
            formatter.formatOptions = [.withInternetDateTime]
            end = formatter.date(from: endDateString)
        }
        
        guard let startDate = start, let endDate = end else {
            call.reject("Invalid date format")
            return
        }
        
        let sample = HKCategorySample(
            type: mindfulType,
            value: HKCategoryValue.notApplicable.rawValue,
            start: startDate,
            end: endDate
        )
        
        healthStore.save(sample) { (success, error) in
            if success {
                call.resolve(["success": true])
            } else {
                call.reject(error?.localizedDescription ?? "Failed to save sample")
            }
        }
    }
}
