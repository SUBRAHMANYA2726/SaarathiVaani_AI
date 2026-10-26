import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import admin from "firebase-admin";
import twilio from "twilio";

type Turn = { role: "assistant" | "caller"; text: string; at: string };
type CallRecord = {
  id: string;
  caller: string;
  status: "active" | "completed";
  createdAt: string;
  endedAt?: string;
  summary: string;
  turns: Turn[];
  source: "twilio";
};

const app = express();
const port = Number(process.env.PORT ?? 4174);
const defaultInstructions = "Take a concise message and offer to request a callback. Do not promise an appointment, disclose private information, or claim an action was completed.";
const serviceAccountText = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!admin.apps.length && serviceAccountText) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountText)) });
} else if (!admin.apps.length && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
}

const firestore = () => (admin.apps.length ? admin.firestore() : undefined);
const isAdminConfigured = () => Boolean(admin.apps.length);

const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "capacitor://localhost",
  "https://localhost",
  ...(process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : []),
  ...(process.env.MOBILE_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.has(origin)) callback(null, true);
  else callback(new Error("Origin is not allowed."));
} }));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

async function saveCall(uid: string, call: CallRecord): Promise<void> {
  const db = firestore();
  if (!db) throw new Error("Firebase Admin credentials are not configured on this server.");
  await db.doc(`users/${uid}/calls/${call.id}`).set(call);
}

async function listCalls(uid: string): Promise<CallRecord[]> {
  const db = firestore();
  if (!db) throw new Error("Firebase Admin credentials are not configured on this server.");
  const snapshot = await db.collection(`users/${uid}/calls`).orderBy("createdAt", "desc").limit(100).get();
  return snapshot.docs.map((doc) => doc.data() as CallRecord);
}

async function getInstructions(uid: string): Promise<string> {
  const db = firestore();
  if (db) {
    const doc = await db.doc(`users/${uid}/settings/assistant`).get();
    const saved = doc.data()?.instructions;
    return typeof saved === "string" && saved.trim() ? saved : defaultInstructions;
  }
  throw new Error("Firebase Admin credentials are not configured on this server.");
}

async function saveInstructions(uid: string, instructions: string): Promise<void> {
  const db = firestore();
  if (!db) throw new Error("Firebase Admin credentials are not configured on this server.");
  await db.doc(`users/${uid}/settings/assistant`).set({ instructions, updatedAt: new Date().toISOString() }, { merge: true });
}

type AuthRequest = Request & { userId?: string };
async function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    if (header?.startsWith("Bearer ")) {
      if (!isAdminConfigured()) return res.status(503).json({ error: "Firebase Admin credentials are not configured on this server." });
      const decoded = await admin.auth().verifyIdToken(header.slice(7));
      req.userId = decoded.uid;
      return next();
    }
    return res.status(401).json({ error: "Sign in with Google to access your call records." });
  } catch {
    return res.status(401).json({ error: "The sign-in token could not be verified." });
  }
}

function summarize(turns: Turn[]): string {
  const callerText = turns.filter((turn) => turn.role === "caller").map((turn) => turn.text).join(" ").trim();
  return callerText ? callerText.slice(0, 220) : "Caller requested a message or callback.";
}

async function assistantReply(turns: Turn[], instructions = defaultInstructions): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("The live AI model service is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "llama3.2",
        stream: false,
        messages: [
          { role: "system", content: `You are a transparent AI answering an incoming phone call for the user. Your opening disclosure has already been spoken. Keep replies brief and natural for speech. Follow only these owner-approved instructions: ${instructions}. You may take a message and record a callback request. Do not claim to have transferred the call, scheduled an appointment, checked availability, or completed an external action. Do not collect passwords, payment card details, or sensitive identity information. For imminent emergencies tell the caller you cannot contact emergency services and they should call their local emergency number.` },
          ...turns.slice(-12).map((turn) => ({ role: turn.role === "caller" ? "user" as const : "assistant" as const, content: turn.text })),
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("The live AI model service returned an error.");
    const data = await response.json() as { message?: { content?: string } };
    const reply = data.message?.content?.trim();
    if (!reply) throw new Error("The live AI model service returned an empty reply.");
    return reply.slice(0, 1200);
  } finally {
    clearTimeout(timer);
  }
}

let ollamaProbeCache: { checkedAt: number; ready: boolean } | undefined;
async function isOllamaModelReady(): Promise<boolean> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
  if (!base) return false;
  if (ollamaProbeCache && Date.now() - ollamaProbeCache.checkedAt < 15000) return ollamaProbeCache.ready;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  let ready = false;
  try {
    const response = await fetch(`${base}/api/tags`, { signal: controller.signal });
    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name?: string }> };
      const expected = (process.env.OLLAMA_MODEL ?? "llama3.2").split(":")[0];
      ready = (data.models ?? []).some((model) => model.name?.split(":")[0] === expected);
    }
  } catch { ready = false; }
  finally { clearTimeout(timer); }
  ollamaProbeCache = { checkedAt: Date.now(), ready };
  return ready;
}

function isTwilioConfigured(): boolean {
  const base = process.env.PUBLIC_BASE_URL;
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && base?.startsWith("https://") && process.env.TWILIO_OWNER_UID && isAdminConfigured());
}

function getFirebaseWebConfig(): Record<string, string> | null {
  let firebase: Record<string, string> | null = null;
  try {
    const config = process.env.FIREBASE_WEB_CONFIG ? JSON.parse(process.env.FIREBASE_WEB_CONFIG) as Record<string, string> : null;
    firebase = config?.apiKey && config?.projectId && config?.authDomain ? config : null;
  }
  catch { firebase = null; }
  return firebase;
}

app.get("/api/health", async (_req, res) => {
  const aiReady = await isOllamaModelReady();
  const twilioReady = isTwilioConfigured();
  const firebaseWebReady = Boolean(getFirebaseWebConfig());
  res.json({ ok: true, firebaseAdminReady: isAdminConfigured(), firebaseWebReady, aiReady, twilioReady, liveReady: aiReady && twilioReady && firebaseWebReady });
});
app.get("/api/config", async (_req, res) => {
  const aiReady = await isOllamaModelReady();
  const twilioReady = isTwilioConfigured();
  const firebase = getFirebaseWebConfig();
  res.json({ firebase, firebaseAdminReady: isAdminConfigured(), firebaseWebReady: Boolean(firebase), aiReady, twilioReady, liveReady: aiReady && twilioReady && Boolean(firebase) });
});

app.get("/api/calls", requireUser, async (req: AuthRequest, res) => {
  res.json({ calls: await listCalls(req.userId!) });
});

app.get("/api/settings", requireUser, async (req: AuthRequest, res) => {
  res.json({ instructions: await getInstructions(req.userId!) });
});

app.put("/api/settings", requireUser, async (req: AuthRequest, res) => {
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim().slice(0, 2000) : "";
  if (!instructions) return res.status(400).json({ error: "Add at least one assistant instruction." });
  await saveInstructions(req.userId!, instructions);
  res.json({ instructions });
});

function xmlEscape(text: string): string { return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!); }
function twilioSignatureValid(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const signature = req.header("x-twilio-signature");
  if (!authToken || !baseUrl || !signature) return false;
  return twilio.validateRequest(authToken, signature, `${baseUrl}${req.originalUrl}`, req.body as Record<string, string>);
}
const twiml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const publicBase = () => (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

app.post("/api/twilio/voice", async (req, res) => {
  if (!twilioSignatureValid(req)) return res.status(403).send("Invalid Twilio signature");
  const uid = process.env.TWILIO_OWNER_UID;
  if (!uid || !isAdminConfigured()) return res.status(503).send("Phone owner cloud storage is not configured");
  if (!await isOllamaModelReady()) {
    return res.type("text/xml").send(twiml("<Say>The live AI assistant is temporarily unavailable. Please try again later.</Say><Hangup />"));
  }
  const id = String(req.body.CallSid ?? crypto.randomUUID());
  const call: CallRecord = {
    id, caller: String(req.body.From ?? "Unknown caller"), status: "active", createdAt: new Date().toISOString(), summary: "Incoming call",
    turns: [{ role: "assistant", text: "Hello, I’m an AI assistant answering on their behalf. They can’t take the call right now. How can I help?", at: new Date().toISOString() }], source: "twilio",
  };
  await saveCall(uid, call);
  const action = `${publicBase()}/api/twilio/turn`;
  res.type("text/xml").send(twiml(`<Say>Hello, I am an AI assistant answering on their behalf. They cannot take the call right now. How can I help?</Say><Gather input="speech" language="en-US" speechTimeout="auto" timeout="8" actionOnEmptyResult="true" action="${action}" method="POST" />`));
});

app.post("/api/twilio/turn", async (req, res) => {
  if (!twilioSignatureValid(req)) return res.status(403).send("Invalid Twilio signature");
  const uid = process.env.TWILIO_OWNER_UID;
  if (!uid || !isAdminConfigured()) return res.status(503).send("Phone owner cloud storage is not configured");
  const id = String(req.body.CallSid ?? "");
  const call = (await listCalls(uid)).find((item) => item.id === id);
  if (!call) return res.status(404).send("Call not found");
  const utterance = String(req.body.SpeechResult ?? "").trim().slice(0, 1200);
  if (!utterance) {
    call.status = "completed";
    call.endedAt = new Date().toISOString();
    call.summary = summarize(call.turns);
    await saveCall(uid, call);
    return res.type("text/xml").send(twiml("<Say>Thank you for calling. I will pass along the message.</Say><Hangup />"));
  }
  call.turns.push({ role: "caller", text: utterance, at: new Date().toISOString() });
  let reply: string;
  try {
    reply = await assistantReply(call.turns, await getInstructions(uid));
  } catch {
    call.status = "completed";
    call.endedAt = new Date().toISOString();
    call.turns.push({ role: "assistant", text: "The live AI assistant became unavailable. The caller was asked to try again later.", at: new Date().toISOString() });
    call.summary = summarize(call.turns);
    await saveCall(uid, call);
    return res.type("text/xml").send(twiml("<Say>I am sorry, the live AI assistant is temporarily unavailable. Please try again later.</Say><Hangup />"));
  }
  call.turns.push({ role: "assistant", text: reply, at: new Date().toISOString() });
  call.summary = summarize(call.turns);
  await saveCall(uid, call);
  const action = `${publicBase()}/api/twilio/turn`;
  res.type("text/xml").send(twiml(`<Say>${xmlEscape(reply)}</Say><Gather input="speech" speechTimeout="auto" timeout="8" action="${action}" method="POST" />`));
});

app.get("/downloads/vocalis-android-preview.apk", (_req, res, next) => {
  res.download(path.resolve("downloads/vocalis-android-preview.apk"), "vocalis-android-preview.apk", (error) => {
    if (error && !res.headersSent) next(error);
  });
});

if (process.env.NODE_ENV === "production") {
  const staticRoot = path.resolve("dist");
  app.use(express.static(staticRoot));
  app.get("*", (_req, res) => res.sendFile(path.join(staticRoot, "index.html")));
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "The request could not be completed." });
});

app.listen(port, () => console.log(`Vocalis AI API listening on port ${port}`));
