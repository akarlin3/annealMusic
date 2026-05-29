# Mobile Build Playbook (iOS & Android)

This playbook describes the developer workflow, code signing, compilation, and continuous delivery setups for the Capacitor iOS and Android app shells.

---

## 1. Single Source of Truth Versioning

We use `package.json` `"version"` as the single source of truth:

- **Android**: `android/app/build.gradle` dynamically parses `package.json` to inject `versionName`, and derives `versionCode` from the monotonically increasing git commit count.
- **iOS**: Xcode handles this dynamically via standard plist modifications before compile or can be bumped via PlistBuddy or Xcode target configuration.

---

## 2. iOS Compilation & Distribution (Local-only)

To compile and distribute iOS builds to TestFlight:

### Prerequisites

- macOS with **Xcode 15+** installed.
- An active Apple Developer Account.
- **Cocoapods** installed (if plugin dependencies require it).

### Execution Steps

1. **Compile Web Bundle**:
   ```bash
   npm run build:mobile
   ```
2. **Sync Capacitor**:
   ```bash
   npx cap sync ios
   ```
3. **Launch Xcode**:
   ```bash
   npx cap open ios
   ```
4. **Code Signing**:
   - Open the `App` target in Xcode.
   - Under **Signing & Capabilities**, check "Automatically manage signing" and select your developer team.
5. **Archive & Upload**:
   - Select **Any iOS Device (arm64)** as the run target.
   - Select **Product ▸ Archive** from the top menu.
   - Once finished, click **Distribute App** in the Organizer window and choose **TestFlight / App Store Connect**.

---

## 3. Android Compilation & CD (CI/CD)

We support both manual local compiles and fully automated CD pipelines on Git Tag.

### Local Compilation (Manual)

1. **Compile Web Bundle**:
   ```bash
   npm run build:mobile
   ```
2. **Sync Capacitor**:
   ```bash
   npx cap sync android
   ```
3. **Build APK**:

   ```bash
   cd android
   ./gradlew assembleDebug
   ```

   - The debug APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 4. Continuous Integration / CD (Firebase App Distribution)

When a release tag matching `v*` is pushed to GitHub, the `.github/workflows/android.yml` action:

1. Clones the repository and counts git revisions to compute `versionCode`.
2. Installs npm dependencies and runs `npm run build:mobile`.
3. Runs `npx cap sync android`.
4. Sets up Java 17 and compiles a signed release APK.
5. Deploys the release APK directly to **Firebase App Distribution** for the `internal-testers` group.
