import Foundation
import Capacitor

open class CapacitorPluginBase: CAPPlugin {
    @objc open func checkPlatform(_ call: CAPPluginCall) {
        call.resolve(["platform": "ios"])
    }
    
    @objc open func getLifecycleState(_ call: CAPPluginCall) {
        let active = UIApplication.shared.applicationState == .active
        call.resolve(["isActive": active])
    }
}
