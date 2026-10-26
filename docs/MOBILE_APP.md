# Vocalis AI mobile app

The web version is installable as a Progressive Web App (PWA) on compatible iOS and Android browsers. It has a web manifest, standalone display mode, install controls, an offline app-shell fallback, and responsive phone layouts.

## Install the web app

- **iPhone/iPad:** open the deployed HTTPS site in Safari, tap Share, then choose **Add to Home Screen**.
- **Android:** open the deployed HTTPS site in Chrome and choose **Install app** from the browser prompt or menu.

The browser install action is not available on every browser/device combination. The page shows platform-specific instructions when a browser cannot trigger a native install prompt.

An Android debug-preview APK is available at `downloads/vocalis-android-preview.apk` and from the website's mobile section. It uses the standard development signing key and is for testing only; it is not a Play Store release. Its dashboard needs a deployed API configured with `VITE_API_BASE_URL` before a fresh build.

## Build native iOS and Android shells

Capacitor is configured for app ID `com.vocalis.ai`. On a machine with Android Studio/SDK or macOS with Xcode installed:

```sh
npm install
npm run mobile:android
# or, on macOS with Xcode:
npm run mobile:ios
```

These commands build the web app, copy assets into the native project, and open the platform IDE. For repeated asset sync, use `npm run mobile:sync`.

PWA installation works without app-store publication. Publishing native store builds still requires signing keys, Apple/Google developer accounts, store review, and platform build environments. iOS builds require macOS and Xcode. The native shells do not add carrier call access by themselves; live phone answering still needs the documented voice provider, Firebase credentials, and call-forwarding configuration.
