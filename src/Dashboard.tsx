import { useEffect, useMemo, useState, type ReactNode } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from "firebase/auth";
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, CircleHelp, Clock3, FileText, Headphones, LayoutDashboard, MessageSquareText, Mic2, MoreHorizontal, Phone, PhoneCall, Search, Settings2, ShieldCheck, UserRound, X } from "lucide-react";

type Turn = { role: "assistant" | "caller"; text: string; at: string };
type CallRecord = { id: string; caller: string; status: "active" | "completed"; createdAt: string; endedAt?: string; summary: string; turns: Turn[]; source: string };
type Config = { firebase: Record<string, string> | null; firebaseAdminReady: boolean; aiReady: boolean; twilioReady: boolean; liveReady: boolean };
const initialInstructions = "Take a concise message and offer to request a callback. Do not promise an appointment, disclose private information, or claim an action was completed.";
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const timeLabel = (date: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));
const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(date));

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [tab, setTab] = useState("Overview");
  const [instructions, setInstructions] = useState(initialInstructions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    let unsubscribe: () => void = () => {};
    fetch(apiBase + "/api/config", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Server readiness could not be read.");
      return response.json() as Promise<Config>;
    }).then((value) => {
      if (!alive) return;
      setConfig(value);
      if (value.firebase?.apiKey) {
        const firebaseAuth = getAuth(initializeApp(value.firebase));
        setAuth(firebaseAuth);
        unsubscribe = onAuthStateChanged(firebaseAuth, (next) => { if (alive) { setUser(next); setAuthReady(true); } });
      } else {
        setError("Google sign-in is not configured on this server yet.");
        setAuthReady(true);
      }
    }).catch((e: unknown) => {
      if (alive) { setError((e as Error).message || "The live service is unavailable."); setAuthReady(true); }
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  const api = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    if (user) headers.set("authorization", `Bearer ${await user.getIdToken()}`);
    const response = await fetch(apiBase + url, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The request could not be completed.");
    return body;
  };

  useEffect(() => {
    let active = true;
    if (!user) { setCalls([]); setInstructions(initialInstructions); return () => { active = false; }; }
    const refreshCalls = () => api("/api/calls").then((result) => {
      if (active) setCalls((result.calls ?? []).filter((call: CallRecord) => call.source === "twilio"));
    });
    Promise.all([refreshCalls(), api("/api/settings")]).then(([, settingsResult]) => {
      if (active) { setInstructions(settingsResult.instructions || initialInstructions); setError(""); }
    }).catch((e: unknown) => { if (active) setError((e as Error).message); });
    const timer = window.setInterval(() => { void refreshCalls().catch((e: unknown) => { if (active) setError((e as Error).message); }); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [user]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 2600); return () => clearTimeout(id); }, [toast]);

  const login = async () => {
    if (!auth) { setError("Google sign-in is not configured yet. Add the Firebase web settings to the server configuration."); return; }
    try { await signInWithPopup(auth, new GoogleAuthProvider()); setError(""); }
    catch (e) { setError((e as Error).message); }
  };
  const logout = async () => { if (auth) await signOut(auth); setCalls([]); };
  const saveInstructions = async () => {
    if (!user) { setError("Sign in with Google before saving assistant instructions."); return; }
    setSaving(true); setError("");
    try { const result = await api("/api/settings", { method: "PUT", body: JSON.stringify({ instructions }) }); setInstructions(result.instructions); setToast("Approved call instructions saved to your account."); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const completed = calls.filter((call) => call.status === "completed").length;
  const callbackCount = calls.filter((call) => call.turns.some((turn) => turn.role === "caller" && /callback|call\s*(me\s*)?back|return my call/i.test(turn.text))).length;
  const filteredCalls = useMemo(() => calls.filter((call) => `${call.caller} ${call.summary}`.toLowerCase().includes(filter.toLowerCase())), [calls, filter]);
  const sessionLabel = user?.displayName || user?.email || "Not signed in";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Headphones size={20} strokeWidth={2.4} /></div><div><strong>Vocalis AI</strong><span>AI Voice Assistant</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">{[{ name: "Overview", icon: LayoutDashboard }, { name: "Call history", icon: Phone }, { name: "Instructions", icon: MessageSquareText }, { name: "Phone setup", icon: Settings2 }].map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${tab === name ? "active" : ""}`} onClick={() => setTab(name)}><Icon size={18} /><span>{name}</span>{name === "Call history" && calls.length > 0 && <span className="nav-count">{calls.length}</span>}</button>)}</nav>
      <div className="side-spacer" /><div className="privacy-note"><ShieldCheck size={17} /><div><strong>Private call records</strong><p>Only your signed-in account can view its call summaries.</p></div></div>
      <button className="profile-row" onClick={user ? logout : login}><div className="avatar">{user?.photoURL ? <img src={user.photoURL} alt="" /> : <UserRound size={18} />}</div><div className="profile-copy"><strong>{sessionLabel}</strong><span>{user ? "Google account · Sign out" : "Sign in with Google"}</span></div></button>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{tab}</strong></div><div className="top-actions"><div className={`connection-pill ${config?.liveReady ? "connected" : ""}`}><span className="status-dot" />{config?.liveReady ? "Server config ready" : "Phone service offline"}</div><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><a className="help-button" href="/#phone-setup"><CircleHelp size={16} /> Setup help</a></div></header>

      {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {tab === "Overview" && <>
        <section className="welcome-row"><div><div className="eyebrow">LIVE INBOUND PHONE CALLS</div><h1>{user?.displayName ? `Hello, ${user.displayName.split(" ")[0]}` : "Your call workspace"} <span className="wave">✦</span></h1><p>Only real calls received by your connected phone provider appear here.</p></div><button className="primary-button" onClick={() => setTab("Phone setup")}><Settings2 size={16} /> Phone setup</button></section>
        {!authReady && <div className="setup-banner"><div className="setup-icon"><ShieldCheck size={19} /></div><div className="setup-copy"><strong>Checking your account</strong><span>Connecting to Firebase sign-in and live service status.</span></div></div>}
        {authReady && !user && <div className="setup-banner"><div className="setup-icon"><ShieldCheck size={19} /></div><div className="setup-copy"><strong>Sign in to your private workspace</strong><span>Google sign-in protects your call summaries and assistant instructions.</span></div><div className="setup-actions"><button className="google-button" onClick={login}>Continue with Google</button></div></div>}
        <section className="stats-grid"><StatCard label="Inbound calls this week" value={String(calls.filter((call) => Date.now() - new Date(call.createdAt).getTime() < 7 * 86400000).length).padStart(2, "0")} delta="From your phone provider" icon={<PhoneCall />} tone="mint" /><StatCard label="Completed call summaries" value={String(completed).padStart(2, "0")} delta="Saved to your account" icon={<MessageSquareText />} tone="lavender" /><StatCard label="Callback requests" value={String(callbackCount).padStart(2, "0")} delta="Detected in caller messages" icon={<CalendarDays />} tone="peach" /></section>
        <section className="content-grid"><div className="panel calls-panel"><div className="panel-heading"><div><h2>Recent inbound calls</h2><p>Records received from Twilio</p></div><button className="text-button" onClick={() => setTab("Call history")}>View all <ArrowUpRight size={15} /></button></div><CallTable calls={calls.slice(0, 5)} signedIn={Boolean(user)} /></div><div className="right-column"><div className="assistant-card"><div className="assistant-orbit"><div className="orbit-dot" /><Mic2 size={23} /></div><div className="eyebrow">YOUR ASSISTANT</div><h3>{config?.liveReady ? "Server configuration is ready" : "Connect before taking calls"}</h3><p>Forwards unanswered calls to the AI service, discloses that it is AI, and follows your approved instructions.</p><div className="assistant-status"><span className={`pulse-dot ${config?.liveReady ? "" : "pulse-off"}`} />{config?.liveReady ? "Configuration present" : "Not connected"}<span className="status-line" /><button onClick={() => setTab("Phone setup")}>Check setup</button></div></div><div className="quick-card"><div className="quick-title"><span className="quick-icon"><FileText size={16} /></span><strong>Latest call summary</strong><MoreHorizontal size={18} /></div>{calls[0] && user ? <><p className="summary-text">{calls[0].summary}</p><span className="summary-time"><Clock3 size={13} /> {timeLabel(calls[0].createdAt)} · {dateLabel(calls[0].createdAt)}</span></> : <div className="empty-summary">{user ? "No inbound call summaries yet." : "Sign in to view your call summaries."}</div>}</div></div></section>
        <div className="disclosure-foot"><ShieldCheck size={14} />Inbound callers are told they are speaking with an AI assistant.</div>
      </>}

      {tab === "Call history" && <section className="page-section"><div className="page-title"><div><div className="eyebrow">YOUR RECORD</div><h1>Inbound call history</h1><p>Review real phone messages and callback requests from your configured provider.</p></div><div className={`connection-pill ${config?.liveReady ? "connected" : ""}`}><span className="status-dot" />{config?.liveReady ? "Live service ready" : "Setup needed"}</div></div><div className="filter-row"><div className="search-box"><Search size={17} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search calls or summaries" /></div><span className="result-count">{filteredCalls.length} {filteredCalls.length === 1 ? "call" : "calls"}</span></div><div className="panel calls-panel full-panel"><CallTable calls={filteredCalls} signedIn={Boolean(user)} /></div></section>}

      {tab === "Instructions" && <section className="page-section"><div className="page-title"><div><div className="eyebrow">ASSISTANT BEHAVIOUR</div><h1>Approved instructions</h1><p>Set the boundaries for the assistant that answers your real incoming calls.</p></div><button className="primary-button" onClick={saveInstructions} disabled={!user || saving}><Check size={17} />{saving ? "Saving…" : "Save instructions"}</button></div><div className="settings-layout"><div className="panel instruction-panel"><label htmlFor="instructions">What should the assistant do?</label><p>Instructions are stored under your account and read when your incoming calls are handled.</p><textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={7} maxLength={2000} disabled={!user} /><div className="field-hint"><ShieldCheck size={15} /> The assistant discloses that it is AI and cannot confirm actions it has not completed.<span>{instructions.length}/2000</span></div>{!user && <button className="google-button instruction-login" onClick={login}>Sign in to manage instructions</button>}</div><div className="panel guardrail-panel"><div className="guardrail-icon"><ShieldCheck size={19} /></div><h3>Always-on protections</h3><ul><li>Clearly says it is an AI assistant</li><li>Does not collect passwords or payment details</li><li>Does not promise appointments or completed actions</li><li>Directs emergencies to local emergency services</li></ul><button className="text-button" onClick={() => setInstructions(initialInstructions)} disabled={!user}>Restore safe defaults <ArrowUpRight size={14} /></button></div></div></section>}

      {tab === "Phone setup" && <section className="page-section"><div className="page-title"><div><div className="eyebrow">CONNECT YOUR PHONE</div><h1>Live phone setup</h1><p>Enable the real incoming call path. This app cannot answer calls until the required services are connected.</p></div><div className={`connection-pill ${config?.liveReady ? "connected" : ""}`}><span className="status-dot" />{config?.liveReady ? "Server config ready" : "Not connected"}</div></div><div className="setup-steps"><SetupStep number="01" title="Google sign-in and private call storage" description="Enable Firebase Authentication and Firestore, add the Firebase web configuration and Admin credentials, then sign in to this dashboard." done={Boolean(user && config?.firebaseAdminReady && config?.firebase)} /><SetupStep number="02" title="AI model reachable by the server" description="Run Ollama with the configured model and set OLLAMA_BASE_URL and OLLAMA_MODEL on the backend. Readiness checks the live model list." done={config?.aiReady ?? false} /><SetupStep number="03" title="Twilio account settings and public HTTPS URL" description="Set the Twilio account SID, phone number, auth token, owner Firebase UID, and public HTTPS URL. The dashboard can check these values, not your Twilio console webhook setting." done={config?.twilioReady ?? false} /><SetupStep number="04" title="Set the Twilio voice webhook" description="In Twilio, set the number's incoming voice webhook to https://YOUR_HOST/api/twilio/voice using HTTP POST. Confirm the URL manually in Twilio Console." done={false} /><SetupStep number="05" title="Forward unanswered calls from your phone" description="Enable call forwarding with your mobile carrier to the Twilio number. This last step is configured on your phone or carrier account and cannot be checked by this app." done={false} /></div><div className="provider-note"><ShieldCheck size={18} /><div><strong>{config?.liveReady ? "Server configuration is present" : "Phone service is not connected"}</strong><p>{config?.liveReady ? "The server can receive signed Twilio requests and reach the configured AI model. Confirm the number webhook in Twilio and enable unanswered-call forwarding with your carrier before your personal line routes calls here." : "No call will be answered until Firebase Admin, a reachable AI model, Twilio settings, and a public HTTPS URL are configured. The Twilio webhook and carrier forwarding must then be set manually."}</p></div></div></section>}
    </main>
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    <a className="page-corner" href="/"><Activity size={12} /> Vocalis AI · Back to landing page</a>
  </div>;
}

function StatCard({ label, value, delta, icon, tone }: { label: string; value: string; delta: string; icon: ReactNode; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-delta"><span className="delta-check"><Check size={11} /></span>{delta}</div></div>;
}
function CallTable({ calls, signedIn }: { calls: CallRecord[]; signedIn: boolean }) {
  if (!signedIn) return <div className="empty-state"><div className="empty-icon"><ShieldCheck size={21} /></div><strong>Sign in to view private call records</strong><p>Call logs are separated by Firebase account.</p></div>;
  if (!calls.length) return <div className="empty-state"><div className="empty-icon"><PhoneCall size={21} /></div><strong>No inbound phone calls yet</strong><p>When your phone provider sends a real call to the configured webhook, its summary will appear here.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>CALLER</th><th>DATE &amp; TIME</th><th>SUMMARY</th><th>STATUS</th><th /></tr></thead><tbody>{calls.map((call) => <tr key={call.id}><td><div className="caller-cell"><div className="call-direction"><ArrowDownLeft size={14} /></div><div><strong>{call.caller}</strong><span>Inbound phone call</span></div></div></td><td><span className="date-cell"><span>{dateLabel(call.createdAt)}</span><small>{timeLabel(call.createdAt)}</small></span></td><td><div className="summary-cell">{call.summary}</div></td><td><span className={`call-status ${call.status}`}><span />{call.status === "completed" ? "Completed" : "In progress"}</span></td><td><button className="row-more" title="Call details"><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>;
}
function SetupStep({ number, title, description, done }: { number: string; title: string; description: string; done: boolean }) {
  return <div className="setup-step"><div className={`step-number ${done ? "done" : ""}`}>{done ? <Check size={17} /> : number}</div><div className="step-copy"><strong>{title}</strong><p>{description}</p></div><span className={`step-status ${done ? "done" : ""}`}>{done ? "Ready" : "To do"}</span></div>;
}
