import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth, type User } from "firebase/auth";
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, FileText, Headphones, LayoutDashboard, MessageSquareText, Mic2, MoreHorizontal, Phone, PhoneCall, Play, Search, Settings2, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";

type Turn = { role: "assistant" | "caller"; text: string; at: string };
type CallRecord = { id: string; caller: string; status: "active" | "completed"; createdAt: string; endedAt?: string; summary: string; turns: Turn[]; source: "demo" | "twilio" };
type Config = { firebase: Record<string, string> | null; demoEnabled: boolean; providerReady: boolean };

const initialInstructions = "Take a concise message and offer to request a callback. Do not promise an appointment, disclose private information, or claim an action was completed.";
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const timeLabel = (date: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));
const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(date));

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [tab, setTab] = useState("Overview");
  const [instructions, setInstructions] = useState(initialInstructions);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");

  const authToken = async () => user ? user.getIdToken() : null;
  const api = async (url: string, init?: RequestInit) => {
    const token = await authToken();
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);
    else if (demoMode || config?.demoEnabled) headers.set("x-demo-mode", "true");
    const response = await fetch(apiBase + url, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Something went wrong.");
    return body;
  };

  useEffect(() => {
    fetch(apiBase + "/api/config").then((r) => r.json()).then((value: Config) => {
      setConfig(value);
      if (value.firebase?.apiKey) {
        const app: FirebaseApp = initializeApp(value.firebase);
        const firebaseAuth = getAuth(app);
        setAuth(firebaseAuth);
        return firebaseAuth.onAuthStateChanged((next) => setUser(next));
      }
    }).catch(() => setError("The local app service is not available. Start the development server and reload."));
  }, []);

  const refreshCalls = async () => {
    if (!user && !demoMode) return;
    try { const result = await api("/api/calls"); setCalls(result.calls ?? []); }
    catch (e) { setError((e as Error).message); }
  };
  const refreshInstructions = async () => {
    if (!user && !demoMode) return;
    try { const result = await api("/api/settings"); setInstructions(result.instructions || initialInstructions); }
    catch (e) { setError((e as Error).message); }
  };
  useEffect(() => {
    void refreshCalls();
    if (user || demoMode) void refreshInstructions();
    else setInstructions(initialInstructions);
  }, [user, demoMode]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(""), 2600); return () => clearTimeout(id); }, [toast]);

  const startDemo = async () => {
    if (!user && config?.demoEnabled) setDemoMode(true);
    setLoading(true); setError("");
    try {
      const result = await api("/api/demo/calls", { method: "POST", body: JSON.stringify({}) });
      setActiveCall(result.call); setTab("Overview"); await refreshCalls();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  const sendTurn = async (event: FormEvent) => {
    event.preventDefault(); if (!activeCall || !draft.trim()) return;
    const text = draft.trim(); setDraft(""); setLoading(true); setError("");
    setActiveCall({ ...activeCall, turns: [...activeCall.turns, { role: "caller", text, at: new Date().toISOString() }] });
    try { const result = await api(`/api/demo/calls/${activeCall.id}/turn`, { method: "POST", body: JSON.stringify({ text, instructions }) }); setActiveCall(result.call); await refreshCalls(); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  const endDemo = async () => {
    if (!activeCall) return;
    try { await api(`/api/demo/calls/${activeCall.id}/end`, { method: "POST", body: JSON.stringify({}) }); await refreshCalls(); setToast("Test call saved to your call log"); }
    catch (e) { setError((e as Error).message); }
    setActiveCall(null);
  };
  const login = async () => {
    if (!auth) { setError("Add your Firebase web configuration in .env to enable Google sign-in."); return; }
    try { await signInWithPopup(auth, new GoogleAuthProvider()); setDemoMode(false); }
    catch (e) { setError((e as Error).message); }
  };
  const logout = async () => { if (auth) await signOut(auth); setDemoMode(false); setCalls([]); };
  const saveInstructions = async () => {
    try { const result = await api("/api/settings", { method: "PUT", body: JSON.stringify({ instructions }) }); setInstructions(result.instructions); setToast(user ? "Assistant instructions saved to your account" : "Assistant instructions saved on this device"); }
    catch (e) { setError((e as Error).message); }
  };

  const completed = calls.filter((call) => call.status === "completed").length;
  const filteredCalls = useMemo(() => calls.filter((call) => `${call.caller} ${call.summary}`.toLowerCase().includes(filter.toLowerCase())), [calls, filter]);
  const sessionLabel = user?.displayName || (demoMode ? "Local demo" : "Guest preview");

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Headphones size={20} strokeWidth={2.4} /></div><div><strong>Vocalis AI</strong><span>AI Voice Assistant</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">
        {[{ name: "Overview", icon: LayoutDashboard }, { name: "Call history", icon: Phone }, { name: "Instructions", icon: MessageSquareText }, { name: "Phone setup", icon: Settings2 }].map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${tab === name ? "active" : ""}`} onClick={() => setTab(name)}><Icon size={18} /><span>{name}</span>{name === "Call history" && calls.length > 0 && <span className="nav-count">{calls.length}</span>}</button>)}
      </nav>
      <div className="side-spacer" />
      <div className="privacy-note"><ShieldCheck size={17} /><div><strong>Your calls stay yours</strong><p>Each account sees its own call summaries.</p></div></div>
      <button className="profile-row" onClick={user || demoMode ? logout : login}><div className="avatar">{user?.photoURL ? <img src={user.photoURL} /> : <UserRound size={18} />}</div><div className="profile-copy"><strong>{sessionLabel}</strong><span>{user ? "Google account" : demoMode ? "Saved on this device" : "Choose how to continue"}</span></div><ChevronDown size={16} className="profile-chevron" /></button>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{tab}</strong></div><div className="top-actions"><div className={`connection-pill ${config?.providerReady ? "connected" : ""}`}><span className="status-dot" />{config?.providerReady ? "Phone connected" : "Demo mode"}</div><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><button className="help-button"><CircleHelp size={16} /> Help</button></div></header>

      {tab === "Overview" && <>
        <section className="welcome-row"><div><div className="eyebrow">YOUR CALLS, TAKEN CARE OF</div><h1>Good day{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} <span className="wave">✦</span></h1><p>See what your assistant handled while you were away.</p></div><button className="primary-button" onClick={startDemo} disabled={loading}><Play size={16} fill="currentColor" /> Try a test call</button></section>
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}
        {!user && !demoMode && <div className="setup-banner"><div className="setup-icon"><ShieldCheck size={19} /></div><div className="setup-copy"><strong>Choose a private workspace</strong><span>Sign in with Google for account-isolated cloud call logs, or use a device-only demo.</span></div><div className="setup-actions"><button className="outline-button" onClick={() => setDemoMode(true)}>Use local demo</button><button className="google-button" onClick={login}>Continue with Google</button></div></div>}
        <section className="stats-grid"><StatCard label="Calls this week" value={String(calls.filter((call) => Date.now() - new Date(call.createdAt).getTime() < 7 * 86400000).length).padStart(2, "0")} delta={calls.length ? `${calls.length} saved` : "No calls yet"} icon={<PhoneCall />} tone="mint" /><StatCard label="Messages captured" value={String(completed).padStart(2, "0")} delta="Across completed calls" icon={<MessageSquareText />} tone="lavender" /><StatCard label="Callback requests" value={String(calls.filter((call) => call.turns.some((turn) => turn.role === "caller" && /callback|call\s*(me\s*)?back|return my call/i.test(turn.text))).length).padStart(2, "0")} delta="Ready for your review" icon={<CalendarDays />} tone="peach" /></section>
        <section className="content-grid"><div className="panel calls-panel"><div className="panel-heading"><div><h2>Recent calls</h2><p>A clear record of every conversation</p></div><button className="text-button" onClick={() => setTab("Call history")}>View all <ArrowUpRight size={15} /></button></div><CallTable calls={calls.slice(0, 5)} emptyAction={() => void startDemo()} /></div><div className="right-column"><div className="assistant-card"><div className="assistant-orbit"><div className="orbit-dot" /><Mic2 size={23} /></div><div className="eyebrow">YOUR ASSISTANT</div><h3>Ready when you can’t be</h3><p>Your assistant introduces itself as AI, takes messages, and asks callers if they’d like a callback.</p><div className="assistant-status"><span className="pulse-dot" /> Assistant is ready <span className="status-line" /> <button onClick={() => setTab("Instructions")}>Edit instructions</button></div></div><div className="quick-card"><div className="quick-title"><span className="quick-icon"><FileText size={16} /></span><strong>Latest summary</strong><MoreHorizontal size={18} /></div>{calls[0] ? <><p className="summary-text">{calls[0].summary}</p><span className="summary-time"><Clock3 size={13} /> {timeLabel(calls[0].createdAt)} · {dateLabel(calls[0].createdAt)}</span></> : <div className="empty-summary">Your first call summary will show here.</div>}</div></div></section>
        <div className="disclosure-foot"><ShieldCheck size={14} /> Callers are told they are speaking with an AI assistant.</div>
      </>}

      {tab === "Call history" && <section className="page-section"><div className="page-title"><div><div className="eyebrow">YOUR RECORD</div><h1>Call history</h1><p>Review messages and callback requests captured by your assistant.</p></div><button className="primary-button" onClick={startDemo}><Play size={16} fill="currentColor" /> Try a test call</button></div><div className="filter-row"><div className="search-box"><Search size={17} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search calls or summaries" /></div><span className="result-count">{filteredCalls.length} {filteredCalls.length === 1 ? "call" : "calls"}</span></div><div className="panel calls-panel full-panel"><CallTable calls={filteredCalls} emptyAction={() => void startDemo()} /></div></section>}

      {tab === "Instructions" && <section className="page-section"><div className="page-title"><div><div className="eyebrow">ASSISTANT BEHAVIOUR</div><h1>Approved instructions</h1><p>Tell your assistant what it may say and what it must avoid.</p></div><button className="primary-button" onClick={saveInstructions}><Check size={17} /> Save instructions</button></div><div className="settings-layout"><div className="panel instruction-panel"><label htmlFor="instructions">What should the assistant do?</label><p>These instructions guide the local AI demo. Keep them specific and limited to handling messages and requests.</p><textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={7} maxLength={2000} /><div className="field-hint"><ShieldCheck size={15} /> The assistant must disclose it is AI and cannot confirm actions it has not completed.<span>{instructions.length}/2000</span></div></div><div className="panel guardrail-panel"><div className="guardrail-icon"><ShieldCheck size={19} /></div><h3>Always-on protections</h3><ul><li>Clearly says it is an AI assistant</li><li>Does not collect passwords or payment details</li><li>Does not promise appointments or completed actions</li><li>Directs emergencies to local emergency services</li></ul><button className="text-button" onClick={() => setInstructions(initialInstructions)}>Restore safe defaults <ArrowUpRight size={14} /></button></div></div></section>}

      {tab === "Phone setup" && <section className="page-section"><div className="page-title"><div><div className="eyebrow">CONNECT YOUR PHONE</div><h1>Phone setup</h1><p>Route unanswered calls to the assistant through a supported provider.</p></div><div className={`connection-pill ${config?.providerReady ? "connected" : ""}`}><span className="status-dot" />{config?.providerReady ? "Provider configured" : "Setup needed"}</div></div><div className="setup-steps"><SetupStep number="01" title="Create your Firebase project" description="Enable Google Authentication and Firestore. Add your web app settings and server credentials in the environment file." done={Boolean(user)} /><SetupStep number="02" title="Choose a voice provider" description="Point a Twilio voice webhook to /api/twilio/voice and set its signing token. Your carrier may offer an equivalent call-forwarding option." done={config?.providerReady ?? false} /><SetupStep number="03" title="Set unanswered-call forwarding" description="Ask your carrier or provider to forward unanswered calls to the configured voice number. Test with a number you control." done={false} /></div><div className="provider-note"><ShieldCheck size={18} /><div><strong>Real phone calls need provider setup</strong><p>This app can run its local call simulator today. Live call answering needs a public HTTPS deployment, Firebase credentials, a Twilio number or compatible carrier route, and forwarding enabled on your phone line.</p></div></div></section>}
    </main>

    {activeCall && <div className="modal-backdrop" role="presentation"><div className="call-modal" role="dialog" aria-modal="true" aria-labelledby="call-title"><div className="modal-head"><div><div className="live-indicator"><span /> TEST CALL IN PROGRESS</div><h2 id="call-title">Caller simulation</h2></div><button className="icon-button" onClick={endDemo} aria-label="Close test call"><X size={18} /></button></div><div className="transcript"><div className="disclosure-message"><Sparkles size={15} /> “I’m an AI assistant answering on their behalf. They can’t take the call right now.”</div>{activeCall.turns.slice(1).map((turn, i) => <div key={`${turn.at}-${i}`} className={`chat-row ${turn.role === "caller" ? "caller" : "assistant"}`}><div className="chat-avatar">{turn.role === "caller" ? <UserRound size={15} /> : <Headphones size={15} />}</div><div className="chat-bubble"><span>{turn.role === "caller" ? "Caller" : "AI assistant"}</span><p>{turn.text}</p></div></div>)}{loading && <div className="typing"><span /><span /><span /> Assistant is responding</div>}</div><form className="caller-input" onSubmit={sendTurn}><input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type what the caller says…" maxLength={1200} /><button type="submit" aria-label="Send caller message" disabled={loading || !draft.trim()}><ArrowUpRight size={17} /></button></form>{error && <div className="modal-error">{error}</div>}<div className="modal-foot"><span><ShieldCheck size={14} /> Test conversation is saved in your call history</span><button className="end-call" onClick={endDemo}><Phone size={15} /> End test call</button></div></div></div>}
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    <a className="page-corner" href="/"><Activity size={12} /> Vocalis AI · Back to landing page</a>
  </div>;
}

function StatCard({ label, value, delta, icon, tone }: { label: string; value: string; delta: string; icon: ReactNode; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-delta"><span className="delta-check"><Check size={11} /></span>{delta}</div><div className="stat-spark"><span style={{ height: "32%" }} /><span style={{ height: "48%" }} /><span style={{ height: "40%" }} /><span style={{ height: "62%" }} /><span style={{ height: "55%" }} /><span style={{ height: "76%" }} /><span style={{ height: "68%" }} /><span style={{ height: "90%" }} /></div></div>;
}

function CallTable({ calls, emptyAction }: { calls: CallRecord[]; emptyAction: () => void }) {
  if (!calls.length) return <div className="empty-state"><div className="empty-icon"><PhoneCall size={21} /></div><strong>No calls yet</strong><p>Try a sample conversation to see how messages are captured.</p><button className="text-button" onClick={emptyAction}>Start a test call <ArrowUpRight size={14} /></button></div>;
  return <div className="table-wrap"><table><thead><tr><th>CALLER</th><th>DATE &amp; TIME</th><th>SUMMARY</th><th>STATUS</th><th /></tr></thead><tbody>{calls.map((call) => <tr key={call.id}><td><div className="caller-cell"><div className="call-direction"><ArrowDownLeft size={14} /></div><div><strong>{call.caller}</strong><span>{call.source === "twilio" ? "Phone call" : "Test call"}</span></div></div></td><td><span className="date-cell"><span>{dateLabel(call.createdAt)}</span><small>{timeLabel(call.createdAt)}</small></span></td><td><div className="summary-cell">{call.summary}</div></td><td><span className={`call-status ${call.status}`}><span />{call.status === "completed" ? "Completed" : "In progress"}</span></td><td><button className="row-more" title="More options"><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>;
}

function SetupStep({ number, title, description, done }: { number: string; title: string; description: string; done: boolean }) {
  return <div className="setup-step"><div className={`step-number ${done ? "done" : ""}`}>{done ? <Check size={17} /> : number}</div><div className="step-copy"><strong>{title}</strong><p>{description}</p></div><span className={`step-status ${done ? "done" : ""}`}>{done ? "Ready" : "To do"}</span></div>;
}
