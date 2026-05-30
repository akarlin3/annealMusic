#!/usr/bin/env node
/* eslint-disable */
import { WebSocketServer, WebSocket } from 'ws';
import * as dgram from 'dgram';

// Options parsing
const args = process.argv.slice(2);
let wsPort = 8766;
let udpInPort = 8765;
let udpOutPort = 9000;
let udpHost = '127.0.0.1';
let host = '127.0.0.1';
let logLevel = 'info';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--ws-port' && args[i + 1]) {
    wsPort = parseInt(args[++i], 10);
  } else if (arg === '--udp-in' && args[i + 1]) {
    udpInPort = parseInt(args[++i], 10);
  } else if (arg === '--udp-out' && args[i + 1]) {
    udpOutPort = parseInt(args[++i], 10);
  } else if (arg === '--udp-host' && args[i + 1]) {
    udpHost = args[++i];
  } else if (arg === '--host' && args[i + 1]) {
    host = args[++i];
  } else if (arg === '--log-level' && args[i + 1]) {
    logLevel = args[++i];
  }
}

// Log utility
function log(level: string, ...msg: any[]) {
  const levels = ['debug', 'info', 'warn', 'error'];
  if (levels.indexOf(level) >= levels.indexOf(logLevel)) {
    const color =
      level === 'error'
        ? '\x1b[31m'
        : level === 'warn'
          ? '\x1b[33m'
          : '\x1b[32m';
    console.log(`${color}[${level.toUpperCase()}]\x1b[0m`, ...msg);
  }
}

// Print startup Banner
console.log(`
\x1b[36m   ___                                 __  ___           _     
  / _ | ___  ___  ___ ___ _ / / / _ \\ / ___  ___  ___ _ / /   
 / __ |/ _ \\/ _ \\/ -_) _ \`/ / / / // / (_ / / _ \\/ _ \`/ /     
/_/ |_/_//_/_//_/\\__/\\_,_/_/_/_/____/ \\___/_//_/\\_,_/_/      
\x1b[35m  Bidirectional OSC v5.1 Bridge Helper Console\x1b[0m
`);

if (host !== '127.0.0.1') {
  log(
    'warn',
    `SECURITY WARNING: Binding helper externally to ${host}. Ensure your network interface is firewalled!`,
  );
}

// Custom OSC encoder
export function encodeOsc(address: string, oscArgs: any[]): Buffer {
  const buffers: Buffer[] = [];

  const addrBuf = Buffer.from(address, 'utf-8');
  buffers.push(addrBuf);
  const addrPadLen = 4 - (addrBuf.length % 4);
  buffers.push(Buffer.alloc(addrPadLen, 0));

  let typeString = ',';
  const argBufs: Buffer[] = [];

  oscArgs.forEach((arg) => {
    if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        typeString += 'i';
        const b = Buffer.alloc(4);
        b.writeInt32BE(arg, 0);
        argBufs.push(b);
      } else {
        typeString += 'f';
        const b = Buffer.alloc(4);
        b.writeFloatBE(arg, 0);
        argBufs.push(b);
      }
    } else if (typeof arg === 'string') {
      typeString += 's';
      const b = Buffer.from(arg, 'utf-8');
      const pad = 4 - (b.length % 4);
      argBufs.push(b, Buffer.alloc(pad, 0));
    } else if (
      Array.isArray(arg) ||
      arg instanceof Uint8Array ||
      arg instanceof ArrayBuffer
    ) {
      typeString += 'b';
      const raw = arg instanceof Uint8Array ? arg : new Uint8Array(arg as any);
      const sizeBuf = Buffer.alloc(4);
      sizeBuf.writeInt32BE(raw.length, 0);
      argBufs.push(sizeBuf);

      const payload = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
      argBufs.push(payload);

      const pad = raw.byteLength % 4 === 0 ? 0 : 4 - (raw.byteLength % 4);
      if (pad > 0) {
        argBufs.push(Buffer.alloc(pad, 0));
      }
    } else {
      typeString += 's';
      const str = String(arg);
      const b = Buffer.from(str, 'utf-8');
      const pad = 4 - (b.length % 4);
      argBufs.push(b, Buffer.alloc(pad, 0));
    }
  });

  const typeBuf = Buffer.from(typeString, 'utf-8');
  buffers.push(typeBuf);
  const typePadLen = 4 - (typeBuf.length % 4);
  buffers.push(Buffer.alloc(typePadLen, 0));

  buffers.push(...argBufs);

  return Buffer.concat(buffers);
}

// Custom OSC decoder
export function decodeOsc(buf: Buffer): { address: string; args: any[] } {
  let offset = 0;

  const readString = (): string => {
    const start = offset;
    while (offset < buf.length && buf[offset] !== 0) {
      offset++;
    }
    const str = buf.toString('utf-8', start, offset);
    offset++;
    offset = Math.ceil(offset / 4) * 4;
    return str;
  };

  const address = readString();
  const typeTags = readString();

  const oscArgs: any[] = [];
  if (typeTags.startsWith(',')) {
    for (let i = 1; i < typeTags.length; i++) {
      const tag = typeTags[i];
      if (tag === 'i') {
        const val = buf.readInt32BE(offset);
        oscArgs.push(val);
        offset += 4;
      } else if (tag === 'f') {
        const val = buf.readFloatBE(offset);
        oscArgs.push(val);
        offset += 4;
      } else if (tag === 's') {
        oscArgs.push(readString());
      } else if (tag === 'b') {
        const size = buf.readInt32BE(offset);
        offset += 4;
        const blob = buf.subarray(offset, offset + size);
        oscArgs.push(Array.from(blob));
        offset += size;
        offset = Math.ceil(offset / 4) * 4;
      }
    }
  }

  return { address, args: oscArgs };
}

// Threat Model Rate-limiting maps
const ipBurstTracker = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(remoteIp: string): boolean {
  const now = Date.now();
  const tracker = ipBurstTracker.get(remoteIp) ?? {
    count: 0,
    resetTime: now + 1000,
  };

  if (now > tracker.resetTime) {
    tracker.count = 0;
    tracker.resetTime = now + 1000;
  }

  tracker.count++;
  ipBurstTracker.set(remoteIp, tracker);

  return tracker.count > 100; // Limit to 100 packets/sec
}

let wss: WebSocketServer | null = null;
let udpSocket: dgram.Socket | null = null;

if (process.env.NODE_ENV !== 'test') {
  // Start WebSocket Server
  wss = new WebSocketServer({ port: wsPort, host });
  log('info', `WebSocket Server listening on ws://${host}:${wsPort}`);

  // Start UDP socket client/server
  udpSocket = dgram.createSocket('udp4');

  udpSocket.on('listening', () => {
    const address = udpSocket!.address();
    log('info', `UDP Server listening on ${address.address}:${address.port}`);
  });

  udpSocket.on('message', (msg, rinfo) => {
    // 1. Security Check: UDP packet size limits
    if (msg.length > 65535) {
      log(
        'warn',
        `Packet discarded: Size exceeds maximum limit of 65535 bytes from ${rinfo.address}`,
      );
      return;
    }

    // 2. Security Check: Rate limiting
    if (isRateLimited(rinfo.address)) {
      log(
        'warn',
        `Rate Limit Exceeded: dropping packets from source IP ${rinfo.address}`,
      );
      return;
    }

    try {
      const decoded = decodeOsc(msg);

      // 3. Security Check: Conforming address mapping characters
      if (!/^\/anneal\/[a-zA-Z0-9_\-\/]+$/.test(decoded.address)) {
        log(
          'warn',
          `Packet discarded: Non-conforming OSC Address characters in "${decoded.address}"`,
        );
        return;
      }

      // 4. Security Check: Max arguments count
      if (decoded.args.length > 64) {
        log(
          'warn',
          `Packet discarded: Args count ${decoded.args.length} exceeds max capacity limit of 64`,
        );
        return;
      }

      // Broadcast incoming UDP OSC packet as JSON to all connected WS clients
      const frame = JSON.stringify({
        address: decoded.address,
        args: decoded.args,
      });
      wss!.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(frame);
        }
      });

      log(
        'debug',
        `UDP -> WS: ${decoded.address} with ${decoded.args.length} args`,
      );
    } catch (e) {
      log('warn', `Discarded malformed OSC UDP packet from ${rinfo.address}`);
    }
  });

  wss.on('connection', (ws, req) => {
    const remoteIp = req.socket.remoteAddress ?? 'unknown';
    log('info', `New WebSocket client connection established from ${remoteIp}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.address && Array.isArray(data.args)) {
          // Forward outgoing WS JSON messages as UDP OSC packets
          const encoded = encodeOsc(data.address, data.args);
          udpSocket!.send(encoded, udpOutPort, udpHost, (err) => {
            if (err) {
              log(
                'error',
                `Failed to send UDP OSC packet to ${udpHost}:${udpOutPort}`,
                err,
              );
            }
          });
          log('debug', `WS -> UDP: ${data.address}`);
        }
      } catch (e) {
        log('warn', 'Failed to process incoming WebSocket frame', e);
      }
    });

    ws.on('close', () => {
      log('info', `WebSocket client connection closed for ${remoteIp}`);
    });
  });

  udpSocket.bind(udpInPort, host);
}
