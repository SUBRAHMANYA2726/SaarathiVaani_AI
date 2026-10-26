# Saarathi Vaani AI

Saarathi Vaani is a transparent AI call assistant prototype. It gives you a working local dashboard and call simulator today, and includes a signed Twilio voice webhook for real unanswered calls after you connect your Firebase project, deploy the server over HTTPS, and configure call forwarding with your carrier or voice provider.

The assistant identifies itself as AI, can take a concise message or callback request, and saves a summary for the signed-in account. It must not claim that it booked an appointment, transferred a call, or completed another action unless that action is actually integrated and confirmed.

## Run the local prototype

Requirements: Node.js 20 or later and npm.

```sh
npm install
npm run dev
```

Open the Vite address printed in the terminal (normally `http://127.0.0.1:5173`). Choose **Use local demo** or start a test call. The test call exercises the dashboard, safe message-taking responses, and the local call log. It does not place or receive a carrier phone call.

By default the prototype uses a deterministic local reply engine, so an AI service is not needed. To use a local Ollama model, start Ollama and set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env`.

## Google sign-in and per-user cloud data

1. Create a Firebase project and enable Google as an Authentication provider.
2. Create a Firestore database and register a web app.
3. Copy `.env.example` to `.env`. Set `FIREBASE_WEB_CONFIG` to the Firebase web app configuration.
4. Configure backend Application Default Credentials or set `FIREBASE_SERVICE_ACCOUNT` to the service-account JSON for local development. Set `FIREBASE_PROJECT_ID` when needed. Keep credentials private and out of source control.
5. Install the rules in `firestore.rules`.

The API verifies Firebase ID tokens and reads/writes call records only under `users/{uid}/calls`; approved instructions are stored under `users/{uid}/settings/assistant`. Local demo calls and settings are stored in ignored files under `work/data/`. The backend uses the Admin SDK and therefore bypasses Firestore rules; the API's token verification and UID-scoped paths are the access boundary for these server requests.

## Connect live inbound calls

The server includes Twilio-compatible endpoints at `/api/twilio/voice` and `/api/twilio/turn`. To use them:

1. Deploy the app on a public HTTPS host that can reach Firebase and (optionally) Ollama.
2. Set `PUBLIC_BASE_URL`, `TWILIO_AUTH_TOKEN`, `TWILIO_OWNER_UID`, Firebase Admin credentials, and the production environment values.
3. Configure the Twilio number's incoming voice webhook to `https://YOUR_HOST/api/twilio/voice` using HTTP POST.
4. Enable unanswered-call forwarding from your phone line to that Twilio number, after checking your carrier's forwarding options and charges.
5. Place a controlled test call and confirm the AI disclosure, transcript, and account call summary.

The Twilio SDK validates request signatures before handling voice webhooks. The first greeting discloses AI use. The prototype does not record audio; Twilio speech recognition supplies text to the assistant. Real calls require a Twilio number/account, a reachable HTTPS deployment, Firebase credentials, and carrier forwarding. None of these external services is provisioned by this repository.

## Build and verify

```sh
npm run typecheck
npm run build
npm start
```

`npm start` serves the built app and API on port `4174`. In production, set `NODE_ENV=production`; local demo authentication is then disabled.

## Project documents

See `docs/PRD.md`, `docs/SRS.md`, and `docs/IMPLEMENTATION_PLAN.md` for the product requirements, system requirements, and staged delivery plan. PDF editions are included in `docs/pdfs/`.

## Current limits

- The local demo is usable without third-party credentials; it is not a replacement for carrier forwarding.
- Google sign-in and cloud persistence require a Firebase project and server credentials.
- Live answering requires a Twilio account or compatible provider, a public HTTPS deployment, and working call forwarding.
- Local demo instructions are stored on the device; signed-in instructions use a UID-scoped Firestore settings document.
- Ollama is optional. If it is unavailable or returns an error, the server falls back to its deterministic safe responses.

## Security

Do not commit `.env`, service-account keys, caller records, or phone numbers. Review `SECURITY.md` before exposing a deployment publicly.
