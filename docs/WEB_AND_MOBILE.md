# Vocalis AI web and mobile experience

## Live web application

The `/` page shows the server-reported Firebase, Ollama, and Twilio configuration status. The phone assistant does not include an in-browser call simulator or fabricated call history. The `/app` dashboard signs in with Firebase Google Authentication and displays only real Twilio inbound calls saved to the signed-in Firebase account.

The Twilio voice webhook handles speech turns at `/api/twilio/voice` and `/api/twilio/turn`. It uses the configured Ollama model and stores text transcripts and call summaries in Firestore. The backend does not save audio. An unavailable model produces a spoken unavailability message and ends the call; it does not substitute a scripted pretend response.

Live answering depends on provider and deployment configuration described in the [README](../README.md). The dashboard's readiness checks cover Firebase client/server configuration, Ollama model reachability, and required Twilio environment settings. The app cannot verify the Twilio Console webhook selection or whether the mobile carrier has enabled forwarding.

A `VITE_API_BASE_URL` build variable lets a Capacitor app use a deployed API origin; leave it blank for same-origin web hosting. Configure `API_PROXY_TARGET` only when the local API uses a non-default port.

## Web app installation

`public/manifest.webmanifest`, PNG/SVG icons, Apple touch icon, and `public/sw.js` enable the PWA install flow and cache the app shell. Browsers require a secure origin such as HTTPS for service-worker installation; localhost is allowed during development. iOS users add the site from Safari's Share menu. Android users can install from Chrome's prompt/menu when supported.

Installing the PWA provides dashboard access. It does not intercept cellular calls or enable phone forwarding; configure that with your carrier and Twilio.

## Native project shells

`capacitor.config.ts` targets `com.vocalis.ai`, with generated projects in `android/` and `ios/`. Run `npm run mobile:sync` after changing the web app. `npm run mobile:android` and `npm run mobile:ios` sync assets and open the native IDE.

These folders are app source projects, not store-ready binaries. Android packaging needs Android Studio/SDK and a signing key for release builds. iOS packaging requires macOS, Xcode, Apple signing, and App Store Connect setup. Store publication and review remain separate steps. The included Android APK is a development build and needs a configured backend to access call records.
