# Collaborative Sessions (Jam Mode)

Anneal Ambiance v1.8 introduces **Jam Mode**, a real-time collaborative sculpting experience. Two users (or more in future releases) can co-create and sculpt a single sound field simultaneously across the internet.

---

## 1. Core Architecture

To make real-time interaction viable over typical residential internet and mobile connections, Jam Mode uses a **State-Synced, Audio-Local** architecture.

```
       +---------------------------------------------+
       |               FastAPI Signaling             |
       |             (SDP / ICE & WS Relay)          |
       +-------+-----------------------------+-------+
               | WebRTC Offer                | WebRTC Answer
               v                             v
     +---------+---------+         +---------+---------+
     |   Client A (Host) |<=======>|   Client B (Peer) |
     |  (Local synthesis) | WebRTC  |  (Local synthesis) |
     +---------+---------+   P2P   +---------+---------+
               |                             |
               | Fetch WAV                   | Fetch WAV
               +-------------> Captures <----+
                               Storage
```

### Audio-Local Synthesis

- **No audio streams** are transmitted between participants. Relaying high-fidelity, multi-channel stems in real time creates massive bandwidth demands and latency issues.
- Instead, each participant runs the **synthesis engine locally** using their own browser's Web Audio context.
- The parameters, active engine selection, arc configuration, and loop configurations are synchronized. What A tweaks, B hears instantly on their own machine.

### State Synchronization (Yjs CRDT)

- State changes are modeled using **Yjs**, a high-performance Conflict-free Replicated Data Type (CRDT) library.
- Updates are bidirectionally bound to the local Zustand parameter store (`useParamStore`), using an anti-looping guard to prevent change echoes from infinite feedback loops.

---

## 2. Transport Architecture & Fallback

Reliable connectivity is achieved using a dual-transport failover design:

1. **Primary: WebRTC (Peer-to-Peer)**
   - Clients attempt to negotiate a direct peer-to-peer data connection using `y-webrtc` and public STUN servers.
   - P2P connections offer near-zero latency (< 50ms) for real-time parameter tweaking.
2. **Fallback: WebSockets (Server Relayed)**
   - If direct P2P connection fails to negotiate within **5 seconds** (commonly due to strict corporate firewalls or symmetric NATs), the client automatically falls back to standard WebSockets (`y-websocket`) relayed through our FastAPI server.
   - This ensures collaboration succeeds under any network condition without requiring expensive TURN server hosting.

---

## 3. Loop Capture Sharing

In Anneal Ambiance, users can capture audio loops into slots (A, B, C). When a user records a loop in a collaborative session:

1. The local client encodes the captured AudioBuffer to standard PCM WAV bytes.
2. The WAV binary is uploaded to the backend captures storage (`POST /api/v1/captures`).
3. The resulting `capture_id` reference is committed to the shared Yjs CRDT loop slot map.
4. The remote partner detects the new `capture_id` in the CRDT, fetches the WAV bytes, decodes them locally, and loads them into their synthesis slot automatically within ~3 seconds.

---

## 4. Multi-Attribution & Co-creation

Collaborating partners can save their sound field as a shared patch:

- The **Save Patch** dialog detects if a jam session is active and provides a **"Save as Shared Collab"** toggle.
- When checked, the patch is submitted to `POST /api/v1/jam-sessions/{id}/save-patch`.
- The backend co-attributes the patch to both users in the database using the `patch_collaborators` junction table.
- When loaded, both users are featured as co-authors in the patch gallery.

---

## 5. UI Controls

### Jam Indicator (Top Pill)

A sleek, glassmorphic pill located at the top center of the screen shows:

- Active participants with their assigned UI colors and Lissajous avatars.
- Connection status and network mode (e.g., `P2P Link` or `Relayed`).
- An actions dropdown for copying invite links, saving shared patches, or ending the jam session.

### Participant Cursors

- When your partner tweaks a slider, a glowing border and their initials/name tag overlay will appear on the parameter control in real time.
- The indicator is non-intrusive and automatically fades out 800ms after their last interaction.

---

## 6. Capacitor Mobile Support

For mobile devices, a `reconnect-on-resume` listener tracks application visibility state. When the native Capacitor app returns from background, it automatically reconnects the signaling transport and synchronizes the latest state instantly.
