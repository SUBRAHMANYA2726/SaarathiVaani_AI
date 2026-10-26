import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, AudioLines, Check, Download, Headphones, Menu, Moon, Phone, Radio, ShieldCheck, Smartphone, Sparkles, Sun, X, Zap } from "lucide-react";

type Readiness = { firebase: Record<string, string> | null; firebaseAdminReady: boolean; firebaseWebReady: boolean; aiReady: boolean; twilioReady: boolean; liveReady: boolean };
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export default function Landing() {
  const reduce = useReducedMotion();
  const isNativeApp = Capacitor.isNativePlatform();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menu, setMenu] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installDialog, setInstallDialog] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("vocalis-theme") as "dark" | "light" | null;
    const initial = saved || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(initial);
    document.documentElement.dataset.vocalisTheme = initial;
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(apiBase + "/api/config", { cache: "no-store" });
        if (!response.ok) throw new Error("Live service status is unavailable.");
        const value = await response.json() as Readiness;
        if (active) setReadiness(value);
      } catch {
        if (active) setReadiness({ firebase: null, firebaseAdminReady: false, firebaseWebReady: false, aiReady: false, twilioReady: false, liveReady: false });
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; clearInterval(timer); };
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
  const go = (target: string) => { setMenu(false); document.getElementById(target)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };
  const openPhoneSetup = () => go("phone-setup");
  const install = async () => {
    if (!installEvent) { setInstallDialog(true); return; }
    await installEvent.prompt();
    if ((await installEvent.userChoice).outcome === "accepted") setInstallEvent(null);
  };

  return <div className={"vocalis-shell theme-" + theme}>
    <CanvasWaves reduced={Boolean(reduce)} /><div className="ambient ambient-magenta" /><div className="ambient ambient-cyan" /><div className="grain-layer" />
    <header className="site-header flex items-center justify-between">
      <a className="vocalis-brand" href="/"><span className="vocalis-mark"><AudioLines size={21} /></span><span className="vocalis-wordmark">vocalis<span>ai</span></span></a>
      <nav className={"nav-pill" + (menu ? " nav-open" : "")} aria-label="Main navigation"><button onClick={() => go("platform")}>Platform</button><button onClick={openPhoneSetup}>Phone setup</button><button onClick={() => go("mobile")}>Mobile app</button><span className="nav-divider" /><button className="nav-theme" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>{!isNativeApp && <button className="nav-install" onClick={install}><Download size={15} />{installed ? "Installed" : "Install app"}</button>}</nav>
      <div className="header-right"><div className={"network-status" + (readiness?.liveReady ? " status-ready" : "")}><span className="live-pulse" />PHONE CONFIG <b>{readiness?.liveReady ? "READY" : "NOT CONNECTED"}</b></div><button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button className="header-cta" onClick={openPhoneSetup}>Connect phone <ArrowRight size={15} /></button><button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Open menu">{menu ? <X size={20} /> : <Menu size={20} />}</button></div>
    </header>

    <main>
      <section className="hero-section"><div className="hero-copy">
        <motion.div className="hero-kicker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [0.16, 1, .3, 1] }}><span className="kicker-icon"><Sparkles size={14} /></span>THE VOICE LAYER FOR MODERN BUSINESS</motion.div>
        <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .85, ease: [0.16, 1, .3, 1] }}>Conversations That Scale.<br /><span>AI Voice Agents</span><br />That Sound Human.</motion.h1>
        <motion.p className="hero-subtitle" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18, duration: .75, ease: [0.16, 1, .3, 1] }}>Instant call routing, human empathy, and CRM-ready context—so every caller feels heard, even when your team is away.</motion.p>
        <div className="hero-actions flex items-center gap-3"><MagneticButton onClick={openPhoneSetup} reduced={Boolean(reduce)}><span className="button-glint" /><Phone size={17} fill="currentColor" />Connect live phone service<ArrowRight size={16} /></MagneticButton><button className="secondary-cta" onClick={() => go("platform")}><span className="secondary-play"><ArrowRight size={13} /></span>Explore the platform</button></div>
        <div className="trust-row"><div className="trust-avatars"><span>J</span><span>M</span><span>A</span><span><AudioLines size={12} /></span></div><span>Always-on coverage. <b>Human-first by design.</b></span><i /><span className="trust-safe"><ShieldCheck size={14} />AI disclosure built in</span></div>
      </div><div className="hero-visual"><div className="visual-grid" /><Orb reduced={Boolean(reduce)} ready={Boolean(readiness?.liveReady)} /><motion.div className="orb-label orb-label-left" animate={reduce ? undefined : { y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 4 }}><span className="label-icon"><Zap size={14} /></span><span><b>AI voice model</b><small>{readiness?.aiReady ? "Connected" : "Not connected"}</small></span></motion.div><motion.div className="orb-label orb-label-right" animate={reduce ? undefined : { y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 5 }}><span className="label-icon label-icon-cyan"><Radio size={14} /></span><span><b>Incoming phone route</b><small>{readiness?.twilioReady ? "Provider configured" : "Not connected"}</small></span></motion.div><div className={"orbit-caption" + (readiness?.liveReady ? " readiness-live" : "")}><span className="orbit-dot" />VOCALIS PHONE SERVICE <span>{readiness?.liveReady ? "READY" : "OFFLINE"}</span></div></div></section>

      <section className="demo-wrap phone-setup-section" id="phone-setup"><div className="demo-heading"><div><div className="section-eyebrow"><span />LIVE PHONE SERVICE</div><h2>Connect the real call path.</h2><p>This page does not place simulated calls. Readiness below comes from the running server.</p></div><div className={"simulated-stamp" + (readiness?.liveReady ? " readiness-on" : "")}><span className="stamp-dot" />{readiness?.liveReady ? "CONFIG READY" : "NOT CONNECTED"}</div></div>
        <div className="service-readiness glass-surface"><div className="readiness-summary"><div className="readiness-mark"><Phone size={21} /></div><div><strong>{readiness?.liveReady ? "Server configuration is ready" : "Live phone assistant is not connected"}</strong><p>{readiness?.liveReady ? "Firebase, Twilio settings, and a reachable AI model are present. Confirm your Twilio webhook and enable carrier forwarding." : "Connect the services below, deploy the API over HTTPS, then configure the Twilio webhook and forward unanswered calls from your phone."}</p></div><a href="/app" className="dashboard-link">Open setup <ArrowRight size={14} /></a></div><div className="readiness-grid"><ReadinessItem label="Firebase Google sign-in config" ready={Boolean(readiness?.firebaseWebReady)} /><ReadinessItem label="Firebase Admin credentials" ready={Boolean(readiness?.firebaseAdminReady)} /><ReadinessItem label="AI model reachable" ready={Boolean(readiness?.aiReady)} mode="reachable" /><ReadinessItem label="Twilio account settings" ready={Boolean(readiness?.twilioReady)} /><ReadinessItem label="Carrier call forwarding" ready={false} manual /></div><p className="readiness-note">The app checks server settings and model reachability. It cannot verify your Twilio Console webhook or carrier forwarding settings.</p></div>
      </section>

      <section id="platform" className="platform-section"><div className="section-heading"><div><div className="section-eyebrow"><span />A BETTER WAY TO ANSWER</div><h2>Every call gets<br /><em>your best voice.</em></h2></div><p>Take repetitive work off your team’s plate while keeping people, privacy, and clear handoffs at the center.</p></div>
        <div className="feature-grid"><Feature number="01 / VOICE" icon={<AudioLines size={18} />} color="magenta-icon" visual={<VoiceBars />} title={<>Sound present.<br />Stay on brand.</>} text="Shape a warm, consistent assistant voice with approved instructions and clear boundaries." reduced={Boolean(reduce)} /><Feature number="02 / ROUTING" icon={<Zap size={18} />} color="cyan-icon" visual={<RouteGraphic />} title={<>Fast, thoughtful<br />call routing.</>} text="Take the first hello, collect the essentials, and tee up the right next step." reduced={Boolean(reduce)} /><Feature number="03 / TRUST" icon={<ShieldCheck size={18} />} color="violet-icon" visual={<PrivacyGraphic />} title={<>Clear about AI.<br />Careful with data.</>} text="Every conversation opens with an AI disclosure. Summaries stay scoped to the right account." reduced={Boolean(reduce)} /></div>
      </section>

      <ServiceStatus readiness={readiness} reduced={Boolean(reduce)} />
      <section className="mobile-section" id="mobile"><div className="mobile-copy"><div className="section-eyebrow"><span />YOUR ASSISTANT, ONE TAP AWAY</div><h2>At home in your<br /><em>pocket.</em></h2><p>Install the Vocalis web app on your phone to review call summaries and manage approved instructions.</p><div className="platform-badges"><span><Smartphone size={16} />iOS home screen</span><span><Smartphone size={16} />Android app install</span></div>{isNativeApp ? <div className="native-installed"><Check size={16} />Vocalis is installed as a phone app</div> : <><button className="mobile-install-button" onClick={install}>{installed ? <Check size={17} /> : <Download size={17} />}{installed ? "Vocalis is installed" : "Install Vocalis on this device"}<ArrowRight size={16} /></button><small className="install-note">iPhone: Safari → Share → Add to Home Screen. Android: open in Chrome and tap Install.</small><a className="android-apk-link" href="/downloads/vocalis-android-preview.apk" download><Download size={14} />Download Android development APK <span>5 MB</span></a><small className="android-apk-note">Development build only. Connect a deployed backend before using call records.</small></>}</div>
        <div className="mobile-install-panel glass-surface"><span className="install-dialog-icon"><Smartphone size={21} /></span><h3>Phone app access</h3><p>The installed app opens the same account dashboard. It does not intercept phone calls; call forwarding is configured with your carrier.</p><a className="dashboard-link" href="/app">Open the account dashboard <ArrowRight size={14} /></a></div></section>
      <section className="closing-section" id="early-access"><div className="closing-glow" /><div className="section-eyebrow"><span />CONNECT YOUR PHONE SERVICE</div><h2>Give every caller<br /><em>a thoughtful first hello.</em></h2><p>Check service readiness and connect the provider that will route your unanswered calls.</p><MagneticButton onClick={openPhoneSetup} reduced={Boolean(reduce)}><span className="button-glint" /><Phone size={17} fill="currentColor" />Set up live calls<ArrowRight size={16} /></MagneticButton><a className="dashboard-link" href="/app">Open the call dashboard <ArrowRight size={14} /></a></section>
    </main>
    <footer className="site-footer"><a className="vocalis-brand" href="/"><span className="vocalis-mark"><AudioLines size={18} /></span><span className="vocalis-wordmark">vocalis<span>ai</span></span></a><span>VOICE WITH INTENTION.</span><span>{readiness?.liveReady ? "Phone service ready" : "Phone service not connected"}</span><button onClick={toggleTheme} aria-label="Toggle theme">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button></footer>
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
function Orb({ reduced, ready }: { reduced: boolean; ready: boolean }) {
  const [hovered, setHovered] = useState(false);
  return <motion.div className={("voice-orb-wrap" + (ready ? " orb-active" : "")) + (hovered ? " orb-hovered" : "")} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} whileHover={reduced ? undefined : { scale: 1.04 }}>
    <motion.div className="orb-halo" animate={reduced ? undefined : { rotate: 360 }} transition={{ duration: 44, repeat: Infinity, ease: "linear" }} /><div className="orb-ring ring-outer" /><div className="orb-ring ring-inner" /><div className="orb-wave wave-one" /><div className="orb-wave wave-two" /><div className="orb-wave wave-three" />
    <motion.div className="orb-core" animate={reduced ? undefined : { y: [0, -9, 0], scale: ready ? [1, 1.04, 1] : [1, 1.025, 1] }} transition={{ duration: ready ? 1.8 : 4.6, repeat: Infinity, ease: "easeInOut" }}><span className="orb-core-gloss" /><AudioLines size={39} strokeWidth={1.3} /><i /></motion.div>
    {Array.from({ length: 20 }, (_, i) => <i key={i} className="orb-particle" style={{ "--particle": i } as CSSProperties} />)}
    <div className={"orb-status" + (ready ? " readiness-live" : "")}><i />{ready ? "SERVER CONFIG READY" : "PHONE SERVICE OFFLINE"}</div>
  </motion.div>;
}
function MagneticButton({ children, onClick, reduced }: { children: ReactNode; onClick: () => void; reduced: boolean }) {
  const [point, setPoint] = useState({ x: 0, y: 0, rotateX: 0, rotateY: 0 });
  return <motion.button className="glass-cta" onClick={onClick} onPointerMove={(e) => { if (reduced || e.pointerType !== "mouse") return; const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; setPoint({ x: x * 10, y: y * 8, rotateX: -y * 9, rotateY: x * 11 }); }} onPointerLeave={() => setPoint({ x: 0, y: 0, rotateX: 0, rotateY: 0 })} animate={{ x: point.x, y: point.y, rotateX: point.rotateX, rotateY: point.rotateY, transformPerspective: 900 }} whileHover={reduced ? undefined : { scale: 1.04, boxShadow: "0 0 42px rgba(0,240,255,.2),0 0 75px rgba(255,0,122,.15)" }} whileTap={reduced ? undefined : { scale: .96 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>{children}</motion.button>;
}
function Feature({ number, icon, color, visual, title, text, reduced }: { number: string; icon: ReactNode; color: string; visual: ReactNode; title: ReactNode; text: string; reduced: boolean }) {
  return <motion.article className="feature-card" whileHover={reduced ? undefined : { y: -5 }} transition={{ duration: .3 }}><div className="feature-top"><span className={"feature-icon " + color}>{icon}</span><span className="feature-index">{number}</span></div>{visual}<h3>{title}</h3><p>{text}</p></motion.article>;
}
function ReadinessItem({ label, ready, manual = false, mode = "configured" }: { label: string; ready: boolean; manual?: boolean; mode?: "configured" | "reachable" }) {
  return <div className="readiness-item"><span className={"readiness-check" + (ready ? " ready" : "")}>{ready ? <Check size={14} /> : manual ? <Smartphone size={14} /> : <X size={14} />}</span><span>{label}</span><b className={ready ? "ready" : ""}>{ready ? mode === "reachable" ? "Reachable" : "Configured" : manual ? "Manual setup" : "Not configured"}</b></div>;
}
function VoiceBars() { return <div className="feature-visual voice-lines">{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ "--bar-i": i } as CSSProperties} />)}</div>; }
function RouteGraphic() { return <div className="route-graphic"><div className="route-node"><Phone size={15} /></div><span /><span /><div className="route-node route-node-bright"><Headphones size={16} /></div></div>; }
function PrivacyGraphic() { return <div className="privacy-graphic"><div><ShieldCheck size={23} /></div><span className="privacy-ring ring-one" /><span className="privacy-ring ring-two" /></div>; }
function ServiceStatus({ readiness, reduced }: { readiness: Readiness | null; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null), visible = useInView(ref, { once: true });
  const checks = [
    { title: "Google sign-in", detail: "Firebase web app settings", status: readiness?.firebaseWebReady ? "Configured" : "Not configured", icon: <ShieldCheck size={17} /> },
    { title: "Firebase Admin", detail: "Server credentials configured", status: readiness?.firebaseAdminReady ? "Configured" : "Not configured", icon: <ShieldCheck size={17} /> },
    { title: "AI model", detail: "Live server reachability check", status: readiness?.aiReady ? "Reachable" : "Offline", icon: <Zap size={17} /> },
    { title: "Twilio settings", detail: "Account credentials configured", status: readiness?.twilioReady ? "Configured" : "Not configured", icon: <Phone size={17} /> },
  ];
  return <section className="metrics-section service-status-section"><div className="metrics-title"><div className="section-eyebrow"><span />LIVE SERVICE STATUS</div><h2>Know what is<br /><em>actually connected.</em></h2><p>Status is read from the running backend. No sample calls or made-up performance claims.</p></div><div className="metrics-grid service-status-grid" ref={ref}>{checks.map((item, i) => <motion.article key={item.title} className="metric-card glass-surface" initial={reduced ? false : { opacity: 0, y: 14 }} animate={visible || reduced ? { opacity: 1, y: 0 } : undefined} transition={{ duration: .5, delay: i * .08 }}><div className={"metric-icon " + (item.status === "Reachable" || item.status === "Configured" ? "metric-cyan" : "metric-violet")}>{item.icon}</div><strong className="metric-number service-state">{item.status}</strong><b>{item.title}</b><p>{item.detail}</p></motion.article>)}</div><div className="metrics-footnote">Carrier call forwarding must be enabled manually on your phone or carrier account.</div></section>;
}
function InstallDialog({ close }: { close: () => void }) {
  return <motion.div className="install-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}><motion.section className="install-dialog glass-surface" role="dialog" aria-modal="true" aria-labelledby="install-title" initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} onClick={(e) => e.stopPropagation()}><button className="dialog-close" onClick={close} aria-label="Close"><X size={18} /></button><span className="install-dialog-icon"><Download size={21} /></span><div className="section-eyebrow"><span />INSTALL VOCALIS</div><h2 id="install-title">Take Vocalis with you.</h2><p>Add this app to your phone’s home screen for an app-like experience.</p><div className="install-steps"><div><b>iPhone or iPad</b><span>Open in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</span></div><div><b>Android</b><span>Open in Chrome, tap the menu, then choose <strong>Install app</strong>.</span></div></div><button className="dialog-done" onClick={close}>Got it <Check size={15} /></button><small>Native App Store and Play Store releases need platform signing and store setup.</small></motion.section></motion.div>;
}
