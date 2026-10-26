# Security notes

This repository is a development prototype for handling sensitive call metadata. Do not use it with real callers until the deployment has been reviewed for the applicable privacy, recording, and telecommunications rules.

- Keep Firebase service-account keys, Twilio auth tokens, and caller data out of Git.
- Set `NODE_ENV=production` in deployed environments; demo headers are intentionally rejected there.
- Expose only HTTPS endpoints, keep dependencies current, and configure the Firebase project with least-privilege access.
- The server verifies Google-issued Firebase ID tokens before retrieving account calls and uses the verified UID in every Firestore call path.
- Twilio webhook requests are checked with the account auth token. Keep `PUBLIC_BASE_URL` exact so signature verification uses the URL Twilio called.
- Review call retention, deletion, consent, and emergency handling before production use. The prototype does not make outbound calls or contact emergency services.

Report security issues privately to the repository owner rather than opening a public issue containing exploit details.
