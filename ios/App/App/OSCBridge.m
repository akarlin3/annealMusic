#import <Capacitor/Capacitor.h>

CAP_PLUGIN(OSCBridgePlugin, "OSCBridge",
           CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(send, CAPPluginReturnPromise);
)
