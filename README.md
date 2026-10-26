# Vocalis AI

Vocalis AI is a real inbound-call assistant application. The web dashboard has no simulated dialer or fabricated call history. It receives unanswered calls through a configured Twilio voice number, discloses that it is an AI assistant, uses a reachable Ollama model to respond to callers, and saves call transcripts and summaries in Firestore under the configured Firebase user.

The repository contains the application and provider integration. It does not include Twilio, Firebase, carrier, model-hosting, or deployment credentials, so live calls will remain unavailable until you connect those services.

## Run locally

Requirements: Node.js 20 or later and npm.

```sh
npm install
npm run dev
```

The Vite page normally opens at `http://127.0.0.1:5173`; the API runs on port `4174`. Copy `.env.example` to `.env` and configure Firebase, Ollama, and Twilio. The `/api/config` endpoint probes whether the selected Ollama model is reachable and reports whether Twilio and Firebase server credentials are configured. The website displays those real readiness results.

## Configure Firebase

1. Create a Firebase project, enable Google Authentication, create Firestore, and register a web app.
2. Set `FIREBASE_WEB_CONFIG` to the web app configuration. This client configuration is public, but must refer to your own project.
3. Give the backend Firebase Admin credentials using `FIREBASE_SERVICE_ACCOUNT`, or set `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_PROJECT_ID` in the deployment environment.
4. Install the rules from `firestore.rules`.
5. Sign in with Google to access the dashboard. The server verifies ID tokens and scopes records to `users/{uid}/calls` and instructions to `users/{uid}/settings/assistant`.

Do not commit Firebase service-account credentials or `.env` files.

## Configure the AI model

Run Ollama somewhere the backend can reach over HTTP. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to the host and an installed model. The server checks `/api/tags` for that model and calls `/api/chat` for caller replies. There is no scripted or deterministic fallback: if the model is not reachable, the phone greeting reports temporary unavailability and ends the call instead of pretending an AI answered.

## Configure real incoming phone calls

1. Deploy the API to a public HTTPS host reachable by Twilio, Firebase, and the Ollama host.
2. Set `PUBLIC_BASE_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `TWILIO_OWNER_UID`. `TWILIO_OWNER_UID` is the Firebase UID that owns the call records.
3. Set the Twilio phone number's incoming voice webhook to `https://YOUR_HOST/api/twilio/voice` using HTTP POST.
4. Configure your mobile carrier or provider to forward unanswered calls to the Twilio number. Forwarding is a manual phone-account setting and is not detectable by this app.
5. Place a call from a phone you control. Verify the AI disclosure, caller speech handling, and saved call record in the signed-in dashboard.

Twilio request signatures are validated before webhooks are handled. Twilio speech recognition supplies text to the AI model; this application does not record caller audio. The current server configuration uses one `TWILIO_OWNER_UID`, so one deployment is configured for one owner's records.

## Install on phones

The website can be installed as a Progressive Web App over HTTPS. On iPhone, open it in Safari and select **Share → Add to Home Screen**. On Android, use Chrome's **Install app** prompt or menu. The included Android APK is a development build; it is not a store release and requires the backend URL and Firebase configuration to be set for use.

Native iOS and Android shells are included through Capacitor. See [`docs/MOBILE_APP.md`](docs/MOBILE_APP.md). Native builds require Android Studio or macOS with Xcode. Store publication requires signing and developer accounts. Set `VITE_API_BASE_URL` before packaging so a native app can reach the deployed API.

## Build

```sh
npm run typecheck
npm run build
npm start
```

`npm start` serves the production build and API on port `4174`. Set `NODE_ENV=production` in deployment. See [`docs/WEB_AND_MOBILE.md`](docs/WEB_AND_MOBILE.md), [`docs/PRD.md`](docs/PRD.md), [`docs/SRS.md`](docs/SRS.md), and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for product and release details.

## Current limits

- Live incoming calls require the external provider credentials and phone-carrier forwarding described above.
- The current voice integration uses Twilio speech recognition and speech playback; it is not a low-latency streaming voice model.
- AI replies depend on the configured Ollama server and model being reachable.
- Call transcripts and summaries are stored as text. Caller audio is not recorded.
- iOS and Android packages need deployment configuration and signing before public release.

## Security

Do not commit `.env`, service-account keys, caller records, or private phone numbers. Review [`SECURITY.md`](SECURITY.md) before exposing a deployment publicly.
