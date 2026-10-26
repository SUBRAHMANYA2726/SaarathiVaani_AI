import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
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
  source: "demo" | "twilio";
};

const app = express();
const port = Number(process.env.PORT ?? 4174);
const dataFile = path.resolve(process.env.LOCAL_DATA_FILE ?? "work/data/demo-calls.json");
const settingsFile = path.resolve(process.env.LOCAL_SETTINGS_FILE ?? "work/data/demo-settings.json");
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

async function readLocal(): Promise<Record<string, CallRecord[]>> {
  try { return JSON.parse(await fs.readFile(dataFile, "utf8")) as Record<string, CallRecord[]>; }
  catch { return {}; }
}

async function saveCall(uid: string, call: CallRecord): Promise<void> {
  const db = firestore();
  if (db) {
    await db.doc(`users/${uid}/calls/${call.id}`).set(call);
    return;
  }
  if (uid !== "demo-local") throw new Error("Firebase Admin is not configured for authenticated cloud storage.");
  const all = await readLocal();
  const calls = all[uid] ?? [];
  const index = calls.findIndex((item) => item.id === call.id);
  if (index >= 0) calls[index] = call; else calls.unshift(call);
  all[uid] = calls.slice(0, 100);
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(all, null, 2), "utf8");
}

async function listCalls(uid: string): Promise<CallRecord[]> {
  const db = firestore();
  if (db) {
    const snapshot = await db.collection(`users/${uid}/calls`).orderBy("createdAt", "desc").limit(100).get();
    return snapshot.docs.map((doc) => doc.data() as CallRecord);
  }
  return (await readLocal())[uid] ?? [];
}

async function getInstructions(uid: string): Promise<string> {
  const db = firestore();
  if (db) {
    const doc = await db.doc(`users/${uid}/settings/assistant`).get();
    const saved = doc.data()?.instructions;
    return typeof saved === "string" && saved.trim() ? saved : defaultInstructions;
  }
  if (uid !== "demo-local") throw new Error("Firebase Admin is not configured for account settings.");
  try {
    const all = JSON.parse(await fs.readFile(settingsFile, "utf8")) as Record<string, string>;
    return all[uid] || defaultInstructions;
  } catch { return defaultInstructions; }
}

async function saveInstructions(uid: string, instructions: string): Promise<void> {
  const db = firestore();
  if (db) {
    await db.doc(`users/${uid}/settings/assistant`).set({ instructions, updatedAt: new Date().toISOString() }, { merge: true });
    return;
  }
  if (uid !== "demo-local") throw new Error("Firebase Admin is not configured for account settings.");
  let all: Record<string, string> = {};
  try { all = JSON.parse(await fs.readFile(settingsFile, "utf8")) as Record<string, string>; } catch { /* first local save */ }
  all[uid] = instructions;
  await fs.mkdir(path.dirname(settingsFile), { recursive: true });
  await fs.writeFile(settingsFile, JSON.stringify(all, null, 2), "utf8");
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
    if (process.env.NODE_ENV !== "production" && req.header("x-demo-mode") === "true") {
      req.userId = "demo-local";
      return next();
    }
    return res.status(401).json({ error: "Sign in with Google or choose local demo mode." });
  } catch {
    return res.status(401).json({ error: "The sign-in token could not be verified." });
  }
}

function summarize(turns: Turn[]): string {
  const callerText = turns.filter((turn) => turn.role === "caller").map((turn) => turn.text).join(" ").trim();
  return callerText ? callerText.slice(0, 220) : "Caller requested a message or callback.";
}

function localAssistantReply(text: string): string {
  const message = text.toLowerCase();
  if (/\b(urgent|emergency|ambulance|police|fire|medical emergency)\b/.test(message)) {
    return "I’m an AI assistant and can’t contact emergency services. Please call your local emergency number now. I can also pass along a message.";
  }
  if (/\b(call me back|callback|call back|return my call)\b/.test(message)) {
    return "I’ll note that you’d like a callback. What is the best number and a short message I should pass along?";
  }
  if (/\b(appointment|book|schedule|available)\b/.test(message)) {
    return "I can pass along your request, but I can’t check availability or confirm an appointment. What day or time should I include in the message?";
  }
  if (/\b(secret|password|bank|credit card|social security|ssn)\b/.test(message)) {
    return "Please don’t share passwords, payment card numbers, or sensitive identity details. I can take a brief non-sensitive message instead.";
  }
  if (message.split(/\s+/).length > 4) return "Thanks, I’ve noted that. Is there a callback number or any other short detail you’d like me to pass along?";
  return "I can take a message or note a callback request. What would you like me to tell them?";
}

async function assistantReply(text: string, instructions = defaultInstructions): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
  if (!base) return localAssistantReply(text);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "llama3.2",
        stream: false,
        messages: [
          { role: "system", content: `You are a transparent AI answering an incoming phone call for the user. Your opening disclosure has already been spoken. Keep replies brief and natural for speech. Follow only these owner-approved instructions: ${instructions}. You may take a message and record a callback request. Do not claim to have transferred the call, scheduled an appointment, checked availability, or completed an external action. Do not collect passwords, payment card details, or sensitive identity information. For imminent emergencies tell the caller you cannot contact emergency services and they should call their local emergency number.` },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return localAssistantReply(text);
    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content?.trim() || localAssistantReply(text);
  } catch { return localAssistantReply(text); }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, firebaseAdmin: isAdminConfigured(), ollama: Boolean(process.env.OLLAMA_BASE_URL), twilio: Boolean(process.env.TWILIO_AUTH_TOKEN && process.env.PUBLIC_BASE_URL && process.env.TWILIO_OWNER_UID && isAdminConfigured()) }));
app.get("/api/config", (_req, res) => {
  let firebase: Record<string, string> | null = null;
  try { firebase = process.env.FIREBASE_WEB_CONFIG ? JSON.parse(process.env.FIREBASE_WEB_CONFIG) : null; }
  catch { firebase = null; }
  res.json({ firebase, demoEnabled: process.env.NODE_ENV !== "production", providerReady: Boolean(process.env.TWILIO_AUTH_TOKEN && process.env.PUBLIC_BASE_URL && process.env.TWILIO_OWNER_UID && isAdminConfigured()) });
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

app.post("/api/demo/calls", requireUser, async (req: AuthRequest, res) => {
  const call: CallRecord = {
    id: crypto.randomUUID(), caller: "Demo caller", status: "active", createdAt: new Date().toISOString(),
    summary: "New test call", turns: [{ role: "assistant", text: "Hello, I’m an AI assistant answering on their behalf. They can’t take the call right now. How can I help?", at: new Date().toISOString() }], source: "demo",
  };
  await saveCall(req.userId!, call);
  res.status(201).json({ call });
});

app.post("/api/demo/calls/:id/turn", requireUser, async (req: AuthRequest, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 1200) : "";
  if (!text) return res.status(400).json({ error: "Enter what the caller says." });
  const calls = await listCalls(req.userId!);
  const call = calls.find((item) => item.id === req.params.id);
  if (!call || call.status !== "active") return res.status(404).json({ error: "Active call not found." });
  call.turns.push({ role: "caller", text, at: new Date().toISOString() });
  const reply = await assistantReply(text, typeof req.body.instructions === "string" ? req.body.instructions.slice(0, 2000) : defaultInstructions);
  call.turns.push({ role: "assistant", text: reply, at: new Date().toISOString() });
  call.summary = summarize(call.turns);
  await saveCall(req.userId!, call);
  res.json({ call, reply });
});

app.post("/api/demo/calls/:id/end", requireUser, async (req: AuthRequest, res) => {
  const calls = await listCalls(req.userId!);
  const call = calls.find((item) => item.id === req.params.id);
  if (!call) return res.status(404).json({ error: "Call not found." });
  call.status = "completed";
  call.endedAt = new Date().toISOString();
  call.summary = summarize(call.turns);
  await saveCall(req.userId!, call);
  res.json({ call });
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
  const id = String(req.body.CallSid ?? crypto.randomUUID());
  const call: CallRecord = {
    id, caller: String(req.body.From ?? "Unknown caller"), status: "active", createdAt: new Date().toISOString(), summary: "Incoming call",
    turns: [{ role: "assistant", text: "Hello, I’m an AI assistant answering on their behalf. They can’t take the call right now. How can I help?", at: new Date().toISOString() }], source: "twilio",
  };
  await saveCall(uid, call);
  const action = `${publicBase()}/api/twilio/turn`;
  res.type("text/xml").send(twiml(`<Say>Hello, I am an AI assistant answering on their behalf. They cannot take the call right now. How can I help?</Say><Gather input="speech" speechTimeout="auto" timeout="8" action="${action}" method="POST" />`));
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
  const reply = await assistantReply(utterance, await getInstructions(uid));
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
