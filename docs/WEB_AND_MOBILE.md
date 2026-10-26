# Vocalis AI web and mobile experience

## Landing site

The public route (`/`) is a responsive Vocalis AI product page. It includes a pointer-reactive canvas scene, animated voice orb, reduced-motion support, glass navigation and demo controls, a sample transcript, a theme switch, and feature/metric sections. The displayed call is scripted and explicitly labeled as a local simulation. Its metrics distinguish design targets from measured production results.

The `/app` route retains the authenticated call dashboard, settings, call history, and backend simulator. A `VITE_API_BASE_URL` build variable lets a Capacitor app use a deployed API origin; leave it blank for same-origin web hosting.

## Web app installation

`public/manifest.webmanifest`, PNG/SVG icons, Apple touch icon, and `public/sw.js` enable the PWA install flow and cache the app shell. Browsers require a secure origin such as HTTPS for service-worker installation; localhost is allowed during development. iOS users add the site from Safari's Share menu. Android users can install from Chrome's prompt/menu when supported.

## Native project shells

`capacitor.config.ts` targets `com.vocalis.ai`, with generated projects in `android/` and `ios/`. Run `npm run mobile:sync` after changing the web app. `npm run mobile:android` and `npm run mobile:ios` sync assets and open the native IDE.

These folders are app source projects, not store-ready binaries. Android packaging needs Android Studio/SDK and a signing key for release builds. iOS packaging requires macOS, Xcode, Apple signing, and App Store Connect setup. Store publication and review remain separate steps. The local/simulated sample call works without a phone provider; actual inbound call answering still depends on the Twilio/Firebase/carrier configuration in the original README.
