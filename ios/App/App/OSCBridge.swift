import Foundation
import Capacitor
import Network

@objc(OSCBridgePlugin)
public class OSCBridgePlugin: CapacitorPluginBase, CAPBridgedPlugin {
    public let identifier = "OSCBridgePlugin"
    public let jsName = "OSCBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise)
    ]
    
    private var listener: NWListener?
    private var connection: NWConnection?
    private var sendHost: String = "127.0.0.1"
    private var sendPort: UInt16 = 9000
    
    @objc func start(_ call: CAPPluginCall) {
        let portVal = call.getInt("port") ?? 8765
        let hostVal = call.getString("sendHost") ?? "127.0.0.1"
        let sendPortVal = call.getInt("sendPort") ?? 9000
        
        self.sendHost = hostVal
        self.sendPort = UInt16(sendPortVal)
        
        do {
            let port = NWEndpoint.Port(rawValue: UInt16(portVal))!
            let params = NWParameters.udp
            self.listener = try NWListener(using: params, on: port)
            
            self.listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("[OSCBridgePlugin] Listener ready on port \(portVal)")
                case .failed(let error):
                    print("[OSCBridgePlugin] Listener failed: \(error)")
                default:
                    break
                }
            }
            
            self.listener?.newConnectionHandler = { [weak self] newConnection in
                self?.handleIncomingConnection(newConnection)
            }
            
            self.listener?.start(queue: .global())
            call.resolve()
        } catch {
            call.reject("Failed to start UDP listener: \(error.localizedDescription)")
        }
    }
    
    @objc func stop(_ call: CAPPluginCall) {
        self.listener?.cancel()
        self.listener = nil
        self.connection?.cancel()
        self.connection = nil
        call.resolve()
    }
    
    @objc func send(_ call: CAPPluginCall) {
        guard let address = call.getString("address"),
              let args = call.getArray("args") else {
            call.reject("Missing address or args")
            return
        }
        
        let ip = NWEndpoint.Host(self.sendHost)
        let port = NWEndpoint.Port(rawValue: self.sendPort)!
        
        let conn = NWConnection(host: ip, port: port, using: .udp)
        conn.start(queue: .global())
        
        let data = encodeOsc(address: address, args: args)
        
        conn.send(content: data, completion: .contentProcessed({ error in
            conn.cancel()
            if let error = error {
                call.reject("Failed to send UDP packet: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }))
    }
    
    private func handleIncomingConnection(_ conn: NWConnection) {
        conn.start(queue: .global())
        conn.receiveMessage { [weak self] (content, context, isComplete, error) in
            if let data = content, !data.isEmpty {
                self?.parseAndNotify(data)
            }
            conn.cancel()
        }
    }
    
    private func parseAndNotify(_ data: Data) {
        let bytes = [UInt8](data)
        var offset = 0
        
        func readString() -> String? {
            let start = offset
            while offset < bytes.count && bytes[offset] != 0 {
                offset += 1
            }
            if offset >= bytes.count { return nil }
            let str = String(bytes: bytes[start..<offset], encoding: .utf8)
            offset += 1
            offset = ((offset + 3) / 4) * 4
            return str
        }
        
        guard let address = readString(),
              let typeTags = readString() else {
            return
        }
        
        var args: [Any] = []
        if typeTags.hasPrefix(",") {
            let tags = Array(typeTags.dropFirst())
            for tag in tags {
                if tag == "i" {
                    guard offset + 4 <= bytes.count else { return }
                    let val = data.subdata(in: offset..<offset+4).withUnsafeBytes {
                        Int32(bigEndian: $0.load(as: Int32.self))
                    }
                    args.append(Int(val))
                    offset += 4
                } else if tag == "f" {
                    guard offset + 4 <= bytes.count else { return }
                    let val = data.subdata(in: offset..<offset+4).withUnsafeBytes {
                        Float(bitPattern: UInt32(bigEndian: $0.load(as: UInt32.self)))
                    }
                    args.append(Double(val))
                    offset += 4
                } else if tag == "s" {
                    if let str = readString() {
                        args.append(str)
                    } else {
                        return
                    }
                }
            }
        }
        
        self.notifyListeners("oscMessage", data: [
            "address": address,
            "args": args
        ])
    }
    
    private func encodeOsc(address: String, args: [Any]) -> Data {
        var data = Data()
        
        func writeString(_ str: String) {
            guard let buf = str.data(using: .utf8) else { return }
            data.append(buf)
            data.append(0)
            let pad = 4 - (data.count % 4)
            if pad < 4 {
                data.append(Data(repeating: 0, count: pad))
            }
        }
        
        writeString(address)
        
        var typeString = ","
        var argData = Data()
        
        for arg in args {
            if let val = arg as? Int {
                typeString.append("i")
                var bigInt = Int32(val).bigEndian
                let bytes = withUnsafeBytes(of: &bigInt) { Data($0) }
                argData.append(bytes)
            } else if let val = arg as? Double {
                typeString.append("f")
                var bigFloat = Float(val).bitPattern.bigEndian
                let bytes = withUnsafeBytes(of: &bigFloat) { Data($0) }
                argData.append(bytes)
            } else if let val = arg as? Float {
                typeString.append("f")
                var bigFloat = val.bitPattern.bigEndian
                let bytes = withUnsafeBytes(of: &bigFloat) { Data($0) }
                argData.append(bytes)
            } else if let val = arg as? String {
                typeString.append("s")
                let strBuf = val.data(using: .utf8) ?? Data()
                argData.append(strBuf)
                argData.append(0)
                let pad = 4 - (argData.count % 4)
                if pad < 4 {
                    argData.append(Data(repeating: 0, count: pad))
                }
            }
        }
        
        writeString(typeString)
        data.append(argData)
        
        return data
    }
}
