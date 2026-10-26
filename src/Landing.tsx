import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, AudioLines, Check, Download, Headphones, Menu, Mic, MicOff, Moon, Phone, PhoneOff, Radio, ShieldCheck, Smartphone, Sparkles, Sun, X, Zap } from "lucide-react";

type CallState = "idle" | "active" | "ended";
const lines = [
  ["Vocalis", "Hi Maya, I’m Vocalis, an AI assistant. How can I help today?"],
  ["Maya", "I need to move my appointment to next week."],
  ["Vocalis", "I can take that request and ask the team to call you back. What day works best?"],
  ["Maya", "Tuesday afternoon, please."],
] as const;
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function Landing() {
  const reduce = useReducedMotion();
  const isNativeApp = Capacitor.isNativePlatform();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menu, setMenu] = useState(false);
  const [call, setCall] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [index, setIndex] = useState(-1);
  const [typed, setTyped] = useState("");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installDialog, setInstallDialog] = useState(false);
  const [installed, setInstalled] = useState(false);
  const demo = useRef<HTMLElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("vocalis-theme") as "dark" | "light" | null;
    const initial = saved || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(initial);
    document.documentElement.dataset.vocalisTheme = initial;
  }, []);
  const toggleTheme = () => setTheme((old) => {
    const next = old === "dark" ? "light" : "dark";
    localStorage.setItem("vocalis-theme", next);
    document.documentElement.dataset.vocalisTheme = next;
    return next;
  });
  useEffect(() => {
    const before = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const done = () => { setInstalled(true); setInstallEvent(null); };
    addEventListener("beforeinstallprompt", before);
    addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator && import.meta.env.PROD) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { removeEventListener("beforeinstallprompt", before); removeEventListener("appinstalled", done); };
  }, []);
  useEffect(() => {
    if (call !== "active") return;
    const id = setInterval(() => setIndex((current) => Math.min(current + 1, lines.length - 1)), 5600);
    return () => clearInterval(id);
  }, [call]);
  useEffect(() => {
    if (index < 0) { setTyped(""); return; }
    let pos = 0;
    const sentence = lines[index][1];
    setTyped("");
    const id = setInterval(() => { pos += 1; setTyped(sentence.slice(0, pos)); if (pos >= sentence.length) clearInterval(id); }, reduce ? 0 : 24);
    return () => clearInterval(id);
  }, [index, reduce]);
  const go = (target: string) => { setMenu(false); document.getElementById(target)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };
  const startCall = () => { setCall("active"); setIndex(0); setMuted(false); setTimeout(() => demo.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }), 80); };
  const install = async () => {
    if (!installEvent) { setInstallDialog(true); return; }
    await installEvent.prompt();
    if ((await installEvent.userChoice).outcome === "accepted") setInstallEvent(null);
  };

  return <div className={"vocalis-shell theme-" + theme}>
    <CanvasWaves reduced={Boolean(reduce)} /><div className="ambient ambient-magenta" /><div className="ambient ambient-cyan" /><div className="grain-layer" />
    <header className="site-header flex items-center justify-between">
      <a className="vocalis-brand" href="/"><span className="vocalis-mark"><AudioLines size={21} /></span><span className="vocalis-wordmark">vocalis<span>ai</span></span></a>
      <nav className={"nav-pill" + (menu ? " nav-open" : "")} aria-label="Main navigation"><button onClick={() => go("platform")}>Platform</button><button onClick={() => go("demo")}>Live demo</button><button onClick={() => go("mobile")}>Mobile app</button><span className="nav-divider" /><button className="nav-theme" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>{!isNativeApp && <button className="nav-install" onClick={install}><Download size={15} />{installed ? "Installed" : "Install app"}</button>}</nav>
      <div className="header-right"><div className="network-status"><span className="live-pulse" />DEMO NETWORK <b>LIVE</b></div><button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button className="header-cta" onClick={() => go("demo")}>Get early access <ArrowRight size={15} /></button><button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Open menu">{menu ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>

    <main>
      <section className="hero-section"><div className="hero-copy">
        <motion.div className="hero-kicker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [0.16, 1, .3, 1] }}><span className="kicker-icon"><Sparkles size={14} /></span>THE VOICE LAYER FOR MODERN BUSINESS</motion.div>
        <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .85, ease: [0.16, 1, .3, 1] }}>Conversations that scale.<br /><span>AI voice agents</span><br />that sound human.</motion.h1>
        <motion.p className="hero-subtitle" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18, duration: .75, ease: [0.16, 1, .3, 1] }}>Instant call routing, human empathy, and CRM-ready context—so every caller feels heard, even when your team is away.</motion.p>
        <div className="hero-actions flex items-center gap-3"><MagneticButton onClick={startCall} reduced={Boolean(reduce)}><span className="button-glint" /><Phone size={17} fill="currentColor" />Launch live AI call demo<ArrowRight size={16} /></MagneticButton><button className="secondary-cta" onClick={() => go("platform")}><span className="secondary-play"><ArrowRight size={13} /></span>Explore the platform</button></div>
        <div className="trust-row"><div className="trust-avatars"><span>J</span><span>M</span><span>A</span><span><AudioLines size={12} /></span></div><span>Always-on coverage. <b>Human-first by design.</b></span><i /><span className="trust-safe"><ShieldCheck size={14} />AI disclosure built in</span></div>
      </div><div className="hero-visual"><div className="visual-grid" /><Orb reduced={Boolean(reduce)} active={call === "active"} /><motion.div className="orb-label orb-label-left" animate={reduce ? undefined : { y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 4 }}><span className="label-icon"><Zap size={14} /></span><span><b>Natural response</b><small>Context aware</small></span></motion.div><motion.div className="orb-label orb-label-right" animate={reduce ? undefined : { y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 5 }}><span className="label-icon label-icon-cyan"><Radio size={14} /></span><span><b>Every call, covered</b><small>24 / 7 availability</small></span></motion.div><div className="orbit-caption"><span className="orbit-dot" />VOCALIS VOICE ENGINE <span>01 / 03</span></div></div></section>

      <section className="demo-wrap" id="demo" ref={demo}><div className="demo-heading"><div><div className="section-eyebrow"><span />EXPERIENCE A SAMPLE CALL</div><h2>Hear the difference.</h2><p>A guided, simulated conversation. No phone number, account, or microphone needed.</p></div><div className="simulated-stamp"><span className="stamp-dot" />LOCAL DEMO <span className="stamp-lock"><ShieldCheck size={12} />private</span></div></div>
        <div className="simulator-card glass-surface"><div className="sim-topbar"><div className="sim-person"><span className="sim-avatar"><Headphones size={19} /></span><span><b>Vocalis AI</b><small>Sample conversation · no audio recorded</small></span></div><div className={"sim-state" + (call === "active" ? " sim-live" : "")}><i />{call === "active" ? "In conversation" : call === "ended" ? "Call ended" : "Ready to connect"}</div></div>
          <div className="sim-body"><div className="sim-voice-stage"><div className={"sim-rings" + (call === "active" ? " rings-active" : "")}><span /><span /><span /><div className="sim-orb"><AudioLines size={27} /></div></div><div className="audio-visualizer">{Array.from({ length: 48 }, (_, i) => <i key={i} className={call === "active" && !muted ? "bar-playing" : ""} style={{ "--bar-i": i } as CSSProperties} />)}</div><div className="sim-caption">{call === "active" ? muted ? "Microphone muted · sample only" : "Listening and responding" : "Thoughtful, on-brand conversations"}</div></div>
            <div className="transcript-panel"><div className="transcript-heading"><span><i className="transcript-dot" />LIVE TRANSCRIPT</span><small>SIMULATED</small></div><div className="transcript-window" aria-live="polite">{index < 0 ? <div className="transcript-empty"><span className="transcript-spark"><Sparkles size={16} /></span><b>Your conversation starts here</b><span>Press “Dial demo number” to see Vocalis in action.</span></div> : <>{index > 0 && <TranscriptLine speaker={lines[index - 1][0]} text={lines[index - 1][1]} />}<TranscriptLine speaker={lines[index][0]} text={typed} /></>}</div></div>
          </div><div className="sim-footer"><div className="sim-disclaimer"><ShieldCheck size={14} />Simulated experience · Does not place a real call</div><div className="sim-controls">{call !== "active" ? <button className="dial-button" onClick={startCall}><Phone size={15} fill="currentColor" />Dial demo number</button> : <><button className={"mute-button" + (muted ? " is-muted" : "")} onClick={() => setMuted(!muted)} aria-pressed={muted}>{muted ? <MicOff size={15} /> : <Mic size={15} />}{muted ? "Unmute" : "Mute"}</button><button className="end-button" onClick={() => setCall("ended")}><PhoneOff size={15} />End call</button></>}</div></div>
        </div>
      </section>

      <section id="platform" className="platform-section"><div className="section-heading"><div><div className="section-eyebrow"><span />A BETTER WAY TO ANSWER</div><h2>Every call gets<br /><em>your best voice.</em></h2></div><p>Take repetitive work off your team’s plate while keeping people, privacy, and clear handoffs at the center.</p></div>
        <div className="feature-grid"><Feature number="01 / VOICE" icon={<AudioLines size={18} />} color="magenta-icon" visual={<VoiceBars />} title={<>Sound present.<br />Stay on brand.</>} text="Shape a warm, consistent assistant voice with approved instructions and clear boundaries." reduced={Boolean(reduce)} /><Feature number="02 / ROUTING" icon={<Zap size={18} />} color="cyan-icon" visual={<RouteGraphic />} title={<>Fast, thoughtful<br />call routing.</>} text="Take the first hello, collect the essentials, and tee up the right next step." reduced={Boolean(reduce)} /><Feature number="03 / TRUST" icon={<ShieldCheck size={18} />} color="violet-icon" visual={<PrivacyGraphic />} title={<>Clear about AI.<br />Careful with data.</>} text="Every conversation opens with an AI disclosure. Summaries stay scoped to the right account." reduced={Boolean(reduce)} /></div>
      </section>

      <Metrics reduced={Boolean(reduce)} />
      <section className="mobile-section" id="mobile"><div className="mobile-copy"><div className="section-eyebrow"><span />YOUR ASSISTANT, ONE TAP AWAY</div><h2>At home in your<br /><em>pocket.</em></h2><p>Install Vocalis from your browser. Add it to your iPhone or Android home screen, or package this web app for native app stores.</p><div className="platform-badges"><span><Smartphone size={16} />iOS home screen</span><span><Smartphone size={16} />Android app install</span></div>{isNativeApp ? <div className="native-installed"><Check size={16} />Vocalis is installed as a phone app</div> : <><button className="mobile-install-button" onClick={install}>{installed ? <Check size={17} /> : <Download size={17} />}{installed ? "Vocalis is installed" : "Install Vocalis on this device"}<ArrowRight size={16} /></button><small className="install-note">iPhone: Safari → Share → Add to Home Screen. Android: open in Chrome and tap Install.</small><a className="android-apk-link" href="/downloads/vocalis-android-preview.apk" download><Download size={14} />Download Android preview APK <span>5 MB</span></a><small className="android-apk-note">Developer preview build · API dashboard needs a deployed backend.</small></>}</div>
        <PhonePreview theme={theme} toggleTheme={toggleTheme} /></section>
      <section className="closing-section" id="early-access"><div className="closing-glow" /><div className="section-eyebrow"><span />MAKE SPACE FOR BETTER CONVERSATIONS</div><h2>Let every caller<br /><em>feel the difference.</em></h2><p>Explore the prototype and see where thoughtful voice automation can take your business.</p><MagneticButton onClick={startCall} reduced={Boolean(reduce)}><span className="button-glint" /><Phone size={17} fill="currentColor" />Launch live AI call demo<ArrowRight size={16} /></MagneticButton><a className="dashboard-link" href="/app">Open the call dashboard <ArrowRight size={14} /></a></section>
    </main>
    <footer className="site-footer"><a className="vocalis-brand" href="/"><span className="vocalis-mark"><AudioLines size={18} /></span><span className="vocalis-wordmark">vocalis<span>ai</span></span></a><span>VOICE WITH INTENTION.</span><span>Prototype preview · Live phone answering needs provider setup.</span><button onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button></footer>
    <AnimatePresence>{installDialog && <InstallDialog close={() => setInstallDialog(false)} />}</AnimatePresence>
  </div>;
}

function CanvasWaves({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let w = 0, h = 0, t = 0, raf = 0;
    const cursor = { x: -1000, y: -1000 };
    const resize = () => { const ratio = Math.min(devicePixelRatio || 1, 1.5); w = innerWidth; h = Math.min(innerHeight, 1000); canvas.width = w * ratio; canvas.height = h * ratio; canvas.style.width = w + "px"; canvas.style.height = h + "px"; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); };
    const move = (event: PointerEvent) => { cursor.x = event.clientX; cursor.y = event.clientY; };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let wave = 0; wave < 5; wave += 1) {
        ctx.beginPath(); const stroke = ctx.createLinearGradient(w * .1, 0, w * .9, 0);
        stroke.addColorStop(0, "rgba(255,0,122,0)"); stroke.addColorStop(.45, "rgba(255,0,122,.05)"); stroke.addColorStop(.75, "rgba(0,240,255,.05)"); stroke.addColorStop(1, "rgba(0,240,255,0)");
        ctx.strokeStyle = stroke; ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += 9) { const pull = Math.max(0, 1 - Math.abs(x - cursor.x) / 420); const y = h * (.3 + wave * .1) + Math.sin(x * .004 + t + wave) * 25 - pull * Math.sin(t * 2 + x * .01) * 30; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 34; i += 1) { const x = (i * 151 + t * 40) % (w || 1), y = h * .14 + (i * 91) % (h * .7), dx = x - cursor.x, dy = y - cursor.y, near = Math.sqrt(dx * dx + dy * dy) < 140; ctx.fillStyle = near ? "rgba(0,240,255,.9)" : i % 2 ? "rgba(255,0,122,.45)" : "rgba(0,240,255,.42)"; ctx.beginPath(); ctx.arc(x + (near ? dx * .05 : 0), y + (near ? dy * .05 : 0), near ? 2 : 1.1, 0, Math.PI * 2); ctx.fill(); }
      if (!reduced) { t += .012; raf = requestAnimationFrame(draw); }
    };
    resize(); addEventListener("resize", resize); addEventListener("pointermove", move, { passive: true }); draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); removeEventListener("pointermove", move); };
  }, [reduced]);
  return <canvas className="wave-canvas" ref={ref} aria-hidden="true" />;
}
function Orb({ reduced, active }: { reduced: boolean; active: boolean }) {
  return <motion.div className={"voice-orb-wrap" + (active ? " orb-active" : "")} whileHover={reduced ? undefined : { scale: 1.04 }}>
    <motion.div className="orb-halo" animate={reduced ? undefined : { rotate: 360 }} transition={{ duration: 44, repeat: Infinity, ease: "linear" }} /><div className="orb-ring ring-outer" /><div className="orb-ring ring-inner" /><div className="orb-wave wave-one" /><div className="orb-wave wave-two" /><div className="orb-wave wave-three" />
    <motion.div className="orb-core" animate={reduced ? undefined : { y: [0, -9, 0], scale: active ? [1, 1.04, 1] : [1, 1.025, 1] }} transition={{ duration: active ? 1.3 : 4.6, repeat: Infinity, ease: "easeInOut" }}><span className="orb-core-gloss" /><AudioLines size={39} strokeWidth={1.3} /><i /></motion.div>
    {Array.from({ length: 20 }, (_, i) => <i key={i} className="orb-particle" style={{ "--particle": i } as CSSProperties} />)}
    <div className="orb-status"><i />{active ? "SAMPLE CALL ACTIVE" : "VOICE ENGINE READY"}</div>
  </motion.div>;
}
function MagneticButton({ children, onClick, reduced }: { children: ReactNode; onClick: () => void; reduced: boolean }) {
  const [point, setPoint] = useState({ x: 0, y: 0 });
  return <motion.button className="glass-cta" onClick={onClick} onPointerMove={(e) => { if (reduced) return; const r = e.currentTarget.getBoundingClientRect(); setPoint({ x: (e.clientX - r.left - r.width / 2) * .06, y: (e.clientY - r.top - r.height / 2) * .1 }); }} onPointerLeave={() => setPoint({ x: 0, y: 0 })} animate={{ x: point.x, y: point.y }} whileHover={reduced ? undefined : { scale: 1.04, boxShadow: "0 0 42px rgba(0,240,255,.2),0 0 75px rgba(255,0,122,.15)" }} whileTap={reduced ? undefined : { scale: .96 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>{children}</motion.button>;
}
function TranscriptLine({ speaker, text }: { speaker: string; text: string }) {
  return <div className={"transcript-message" + (speaker === "Maya" ? " caller-message" : "")}><span>{speaker === "Maya" ? "CALLER" : "VOCALIS AI"} <time>NOW</time></span><p>{text}<b className="type-cursor" /></p></div>;
}
function Feature({ number, icon, color, visual, title, text, reduced }: { number: string; icon: ReactNode; color: string; visual: ReactNode; title: ReactNode; text: string; reduced: boolean }) {
  return <motion.article className="feature-card" whileHover={reduced ? undefined : { y: -5 }} transition={{ duration: .3 }}><div className="feature-top"><span className={"feature-icon " + color}>{icon}</span><span className="feature-index">{number}</span></div>{visual}<h3>{title}</h3><p>{text}</p></motion.article>;
}
function VoiceBars() { return <div className="feature-visual voice-lines">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ "--bar-i": i } as CSSProperties} />)}</div>; }
function RouteGraphic() { return <div className="route-graphic"><div className="route-node"><Phone size={15} /></div><span /><span /><div className="route-node route-node-bright"><Headphones size={16} /></div></div>; }
function PrivacyGraphic() { return <div className="privacy-graphic"><div><ShieldCheck size={23} /></div><span className="privacy-ring ring-one" /><span className="privacy-ring ring-two" /></div>; }
function Metrics({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null), visible = useInView(ref, { once: true });
  const values = [{ value: 200, prefix: "<", suffix: "ms", label: "Response target", note: "A design goal, not a measured SLA.", icon: <Zap size={17} />, color: "metric-cyan" }, { value: 2, prefix: "", suffix: "", label: "Mobile platforms", note: "iOS and Android home-screen installs.", icon: <Smartphone size={17} />, color: "metric-pink" }, { value: 0, prefix: "", suffix: "", label: "Default recordings", note: "Prototype saves text summaries only.", icon: <ShieldCheck size={17} />, color: "metric-violet" }];
  return <section className="metrics-section"><div className="metrics-title"><div className="section-eyebrow"><span />BUILT AROUND THE DETAILS</div><h2>More than a voice.<br /><em>A better first hello.</em></h2><p>Clear outcomes without dressing prototype metrics up as production results.</p></div><div className="metrics-grid" ref={ref}>{values.map((item) => <Metric key={item.label} item={item} run={visible && !reduced} />)}</div><div className="metrics-footnote">*Latency value is aspirational; actual performance depends on deployment and provider setup.</div></section>;
}
function Metric({ item, run }: { item: { value: number; prefix: string; suffix: string; label: string; note: string; icon: ReactNode; color: string }; run: boolean }) {
  const [count, setCount] = useState(run ? 0 : item.value);
  useEffect(() => { if (!run) { setCount(item.value); return; } const c = animate(0, item.value, { duration: 1.3, ease: [0.16, 1, .3, 1], onUpdate: (v) => setCount(Math.round(v)) }); return () => c.stop(); }, [item.value, run]);
  return <article className="metric-card glass-surface"><div className={"metric-icon " + item.color}>{item.icon}</div><strong className="metric-number"><span>{item.prefix}</span>{count}<span>{item.suffix}</span></strong><b>{item.label}</b><p>{item.note}</p></article>;
}
function PhonePreview({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  return <div className="phone-mock" aria-label="Vocalis mobile app preview"><div className="phone-frame"><div className="phone-camera" /><div className="phone-screen"><div className="phone-topline"><span>9:41</span><span>•••</span></div><div className="phone-brand"><span className="phone-mark"><AudioLines size={17} /></span><b>vocalis<span>ai</span></b><button onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button></div><div className="phone-greeting"><small>MONDAY, 9:41 AM</small><h3>Good morning.</h3><p>Your voice agent is ready.</p></div><div className="phone-orb"><AudioLines size={24} /></div><div className="phone-status"><i />Assistant is on</div><div className="phone-stat"><span><Phone size={15} />Calls handled</span><b>12</b><small>Today</small></div><div className="phone-bottom"><span className="phone-tab selected"><Radio size={15} />Home</span><span className="phone-tab"><Phone size={15} />Calls</span><span className="phone-tab"><ShieldCheck size={15} />Setup</span></div></div></div><span className="phone-orbit-glow" /><span className="phone-callout callout-top"><i /><span>Installable web app<small>iOS & Android</small></span></span><span className="phone-callout callout-bottom"><ShieldCheck size={16} /><span>Your data stays yours<small>Account-scoped by design</small></span></span></div>;
}
function InstallDialog({ close }: { close: () => void }) {
  return <motion.div className="install-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}><motion.section className="install-dialog glass-surface" role="dialog" aria-modal="true" aria-labelledby="install-title" initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} onClick={(e) => e.stopPropagation()}><button className="dialog-close" onClick={close} aria-label="Close"><X size={18} /></button><span className="install-dialog-icon"><Download size={21} /></span><div className="section-eyebrow"><span />INSTALL VOCALIS</div><h2 id="install-title">Take Vocalis with you.</h2><p>Add this app to your phone’s home screen for an app-like experience.</p><div className="install-steps"><div><b>iPhone or iPad</b><span>Open in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</span></div><div><b>Android</b><span>Open in Chrome, tap the menu, then choose <strong>Install app</strong>.</span></div></div><button className="dialog-done" onClick={close}>Got it <Check size={15} /></button><small>Native App Store and Play Store releases need platform signing and store setup.</small></motion.section></motion.div>;
}
