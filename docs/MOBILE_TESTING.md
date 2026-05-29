# Mobile App Testing Playbook

This document details the exact smoke-testing checklist to verify mobile shell functionality across platforms before store submission.

---

## 1. Physical Device Matrix

| OS          | Version | Device Model       | Test Type            |
| :---------- | :------ | :----------------- | :------------------- |
| **iOS**     | 15.0+   | iPhone XS or newer | Physical + simulator |
| **Android** | 10.0+   | API 29+ device     | Physical + emulator  |

---

## 2. Interactive Verification Matrix

### Phase 1: Web Audio Synthesis & Sculpting

- [ ] **T01 — Engine Toggle**: Cycle through all seven engines (Sine, FM, Physical, Granular, etc.). Confirm audio plays with clear, artifact-free synthesis.
- [ ] **T02 — Sculpture Drag**: Touch-drag across the visualizer grid. Confirm immediate real-time parameter changes without audio clicks, pops, or stutters.
- [ ] **T03 — Presets Panel**: Load a preset. Confirm that all sliders and the engine select swap to match the preset instantly.

### Phase 2: Native Capabilities & Permissions

- [ ] **T04 — Mic Permission Prompt**: Tap the microphone "Connect Input" button on a fresh install. Confirm the native iOS/Android microphone permission prompt surfaces once.
- [ ] **T05 — Capture Live Loop**: Speak or whistle, then trigger a loop capture. Verify that the capture records, loops, and plays back inside the shared post-fx chain.
- [ ] **T06 — Denied Permission Redirection**: Deny microphone permissions, then tap Connect Input again. Confirm that the UI handles the denied state gracefully and displays a "Open Settings" button that directs the user to the native app settings page.

### Phase 3: Audio State & Interruption

- [ ] **T07 — Background Audio**: Play a patch, then lock the device or switch to the home screen. Verify that the ambient generator continues playing indefinitely.
- [ ] **T08 — Incoming Call (iOS/Android)**: Play audio and simulate an incoming call (or call the device). Confirm that playback fades out in 200ms when the call begins, and fades back in when the call is ended/declined.
- [ ] **T09 — Media Session Takeover**: Play audio, then open Spotify/Apple Music and press play. Confirm that Spotify begins playing and Anneal Ambiance pauses cleanly.
- [ ] **T10 — Headphone Disconnection**: Unplug wired headphones or turn off Bluetooth AirPods while audio plays. Verify that playback pauses immediately as expected.

### Phase 4: Linking & Auth Round-Trip

- [ ] **T11 — Universal Links (/p/\*)**: Tap a patch link (e.g. `https://anneal.averykarlin.org/p/warm-fields`) in a different app. Confirm that the Anneal Ambiance app opens and immediately boots into the target patch.
- [ ] **T12 — Magic Link Auth**: Request an email magic link from the app. Open the email in the mail client and tap the verify button. Verify that the app opens, verifies the token, shows a successful toast, and establishes the logged-in session.
- [ ] **T13 — Account Deletion**: Go to Settings -> Danger Zone -> Delete Account. Verify that the account, sessions, and preferences are purged, and the app resets to unauthenticated guest mode.
