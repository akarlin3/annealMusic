package org.averykarlin.anneal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

public class CapacitorPluginBase extends Plugin {
    @PluginMethod
    public void checkPlatform(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        call.resolve(ret);
    }
}
