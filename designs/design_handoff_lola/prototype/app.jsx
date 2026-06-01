// app.jsx — orchestrator: scene rail, phone host, navigation, tweaks
const { T, Icon, LolaMark, Phone, Toast, Splash, AppIconShortcut, Home, Setup, ObjectForm, RoomForm } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "homeDir": "equal",
  "logoVariant": "geometric",
  "platform": "android"
}/*EDITMODE-END*/;

const SCENES = [
  { group: "Dad — voice surface", items: [
    { id: "splash", label: "Splash" },
    { id: "home-idle", label: "Home · idle" },
    { id: "home-listening", label: "Home · listening" },
    { id: "home-thinking", label: "Home · thinking" },
    { id: "home-speaking", label: "Home · speaking" },
    { id: "home-err-cam", label: "Home · error (camera)" },
    { id: "home-err-perm", label: "Home · error (permission)" },
  ]},
  { group: "Caregiver — setup", items: [
    { id: "icon-setup", label: "App icon → Setup" },
    { id: "obj-empty", label: "Objects · empty" },
    { id: "obj-list", label: "Objects · list" },
    { id: "obj-many", label: "Objects · 20 items" },
    { id: "obj-new", label: "Object · new" },
    { id: "obj-edit-long", label: "Object · edit (long name)" },
    { id: "room-empty", label: "Rooms · empty" },
    { id: "room-list", label: "Rooms · list" },
    { id: "room-new", label: "Room · new (0 photos)" },
    { id: "room-1", label: "Room · 1 photo" },
    { id: "room-3", label: "Room · 3 photos" },
    { id: "room-5", label: "Room · 5 photos (full)" },
  ]},
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [scene, setScene] = React.useState("splash");
  const [tab, setTab] = React.useState("objects");
  const [objects, setObjects] = React.useState(() => window.OBJECTS.map(o => ({ ...o })));
  const [rooms, setRooms] = React.useState(() => window.ROOMS.map(r => ({ ...r })));
  const [editing, setEditing] = React.useState(null);
  const [navSeq, setNavSeq] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = (text, type = "success") => { clearTimeout(toastTimer.current); setToast({ text, type }); toastTimer.current = setTimeout(() => setToast(null), 2400); };
  function EN() { return window.COPY.en; }

  const go = (id) => {
    setEditing(null);
    setNavSeq(s => s + 1);
    if (id === "obj-empty") { setObjects([]); setTab("objects"); setScene("setup"); return; }
    if (id === "obj-list") { setObjects(window.OBJECTS.map(o => ({ ...o }))); setTab("objects"); setScene("setup"); return; }
    if (id === "obj-many") { setObjects(window.makeManyObjects()); setTab("objects"); setScene("setup"); return; }
    if (id === "room-empty") { setRooms([]); setTab("rooms"); setScene("setup"); return; }
    if (id === "room-list") { setRooms(window.ROOMS.map(r => ({ ...r }))); setTab("rooms"); setScene("setup"); return; }
    if (id === "obj-new") { setEditing({ kind: "object", item: null }); setScene("form-object"); return; }
    if (id === "obj-edit-long") { setEditing({ kind: "object", item: window.OBJECT_LONG }); setScene("form-object"); return; }
    if (id === "room-new") { setEditing({ kind: "room", item: null }); setScene("form-room"); return; }
    if (id === "room-1") { setEditing({ kind: "room", item: { id: "rx", name: "Pasillo", desc: "", photos: 1, tint: 2 } }); setScene("form-room"); return; }
    if (id === "room-3") { setEditing({ kind: "room", item: { id: "rx", name: "Living", desc: "el sillón y la tele", photos: 3, tint: 2 } }); setScene("form-room"); return; }
    if (id === "room-5") { setEditing({ kind: "room", item: { id: "rx", name: "Dormitorio", desc: "su cama y la mesa de luz", photos: 5, tint: 4 } }); setScene("form-room"); return; }
    setScene(id);
  };

  const openSetup = () => { setNavSeq(s => s + 1); setObjects(window.OBJECTS.map(o => ({ ...o }))); setRooms(window.ROOMS.map(r => ({ ...r }))); setTab("objects"); setScene("setup"); };

  const homeForce = scene.startsWith("home-") ? (scene === "home-err-cam" || scene === "home-err-perm" ? "error" : scene.replace("home-", "")) : "idle";
  const errKind = scene === "home-err-perm" ? "perm" : "camera";

  // chrome: status bar (top) and nav bar (bottom) can differ, so home reads white-top / dark-bottom
  const INK = T.ink, CANVAS = T.canvas;
  let content, ch = { statusDark: false, navDark: false, statusBg: CANVAS, navBg: CANVAS, frameBg: CANVAS };
  const statusTime = "9:41";

  if (scene === "splash") {
    content = <Splash logoVariant={t.logoVariant} onEnterHome={() => setScene("home-idle")} />;
    ch = { statusDark: true, navDark: true, statusBg: INK, navBg: INK, frameBg: INK };
  }
  else if (scene === "icon-setup") {
    content = <AppIconShortcut platform={t.platform} logoVariant={t.logoVariant} onOpenSetup={openSetup} onOpenApp={() => setScene("home-idle")} />;
    ch = { statusDark: true, navDark: true, statusBg: "#2c3b54", navBg: "#6c5a7f", frameBg: "#2c3b54" };
  }
  else if (scene.startsWith("home-")) {
    content = <Home force={homeForce} homeDir={t.homeDir} errKind={errKind} />;
    if (t.homeDir === "single" || homeForce === "error") {
      ch = { statusDark: true, navDark: true, statusBg: INK, navBg: INK, frameBg: INK };
    } else {
      // two-panel: white Describir on top, dark Preguntar below — consistent across every state
      ch = { statusDark: false, navDark: true, statusBg: "#fff", navBg: INK, frameBg: "#fff" };
    }
  }
  else if (scene === "setup") {
    content = <Setup tab={tab} onTab={setTab} objects={objects} rooms={rooms}
      onAdd={(which) => { setNavSeq(s => s + 1); setEditing({ kind: which === "objects" ? "object" : "room", item: null }); setScene(which === "objects" ? "form-object" : "form-room"); }}
      onEdit={(which, it) => { setNavSeq(s => s + 1); setEditing({ kind: which === "objects" ? "object" : "room", item: it }); setScene(which === "objects" ? "form-object" : "form-room"); }}
      onDelete={(which, it) => { if (which === "objects") setObjects(o => o.filter(x => x.id !== it.id)); else setRooms(r => r.filter(x => x.id !== it.id)); showToast(EN().deleted, "success"); }}
      onDone={() => setScene("splash")} />;
  }
  else if (scene === "form-object") {
    content = <ObjectForm key={"obj" + navSeq} initial={editing?.item}
      onCancel={() => setScene("setup")}
      onSave={(obj) => {
        setObjects(list => { const i = list.findIndex(x => x.id === obj.id); if (i >= 0) { const c = [...list]; c[i] = { ...c[i], ...obj }; return c; } return [{ ...obj, id: "n" + Date.now() }, ...list]; });
        setTab("objects"); setScene("setup"); showToast(EN().savedObject(obj.name));
      }} />;
  }
  else if (scene === "form-room") {
    content = <RoomForm key={"room" + navSeq} initial={editing?.item}
      onCancel={() => setScene("setup")}
      onSave={(room) => {
        setRooms(list => { const i = list.findIndex(x => x.id === room.id); if (i >= 0) { const c = [...list]; c[i] = { ...c[i], ...room }; return c; } return [{ ...room, id: "n" + Date.now() }, ...list]; });
        setTab("rooms"); setScene("setup"); showToast(EN().savedRoom(room.name));
      }} />;
  }

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden", background: "radial-gradient(120% 120% at 50% 0%, #23262d 0%, #15171b 60%, #0e0f12 100%)", fontFamily: T.brand }}>
      <Rail scene={scene} onGo={go} t={t} />
      <div style={{ position: "absolute", left: 246, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ zoom: "var(--phoneScale,1)" }} id="phoneScaleWrap">
          <Phone platform={t.platform} statusDark={ch.statusDark} navDark={ch.navDark} statusBg={ch.statusBg} navBg={ch.navBg} frameBg={ch.frameBg} statusTime={statusTime}>
            {content}
            <Toast show={!!toast} text={toast?.text} type={toast?.type} />
          </Phone>
        </div>
        <Caption scene={scene} />
      </div>
      <TweaksPanel>
        <TweakSection label="Home layout (Dad)" />
        <TweakRadio label="Direction" value={t.homeDir} options={["equal", "dominant", "single"]} onChange={(v) => setTweak("homeDir", v)} />
        <div style={{ fontSize: 11, color: "#8A929E", margin: "2px 0 10px", lineHeight: 1.5 }}>equal = 50/50 · dominant = Describir bigger · single = one voice button</div>
        <TweakSection label="Logo" />
        <TweakRadio label="Mark" value={t.logoVariant} options={["geometric", "aperture", "bloom"]} onChange={(v) => setTweak("logoVariant", v)} />
        <TweakSection label="Platform chrome" />
        <TweakRadio label="OS" value={t.platform} options={["android", "ios"]} onChange={(v) => setTweak("platform", v)} />
      </TweaksPanel>
    </div>
  );
}

function Caption({ scene }) {
  const map = {
    "splash": "Splash → Home automatically. Setup is reached by long-pressing the app icon (see “App icon → Setup”).",
    "icon-setup": "OS-level long-press menu (Android App Shortcut / iOS Quick Action). Tap “Configuración” → Setup. Wired in app.json.",
    "home-idle": "Tap a panel — the listening → thinking → speaking cycle now plays inside that panel.",
    "home-speaking": "Lola stops on her own when she finishes — calm, no stop button, the other panel dims.",
    "home-err-cam": "Lola just says it out loud, then returns to the menu — no button. Retry = tap a panel again.",
    "home-err-perm": "Camera permission denied — calm, recoverable, in Dad's words.",
  };
  const txt = map[scene];
  if (!txt) return null;
  return <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,.5)", fontSize: 13, fontFamily: T.brand, textAlign: "center", maxWidth: 380, lineHeight: 1.5 }}>{txt}</div>;
}

function Rail({ scene, onGo, t }) {
  const active = (id) => (id === "setup" ? scene === "setup" : scene === id);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 246, background: "rgba(18,20,24,.7)", borderRight: "1px solid rgba(255,255,255,.08)", overflowY: "auto", padding: "22px 0 40px", backdropFilter: "blur(10px)", zIndex: 5 }}>
      <div style={{ padding: "0 20px 18px", display: "flex", alignItems: "center", gap: 11 }}>
        <LolaMark size={32} variant={t.logoVariant} />
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-.2px" }}>Lola</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, fontWeight: 500 }}>Prototype · all screens</div>
        </div>
      </div>
      {SCENES.map((g) => (
        <div key={g.group} style={{ marginBottom: 6 }}>
          <div style={{ padding: "12px 20px 7px", color: "rgba(255,255,255,.38)", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>{g.group}</div>
          {g.items.map((it) => {
            const on = active(it.id);
            return (
              <button key={it.id} onClick={() => onGo(it.id)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 20px", background: on ? "rgba(26,115,232,.18)" : "transparent", border: "none", borderLeft: on ? `3px solid ${T.primary}` : "3px solid transparent", color: on ? "#fff" : "rgba(255,255,255,.66)", fontFamily: T.brand, fontSize: 13.5, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                {it.label}
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ padding: "18px 20px 0", marginTop: 8, borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <a href="../Lola Design.html" style={{ color: "rgba(255,255,255,.5)", fontSize: 12.5, textDecoration: "none", display: "block" }}>← Design hub &amp; UX review</a>
        <a href="../Design System.html" style={{ color: "rgba(255,255,255,.5)", fontSize: 12.5, textDecoration: "none", display: "block", marginTop: 10 }}>◆ Design system</a>
      </div>
    </div>
  );
}

function applyScale() {
  const availH = window.innerHeight - 40;
  document.documentElement.style.setProperty("--phoneScale", Math.max(0.5, Math.min(1, availH / 860)).toFixed(3));
}
window.addEventListener("resize", applyScale);
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
setTimeout(applyScale, 50);
