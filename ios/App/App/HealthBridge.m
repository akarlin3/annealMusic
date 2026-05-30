#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HealthBridgePlugin, "HealthBridge",
           CAP_PLUGIN_METHOD(requestPermission, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(logMindfulSession, CAPPluginReturnPromise);
)
