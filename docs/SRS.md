# System Requirements Specification

**System:** Saarathi Vaani AI Call Assistant
**Version:** 1.0
**Status:** Prototype specification
**Date:** 26 October 2026

## 1. Purpose

This specification defines the behavior and technical boundaries of the web dashboard, API, local demo, Firebase data path, optional local AI engine, and Twilio-compatible inbound voice bridge. The system is a prototype until external identity, cloud, and phone-provider credentials are configured and verified.

## 2. System context

The browser runs a React/Vite dashboard. It calls a Node.js/TypeScript API. In local demo mode the API stores records in an ignored JSON file under `work/data/`. With Firebase configured, Google sign-in issues an ID token, the API verifies the token with Firebase Admin, and records are read and written under `users/{uid}/calls/{callId}` in Firestore. An optional Ollama service supplies conversational replies. A Twilio voice webhook can deliver speech-to-text turns to the API and receive TwiML spoken responses.

### External systems

- Firebase Authentication: Google sign-in and ID tokens.
- Cloud Firestore: per-user call records.
- Ollama: optional local model endpoint at `/api/chat`.
- Twilio Programmable Voice or a compatible adapter: inbound webhook, speech gather, and spoken response.
- Mobile carrier or telephony provider: unanswered-call forwarding to the configured voice number.

## 3. Runtime and deployment requirements

- Node.js 20 or newer, npm, and a modern browser for local development.
- Development API on port 4174 and Vite UI on port 5173; Vite proxies `/api` to the API.
- Production app build in `dist/`; Node serves the UI and API on the configured `PORT`.
- Production deployment must provide public HTTPS and must set `NODE_ENV=production`.
- Firebase web configuration may be exposed to the client; service-account credentials and provider secrets must remain server-side.
- The API should be deployed behind a trusted HTTPS proxy and must use the externally visible `PUBLIC_BASE_URL` for Twilio signature checks.

## 4. Functional requirements

### 4.1 Dashboard and local demo

| ID | Requirement |
| --- | --- |
| SRS-F-01 | The dashboard shall display an overview, recent calls, assistant status, and links to call history, instructions, and phone setup. |
| SRS-F-02 | A local test call shall begin with an AI identity disclosure. |
| SRS-F-03 | The user shall be able to enter caller utterances and receive assistant replies. |
| SRS-F-04 | The assistant shall take a message or callback request and shall not claim unsupported actions. |
| SRS-F-05 | Ending a test call shall mark the record complete, create an end timestamp, and refresh call history. |
| SRS-F-06 | The call-history page shall show caller, date/time, summary, source, and status, and support text filtering. |
| SRS-F-07 | If the API cannot be reached, the UI shall show an actionable service error. |

### 4.2 Authentication and data access

| ID | Requirement |
| --- | --- |
| SRS-F-08 | When a Firebase web configuration is provided, the UI shall offer Google sign-in through Firebase Authentication. |
| SRS-F-09 | The API shall accept authenticated requests only after verifying the Firebase ID token. |
| SRS-F-10 | The API shall construct each Firestore path from the UID returned by token verification. |
| SRS-F-11 | If Firebase Admin is unavailable, an authenticated cloud request shall fail with a configuration error and shall not silently fall back to shared local data. |
| SRS-F-12 | Development demo mode shall be accepted only outside production and shall use the `demo-local` store. |
| SRS-F-13 | Local demo records shall be written to `work/data/demo-calls.json` by default and excluded from Git. |

### 4.3 AI response behavior

| ID | Requirement |
| --- | --- |
| SRS-F-14 | Without Ollama configuration, the API shall use deterministic message-taking responses. |
| SRS-F-15 | With Ollama configured, the API shall submit a short caller turn with a bounded instruction prompt and use a 20-second request timeout. |
| SRS-F-16 | A failed, empty, or timed-out Ollama response shall fall back to the deterministic reply path. |
| SRS-F-17 | Emergency and sensitive-credential patterns shall receive safe responses. |
| SRS-F-18 | The model prompt shall prohibit claiming transfer, appointment booking, availability checks, or other unintegrated actions. |

### 4.4 Live call adapter

| ID | Requirement |
| --- | --- |
| SRS-F-19 | `/api/twilio/voice` shall reject requests with missing or invalid Twilio signatures using the Twilio SDK validator. |
| SRS-F-20 | A verified inbound request shall require configured Firebase Admin credentials and a configured owner UID. |
| SRS-F-21 | The initial TwiML response shall disclose AI use before gathering caller speech. |
| SRS-F-22 | `/api/twilio/turn` shall validate each signature, associate the turn with its call ID, respond with spoken text, and save transcript and summary to the configured owner's record. |
| SRS-F-23 | An empty speech result shall end the call with a short closing response and save the record as complete. |
| SRS-F-24 | The application shall not record or persist audio in the current prototype. |
| SRS-F-25 | Approved instructions shall be stored and read from the current user's Firestore settings document, or from a device-local settings file in demo mode. |

## 5. API contracts

All JSON routes use UTF-8 JSON except Twilio endpoints, which use form-encoded input and return `text/xml`.

| Method and path | Authentication | Purpose |
| --- | --- | --- |
| `GET /api/health` | None | Returns API and optional service configuration status. |
| `GET /api/config` | None | Returns public Firebase client config and demo/provider readiness booleans. |
| `GET /api/calls` | Firebase token or development demo header | Returns only the current user's recent records. |
| `GET /api/settings` | Firebase token or development demo header | Returns the current user's approved assistant instructions. |
| `PUT /api/settings` | Firebase token or development demo header | Saves approved instructions for the current user. |
| `POST /api/demo/calls` | Firebase token or development demo header | Creates a test call and initial disclosure turn. |
| `POST /api/demo/calls/:id/turn` | Firebase token or development demo header | Saves a caller turn and returns the assistant reply. |
| `POST /api/demo/calls/:id/end` | Firebase token or development demo header | Completes a test call and persists its summary. |
| `POST /api/twilio/voice` | Twilio signature | Starts an inbound voice session and returns disclosure plus speech gather. |
| `POST /api/twilio/turn` | Twilio signature | Processes a recognized speech turn and returns spoken TwiML. |

## 6. Data model

### Call record

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Random local call ID or provider call SID. |
| `caller` | string | Provider-supplied caller number/name or a demo label. |
| `status` | `active` or `completed` | Current conversation state. |
| `createdAt` | ISO-8601 string | Start timestamp. |
| `endedAt` | ISO-8601 string, optional | Completion timestamp. |
| `summary` | string | Concise caller-intent text, currently derived from caller turns. |
| `turns` | array | Caller and assistant text turns with timestamps. |
| `source` | `demo` or `twilio` | Indicates local test or phone provider origin. |

Cloud path: `users/{verifiedUid}/calls/{callId}`. Local file root: `{ "demo-local": [CallRecord, ...] }`.

## 7. Security and privacy requirements

- Never accept a caller-supplied UID as the authorization boundary.
- Never store Firebase service accounts, Twilio tokens, `.env` contents, or local call data in Git.
- Use Firebase Admin token verification and per-user Firestore document paths.
- Use HTTPS for production, and use exact public URL configuration for signed Twilio webhooks.
- Reject demo mode in production.
- Limit JSON and form request bodies, cap caller turns, and bound Ollama requests.
- Keep caller summaries and transcripts private; define retention and deletion policy before production.
- The web client must not receive server credentials.

## 8. Reliability and failure behavior

- Local storage read errors produce an empty demo list; file writes surface an API error.
- Invalid Firebase tokens return HTTP 401. Missing Firebase Admin setup for authenticated cloud requests returns HTTP 503.
- Unknown/inactive call IDs return HTTP 404; empty caller turns return HTTP 400.
- Invalid Twilio signatures return HTTP 403; missing owner/Firebase setup returns HTTP 503.
- Ollama transport or response errors fall back to a safe deterministic response.
- The UI presents API errors instead of reporting a successful save when a request fails.

## 9. Acceptance and verification

1. Install dependencies and run `npm run typecheck` and `npm run build`.
2. Start the local server and verify `GET /api/health` returns `ok: true`.
3. In development mode, create a local demo call, send a caller utterance, end the call, and verify a completed summary appears in the list and local data file.
4. Verify an API request without a Firebase token or demo header receives HTTP 401.
5. Verify production mode rejects the local demo header.
6. With Firebase configured, verify two test users cannot read each other's records.
7. With Twilio configured, verify request-signature validation, the AI disclosure, a spoken turn, and record persistence on a controlled inbound call.

## 10. Known prototype gaps

- The local simulator uses text input; live Twilio speech uses the provider's speech-recognition feature.
- Instructions are saved per user in Firestore when signed in and in a local demo settings file in local mode.
- Production deployment, Firebase project creation, Twilio provisioning, carrier forwarding, and jurisdiction-specific compliance have not been performed by this source tree.
- The current summary is deterministic text derived from caller utterances rather than a separately generated and reviewed summary.
