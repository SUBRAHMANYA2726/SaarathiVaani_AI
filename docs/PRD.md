# Product Requirements Document

**Product:** Saarathi Vaani AI Call Assistant
**Version:** 1.0
**Status:** Prototype scope and release direction
**Date:** 26 October 2026

## 1. Product summary

Saarathi Vaani answers or receives a caller's message when the account owner cannot take an incoming call. It must tell callers it is an AI assistant, stay within owner-approved instructions, collect only what is needed to pass along a message or callback request, and save a short summary for the correct user. The first deliverable is a working web prototype with a local test-call simulator. Real carrier calls are supported through a Twilio-compatible voice webhook after the owner supplies provider credentials, deploys a public HTTPS server, and configures call forwarding.

## 2. Problem and opportunity

People miss calls while driving, working, resting, or away from their phone. A missed call provides little context, and voicemail depends on callers leaving useful details. The product offers a transparent first response and an organized follow-up record while avoiding the false impression that a human answered or that the assistant completed actions it cannot perform.

## 3. Goals and success measures

### Product goals

- Answer a routed unanswered call with a clear AI disclosure.
- Handle short, ordinary caller requests using approved instructions.
- Capture caller intent and optional callback request without making unverified promises.
- Store each user's call record under that user's authenticated identity.
- Let the owner review, search, and understand messages in a simple dashboard.
- Provide a local prototype that works before a phone provider or cloud account is configured.

### Initial success measures

- A new user can start the local demo and complete a sample conversation without secrets or setup.
- Every assistant conversation begins with a plain AI disclosure.
- A completed test call appears in the call list with a summary and timestamp.
- A signed-in API request can only retrieve records under its verified Firebase UID.
- A verified provider webhook can deliver a brief spoken exchange and save the same call to the configured owner's record.
- The assistant declines to collect passwords/payment details and does not claim unintegrated actions are complete.

## 4. Users and primary jobs

### Individual phone owner

Needs to understand who called, why, and whether a callback was requested. Wants the assistant to follow concise boundaries and not speak on their behalf beyond those boundaries.

### Caller

Needs to reach the intended person or leave a short message. Must know whether a person or AI is speaking and must have a simple way to express a callback request.

### Operator or developer

Needs a local demo, a clear configuration path, visible dependency status, and an honest list of prerequisites for real calls.

## 5. Product scope

### Included in the current prototype

- React and Vite web dashboard with overview, call history, approved instructions, and phone setup sections.
- Local test-call flow with an AI disclosure, caller turns, safe deterministic replies, and persisted local call summaries.
- Optional local Ollama chat completion with a bounded response time and a deterministic fallback.
- Firebase Google sign-in client configuration and Firebase Admin ID-token verification path.
- UID-scoped Firestore call-record storage path and example access rules.
- Twilio-compatible inbound voice and speech-turn webhooks with request-signature validation.
- Setup documentation, environment-variable template, build workflow, product requirements, system requirements, and delivery plan.

### Planned before a production launch

- Provision and configure the Firebase project and least-privilege service account.
- Deploy to a public HTTPS host and configure health checks, logs, secret storage, and backups.
- Provision a Twilio number or supported carrier/provider connection and configure forwarding for unanswered calls.
- Confirm local calling/disclosure/retention requirements for launch locations.
- Add user-managed instruction persistence, deletion/export controls, retention controls, and operational monitoring.
- Exercise real phone calls, failure recovery, and account-isolation checks with controlled accounts.

### Out of scope for this prototype

- Outbound calls, call transfer, appointment booking, calendar checks, purchases, emergency dispatch, or autonomous commitments.
- Audio recording or long-term audio storage.
- Using a Google Drive account as the application's call database. The product uses Firebase per-user storage; Drive backup would be a separate future feature and require explicit consent in the product.
- Guaranteed support for every carrier, Android device, or call-forwarding code.

## 6. Core experience

1. The owner opens the dashboard and either chooses a local device demo or signs in with Google through Firebase.
2. The dashboard shows the assistant state and recent call summaries. Missing Firebase or phone configuration is described as setup work, not as a completed connection.
3. During a routed incoming call, the assistant says it is AI and that the owner cannot take the call right now.
4. The assistant asks how it can help, listens for a short request, and follows approved message-taking instructions.
5. The assistant avoids unsupported actions. It directs urgent emergencies to local emergency services and declines sensitive credentials/payment details.
6. The call record and a concise summary are saved under the owner's Firebase UID. In local demo mode, test records are stored on the development device.
7. The owner reviews call history and follows up outside the assistant.

## 7. Product requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-01 | Tell each caller clearly that the responder is an AI assistant before handling a request. | Must |
| PR-02 | Capture a short message and optional callback request. | Must |
| PR-03 | Follow owner-approved instructions while keeping hard safety limits in effect. | Must |
| PR-04 | Never claim that a call was transferred, an appointment was booked, or an external task completed without an integration confirmation. | Must |
| PR-05 | Save a timestamped summary and conversation text for the correct account. | Must |
| PR-06 | Provide a searchable call history and an understandable assistant status. | Must |
| PR-07 | Offer a local demo that does not require a phone number, Firebase project, or AI service. | Must |
| PR-08 | Support Google sign-in and account-isolated cloud records when configured. | Must |
| PR-09 | Support a signed inbound voice-provider webhook for the configured owner. | Should |
| PR-10 | Permit an optional local Ollama model and fall back safely when it is unavailable. | Should |
| PR-11 | Disclose what needs external credentials before claiming that live call answering is enabled. | Must |
| PR-12 | Keep secrets and local call data out of source control. | Must |

## 8. Safety, privacy, and trust

- AI identity disclosure is mandatory and must be included in local and provider greetings.
- The assistant may take messages and callback requests only. It cannot make commitments or represent that a human reviewed a message.
- The assistant must not request passwords, payment card numbers, or sensitive identity data.
- Emergency language triggers a clear instruction for the caller to contact local emergency services. The app cannot dispatch assistance.
- Firebase identity is verified by the backend. The UID from the verified token determines the Firestore path; a request body cannot select another user's UID.
- Local demo records are device-local and ignored by Git. They are not presented as Firebase cloud data.
- The product must add a data deletion and retention workflow before production launch.

## 9. Dependencies and release gates

Real calls depend on a reachable HTTPS deployment, Firebase Authentication and Firestore configuration, backend Firebase Admin credentials, a voice-provider account/number, valid webhook signing credentials, a configured owner UID, and carrier/provider forwarding. A provider account or a user's phone hardware cannot be activated by the repository alone. Production release also requires privacy and telecom review for intended jurisdictions.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Caller mistakes AI for the account owner | Make the AI disclosure the first spoken message; test it on every inbound route. |
| Assistant overpromises | Restrict tasks, use short system instructions, add deterministic safe replies, and test boundary prompts. |
| User data crosses account boundaries | Verify Firebase ID tokens on every call API request and derive Firestore paths from verified UID. |
| Provider signature fails behind proxy | Set the externally visible base URL exactly and validate provider webhook signatures before processing. |
| Local Ollama unavailable or slow | Enforce a 20-second timeout and use a deterministic fallback. |
| User assumes phone is live before configuration | Show setup status and clearly distinguish the simulator from a routed phone call. |

## 11. Acceptance criteria

The prototype is ready for local review when install, typecheck, and production build complete; the dashboard opens; a local test call receives an AI disclosure; sample caller text receives a safe response; ending the call creates a timestamped history entry; and `/api/health` reports the actual configured service state. Live-call acceptance requires a separately configured public deployment and a controlled phone call that verifies the disclosure, speech turn, saved owner record, and caller hang-up behavior.
