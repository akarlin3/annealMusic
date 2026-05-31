#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BiofeedbackBridgePlugin, "BiofeedbackBridge",
           CAP_PLUGIN_METHOD(startScan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopScan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connect, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disconnect, CAPPluginReturnPromise);
)
