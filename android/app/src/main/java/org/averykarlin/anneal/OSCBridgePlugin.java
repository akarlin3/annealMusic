package org.averykarlin.anneal;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OSCBridge")
public class OSCBridgePlugin extends CapacitorPluginBase {
    private static final String TAG = "OSCBridgePlugin";
    private DatagramSocket rxSocket;
    private ExecutorService rxExecutor;
    private boolean rxRunning = false;
    private String sendHost = "127.0.0.1";
    private int sendPort = 9000;

    @PluginMethod
    public void start(PluginCall call) {
        int rxPortVal = call.getInt("port", 8765);
        this.sendHost = call.getString("sendHost", "127.0.0.1");
        this.sendPort = call.getInt("sendPort", 9000);

        try {
            stopInternal();
            
            this.rxSocket = new DatagramSocket(rxPortVal);
            this.rxSocket.setReuseAddress(true);
            this.rxRunning = true;
            this.rxExecutor = Executors.newSingleThreadExecutor();

            this.rxExecutor.submit(() -> {
                byte[] buffer = new byte[65535];
                while (rxRunning && rxSocket != null && !rxSocket.isClosed()) {
                    try {
                        DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                        rxSocket.receive(packet);
                        parseAndNotify(packet.getData(), packet.getLength());
                    } catch (Exception e) {
                        if (rxRunning) {
                            Log.e(TAG, "Error in UDP receive loop", e);
                        }
                    }
                }
            });

            Log.i(TAG, "Started UDP listener on port " + rxPortVal);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start UDP socket", e);
            call.reject("Failed to start UDP socket: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            stopInternal();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop socket: " + e.getMessage());
        }
    }

    private void stopInternal() {
        this.rxRunning = false;
        if (this.rxSocket != null) {
            this.rxSocket.close();
            this.rxSocket = null;
        }
        if (this.rxExecutor != null) {
            this.rxExecutor.shutdownNow();
            this.rxExecutor = null;
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        String address = call.getString("address");
        JSArray args = call.getArray("args");

        if (address == null || args == null) {
            call.reject("Missing address or args");
            return;
        }

        try {
            List<Object> argsList = args.toList();
            byte[] encoded = encodeOsc(address, argsList);

            Executors.newSingleThreadExecutor().submit(() -> {
                try {
                    DatagramSocket txSocket = new DatagramSocket();
                    InetAddress destAddr = InetAddress.getByName(this.sendHost);
                    DatagramPacket packet = new DatagramPacket(encoded, encoded.length, destAddr, this.sendPort);
                    txSocket.send(packet);
                    txSocket.close();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to transmit UDP packet", e);
                }
            });

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to queue transmit packet: " + e.getMessage());
        }
    }

    private void parseAndNotify(byte[] data, int length) {
        try {
            ByteBuffer buffer = ByteBuffer.wrap(data, 0, length).order(ByteOrder.BIG_ENDIAN);
            
            String address = readString(buffer);
            String typeTags = readString(buffer);

            JSArray argsArr = new JSArray();
            if (typeTags != null && typeTags.startsWith(",")) {
                for (int i = 1; i < typeTags.length(); i++) {
                    char tag = typeTags.charAt(i);
                    if (tag == 'i') {
                        argsArr.put(buffer.getInt());
                    } else if (tag == 'f') {
                        argsArr.put((double) buffer.getFloat());
                    } else if (tag == 's') {
                        argsArr.put(readString(buffer));
                    }
                }
            }

            JSObject notifyObj = new JSObject();
            notifyObj.put("address", address);
            notifyObj.put("args", argsArr);

            notifyListeners("oscMessage", notifyObj);
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse incoming UDP OSC packet", e);
        }
    }

    private String readString(ByteBuffer buffer) {
        int start = buffer.position();
        while (buffer.hasRemaining() && buffer.get() != 0) {}
        int end = buffer.position() - 1;
        
        int len = end - start;
        byte[] bytes = new byte[len];
        buffer.position(start);
        buffer.get(bytes);
        buffer.get(); // skip null terminator

        // Align to 4
        int pad = 4 - ((len + 1) % 4);
        if (pad < 4) {
            for (int i = 0; i < pad; i++) {
                buffer.get();
            }
        }

        return new String(bytes, StandardCharsets.UTF_8);
    }

    private byte[] encodeOsc(String address, List<Object> args) {
        ByteBuffer buffer = ByteBuffer.allocate(65535).order(ByteOrder.BIG_ENDIAN);

        writeString(buffer, address);

        StringBuilder typeTagsBuilder = new StringBuilder(",");
        ByteBuffer argsBuffer = ByteBuffer.allocate(65535).order(ByteOrder.BIG_ENDIAN);

        for (Object arg : args) {
            if (arg instanceof Integer) {
                typeTagsBuilder.append("i");
                argsBuffer.putInt((Integer) arg);
            } else if (arg instanceof Double) {
                typeTagsBuilder.append("f");
                argsBuffer.putFloat(((Double) arg).floatValue());
            } else if (arg instanceof Float) {
                typeTagsBuilder.append("f");
                argsBuffer.putFloat((Float) arg);
            } else if (arg instanceof String) {
                typeTagsBuilder.append("s");
                writeString(argsBuffer, (String) arg);
            }
        }

        writeString(buffer, typeTagsBuilder.toString());
        
        argsBuffer.flip();
        byte[] argsBytes = new byte[argsBuffer.remaining()];
        argsBuffer.get(argsBytes);
        buffer.put(argsBytes);

        buffer.flip();
        byte[] finalBytes = new byte[buffer.remaining()];
        buffer.get(finalBytes);
        
        return finalBytes;
    }

    private void writeString(ByteBuffer buffer, String str) {
        byte[] bytes = str.getBytes(StandardCharsets.UTF_8);
        buffer.put(bytes);
        buffer.put((byte) 0);
        int pad = 4 - ((bytes.length + 1) % 4);
        if (pad < 4) {
            for (int i = 0; i < pad; i++) {
                buffer.put((byte) 0);
            }
        }
    }
}
