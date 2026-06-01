// dad.jsx — Dad-facing surface: Splash (with long-press affordance) + Home (all states)
const { T, Icon, LolaMark, PrimaryButton } = window;

// ---------------- SPLASH ----------------
// Setup is reached via the OS app-icon shortcut (see AppIconShortcut). The splash only points to it.
function Splash({ logoVariant = "geometric", onEnterHome }) {
  const C = window.COPY.es;
  return (
    <div onClick={() => onEnterHome && onEnterHome()}
      style={{ flex: 1, background: T.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", cursor: "pointer" }}>
      <div style={{ animation: "lolaFloat 3.6s ease-in-out infinite" }}>
        <LolaMark size={92} variant={logoVariant} />
      </div>
      <div style={{ marginTop: 30, textAlign: "center" }}>
        <div style={{ color: "#fff", fontSize: 46, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>Lola</div>
        <div style={{ color: "rgba(255,255,255,.62)", fontSize: 19, fontWeight: 400, marginTop: 12 }}>{C.greeting}</div>
      </div>
      {/* caregiver legend → setup lives on the home-screen app icon, not in the app */}
      <div style={{ position: "absolute", bottom: 28, left: 24, right: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,.62)", fontSize: 13.5, fontWeight: 700 }}>
          <Icon name="settings" size={15} stroke={1.8} /> Configuración
        </span>
        <span style={{ color: "rgba(255,255,255,.4)", fontSize: 12.5, fontWeight: 500, textAlign: "center", lineHeight: 1.35 }}>
          Accedé manteniendo presionado el ícono de la app en tu teléfono
        </span>
      </div>
    </div>
  );
}

// ---------------- APP-ICON SHORTCUT (OS-level vignette for handoff) ----------------
// Demonstrates the Android App Shortcut / iOS Quick Action that opens Setup directly.
function AppIconShortcut({ platform = "android", logoVariant = "geometric", onOpenSetup, onOpenApp }) {
  const ios = platform === "ios";
  const menuBg = ios ? "rgba(248,248,250,.97)" : "#202228";
  const divider = ios ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.09)";
  const labelColor = ios ? "#0C0D0F" : "#fff";
  const subColor = ios ? "#8a8a8e" : "rgba(255,255,255,.5)";

  const Row = ({ label, sub, icon, onClick, accent }) => (
    <button onClick={onClick} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, padding: "14px 18px", textAlign: "left", flexDirection: ios ? "row-reverse" : "row", justifyContent: ios ? "space-between" : "flex-start" }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: accent ? T.primary : (ios ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.08)"), display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={icon} size={18} color={accent ? "#fff" : (ios ? "#3a3a3c" : "rgba(255,255,255,.8)")} stroke={1.8} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: accent ? (ios ? T.primary : "#7FB0F5") : labelColor, fontSize: 16, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: "block", color: subColor, fontSize: 12.5, marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );

  return (
    <div style={{ flex: 1, position: "relative", background: "linear-gradient(165deg,#2c3b54 0%,#4a6188 55%,#735f86 100%)", overflow: "hidden" }}>
      {/* blurred home-screen grid */}
      <div style={{ position: "absolute", inset: 0, padding: "26px 24px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "26px 18px", alignContent: "start", filter: "blur(1.5px)", opacity: .45 }}>
        {Array.from({ length: 16 }).map((_, i) => i === 5 ? <div key={i} /> : <div key={i} style={{ aspectRatio: "1 / 1", borderRadius: 16, background: "rgba(255,255,255,.26)" }} />)}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />

      {/* the lifted, pressed Lola icon */}
      <div style={{ position: "absolute", top: 60, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 3 }}>
        <div style={{ transform: "scale(1.16)", filter: "drop-shadow(0 14px 26px rgba(0,0,0,.55))" }}><LolaMark size={62} variant={logoVariant} /></div>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>Lola</span>
      </div>

      {/* context menu */}
      <div style={{ position: "absolute", top: 176, left: "50%", transform: "translateX(-50%)", width: 266, zIndex: 4, animation: "lolaSheetUp .24s cubic-bezier(0,0,0,1)" }}>
        <div style={{ background: menuBg, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 54px rgba(0,0,0,.5)", backdropFilter: "blur(20px)" }}>
          <div style={{ padding: "12px 18px 7px", fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: subColor }}>Lola</div>
          <Row label="Abrir" icon="camera" onClick={onOpenApp} />
          <div style={{ height: 1, background: divider }} />
          <Row label="Configuración" sub="Para el cuidador" icon="settings" onClick={onOpenSetup} accent />
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 26, left: 24, right: 24, textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 500, lineHeight: 1.45, zIndex: 4 }}>
        {ios ? "Mantené presionado el ícono (Haptic Touch) → Configuración" : "Mantené presionado el ícono → Configuración"}
      </div>
    </div>
  );
}

// ---------------- HOME ----------------
// Active states (listening / thinking / speaking) now play INSIDE the tapped panel.

// soft fade behind the active panel's content
function FieldGlow({ dark }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}>
      <div style={{ width: "130%", aspectRatio: "1 / 1", borderRadius: "50%", background: dark ? "radial-gradient(circle, rgba(90,162,245,.24), transparent 60%)" : "radial-gradient(circle, rgba(96,110,132,.16), transparent 60%)", animation: "lolaGlow 3.6s ease-in-out infinite" }} />
    </div>
  );
}

// content of one panel for a given state
function FieldStage({ dark, action, state }) {
  const C = window.COPY.es;
  const accent = dark ? "#5AA2F5" : T.primary;
  const textColor = dark ? "#fff" : T.ink;
  const circleBg = dark ? "rgba(90,162,245,.16)" : T.primary50;
  const isAsk = action === "ask";
  const spoken = isAsk ? C.askResult : C.describeResult;

  if (state === "idle") {
    return (
      <>
        <div style={{ width: 150, height: 150, borderRadius: "50%", background: circleBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={isAsk ? "askbubble" : "eye"} size={90} color={accent} stroke={1.45} />
        </div>
        <span style={{ color: textColor, fontSize: 44, fontWeight: 800, letterSpacing: "-.5px" }}>{isAsk ? C.ask : C.describe}</span>
      </>
    );
  }
  if (state === "listening") {
    return (
      <>
        <div style={{ width: 112, height: 112, borderRadius: "50%", border: `3px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "lolaPulse 1.5s ease-out infinite" }}>
          <Icon name="mic" size={48} color={textColor} stroke={1.6} />
        </div>
        <span style={{ color: textColor, fontSize: 28, fontWeight: 700 }}>{C.listening}</span>
      </>
    );
  }
  if (state === "thinking") {
    return (
      <>
        <div style={{ position: "relative", width: 112, height: 112, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(12,13,15,.1)"}`, borderTopColor: accent, animation: "lolaSpin 1.2s linear infinite" }} />
          <LolaMark size={52} />
        </div>
        <span style={{ color: textColor, fontSize: 28, fontWeight: 700 }}>{C.thinking}</span>
      </>
    );
  }
  // speaking
  return (
    <>
      <div className="lwave" style={{ marginBottom: 6 }}>{[0,1,2,3,4,5,6].map(i => <span key={i} style={{ animationDelay: `${i * 0.12}s`, background: accent }} />)}</div>
      <span style={{ color: textColor, fontSize: 23, fontWeight: 600, lineHeight: 1.34, textAlign: "center", textWrap: "balance", maxWidth: "18ch" }}>{spoken}</span>
    </>
  );
}

function Home({ force = "idle", homeDir = "dominant", onOpenSettings, errKind = "camera" }) {
  const C = window.COPY.es;
  const [state, setState] = React.useState(force === "error" ? "error" : (["listening", "thinking", "speaking"].includes(force) ? force : "idle"));
  const [mode, setMode] = React.useState(force === "listening" ? "ask" : "describe");
  const timers = React.useRef([]);
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  React.useEffect(() => {
    clearAll();
    if (force === "listening") { setMode("ask"); setState("listening"); }
    else if (force === "thinking") { setMode("describe"); setState("thinking"); }
    else if (force === "speaking") { setMode("describe"); setState("speaking"); }
    else setState(force); // idle | error
  }, [force]);
  React.useEffect(() => () => clearAll(), []);

  const run = (m) => {
    clearAll(); setMode(m);
    if (m === "ask") {
      setState("listening");
      timers.current.push(setTimeout(() => setState("thinking"), 2200));
      timers.current.push(setTimeout(() => setState("speaking"), 4200));
      timers.current.push(setTimeout(() => setState("idle"), 11500)); // Lola finishes on her own
    } else {
      setState("thinking");
      timers.current.push(setTimeout(() => setState("speaking"), 1800));
      timers.current.push(setTimeout(() => setState("idle"), 9500));
    }
  };
  const running = state === "listening" || state === "thinking" || state === "speaking";

  // ---- ERROR (calm, never alarming) ----
  if (state === "error") {
    const perm = errKind === "perm";
    if (!perm) {
      return (
        <div onClick={() => setState("idle")} style={{ flex: 1, background: T.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", textAlign: "center", cursor: "pointer" }}>
          <div style={{ width: 132, height: 132, borderRadius: "50%", background: "rgba(240,180,92,.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
            <Icon name="alert" size={62} color="#F0B45C" stroke={1.6} />
          </div>
          <div style={{ color: "#fff", fontSize: 34, fontWeight: 800, marginBottom: 14, letterSpacing: "-.3px" }}>{C.errCamera}</div>
          <div style={{ color: "rgba(255,255,255,.66)", fontSize: 22, fontWeight: 500, lineHeight: 1.45, maxWidth: "22ch" }}>{C.errCameraSub}</div>
        </div>
      );
    }
    return (
      <div style={{ flex: 1, background: T.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", textAlign: "center" }}>
        <div style={{ width: 132, height: 132, borderRadius: "50%", background: "rgba(240,180,92,.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          <Icon name="camera" size={62} color="#F0B45C" stroke={1.6} />
        </div>
        <div style={{ color: "#fff", fontSize: 34, fontWeight: 800, marginBottom: 14, letterSpacing: "-.3px" }}>{C.errPerm}</div>
        <div style={{ color: "rgba(255,255,255,.66)", fontSize: 22, fontWeight: 500, marginBottom: 44, lineHeight: 1.45, maxWidth: "22ch" }}>{C.errPermSub}</div>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <PrimaryButton dad arrow={false} onClick={() => setState("idle")}>{C.errPermBtn}</PrimaryButton>
        </div>
      </div>
    );
  }

  const Gear = () => onOpenSettings ? (
    <button onClick={onOpenSettings} style={{ position: "absolute", top: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "rgba(128,128,128,.28)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5, backdropFilter: "blur(6px)" }}>
      <Icon name="settings" size={26} color="rgba(255,255,255,.85)" stroke={1.7} />
    </button>
  ) : null;

  // ---- SINGLE ----
  if (homeDir === "single") {
    return (
      <div style={{ flex: 1, background: T.ink, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 26, overflow: "hidden" }}>
        <Gear />
        {running ? (
          <>
            <FieldGlow dark />
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "0 28px" }}>
              <FieldStage dark action={mode} state={state} />
            </div>
          </>
        ) : (
          <>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: 22, fontWeight: 500, marginBottom: 30, textAlign: "center" }}>Tocá y hablá.<br/>Yo me encargo.</div>
            <button onClick={() => run("ask")} style={{ width: 248, height: 248, borderRadius: "50%", background: T.primary, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, boxShadow: "0 18px 50px rgba(26,115,232,.5)" }}>
              <Icon name="qmark" size={84} color="#fff" stroke={1.5} />
              <span style={{ color: "#fff", fontSize: 30, fontWeight: 800 }}>Hablar</span>
            </button>
            <button onClick={() => run("describe")} style={{ marginTop: 34, background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(255,255,255,.25)", color: "#fff", borderRadius: 18, padding: "16px 28px", fontFamily: T.brand, fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <Icon name="scene" size={28} color="#fff" stroke={1.6} /> Describir
            </button>
          </>
        )}
      </div>
    );
  }

  // ---- CARDS (two big buttons anchored to the bottom for thumb reach; clear top/bottom split) ----
  if (homeDir === "cards") {
    const describeState = (mode === "describe" && running) ? state : "idle";
    const askState = (mode === "ask" && running) ? state : "idle";
    const dActive = describeState !== "idle";
    const aActive = askState !== "idle";
    const btnStyle = (bg, active, border) => ({ flex: active ? 1 : (bg === "#fff" ? 1.32 : 0.92), minHeight: 190, width: "100%", background: bg, border: border || "none", borderRadius: 34, cursor: running ? "default" : "pointer", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, opacity: (running && !active) ? 0.26 : 1, transition: "opacity .35s ease, flex .35s ease", boxShadow: bg === "#fff" ? "0 10px 30px rgba(12,13,15,.12)" : "0 14px 36px rgba(12,13,15,.4)" });
    return (
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", background: T.sunken, padding: "0 16px 26px" }}>
        {/* top bar — prompt (left) + settings (right) */}
        <div style={{ flex: "none", height: 46, margin: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: running ? 0 : 1, transition: "opacity .3s" }}>
          <span style={{ color: T.high, fontSize: 21, fontWeight: 800, letterSpacing: "-.2px" }}>{C.homePrompt}</span>
          <button onClick={() => onOpenSettings && onOpenSettings()} aria-label="Configuración" style={{ width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <Icon name="settings" size={22} color={T.low} stroke={1.7} />
          </button>
        </div>
        {/* DESCRIBE (top button) */}
        <button onClick={() => { if (!running) run("describe"); }} disabled={running && !dActive} style={btnStyle("#fff", dActive, `1.5px solid ${T.border}`)}>
          {dActive && <FieldGlow />}
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <FieldStage action="describe" state={describeState} />
          </div>
        </button>
        {/* gap = safe dead-zone between the two */}
        <div style={{ flex: "none", height: 14 }} />
        {/* ASK (bottom button) */}
        <button onClick={() => { if (!running) run("ask"); }} disabled={running && !aActive} style={btnStyle(T.ink, aActive)}>
          {aActive && <FieldGlow dark />}
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <FieldStage dark action="ask" state={askState} />
          </div>
        </button>
      </div>
    );
  }

  // ---- TWO-FIELD (dominant 58/42 or equal) ----
  const topFlex = homeDir === "equal" ? 1 : 1.38;
  const describeState = (mode === "describe" && running) ? state : "idle";
  const askState = (mode === "ask" && running) ? state : "idle";
  const dActive = describeState !== "idle";
  const aActive = askState !== "idle";
  const panelStyle = (bg, active) => ({ flex: bg === "#fff" ? topFlex : 1, background: bg, border: "none", cursor: running ? "default" : "pointer", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24, opacity: (running && !active) ? 0.32 : 1, transition: "opacity .35s ease" });
  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
      <Gear />
      {/* DESCRIBE (top, light) */}
      <button onClick={() => { if (!running) run("describe"); }} disabled={running && !dActive} style={panelStyle("#fff", dActive)}>
        {dActive && <FieldGlow />}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <FieldStage action="describe" state={describeState} />
        </div>
      </button>
      <div style={{ height: 1, background: "rgba(0,0,0,.06)" }} />
      {/* ASK (bottom, dark) */}
      <button onClick={() => { if (!running) run("ask"); }} disabled={running && !aActive} style={panelStyle(T.ink, aActive)}>
        {aActive && <FieldGlow dark />}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <FieldStage dark action="ask" state={askState} />
        </div>
      </button>
    </div>
  );
}

function Flash() {
  const C = window.COPY.es;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(12,13,15,.55)", display: "flex", alignItems: "center", justifyContent: "center", animation: "lolaFlash .65s ease forwards", pointerEvents: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: 78, height: 78, borderRadius: "50%", background: T.success, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={42} color="#fff" stroke={2.4} /></div>
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 700 }}>{C.stopped}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Splash, AppIconShortcut, Home });
