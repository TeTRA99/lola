// primitives.jsx — tokens + shared UI: phone frame, icons, buttons, fields, rows, toast.
const T = {
  primary: "#1A73E8", primary600: "#1565D8", primary700: "#1557B0", primary50: "#EAF2FE", primary100: "#D2E3FC", primaryDisabled: "#C2CAD6",
  white: "#FFFFFF", canvas: "#F6F7F9", sunken: "#EDF0F4", border: "#E0E4EA", n300: "#CBD2DB", ink: "#0C0D0F",
  high: "#1B1E24", medium: "#5C6470", low: "#8A929E",
  success: "#1E9E5A", successBg: "#E6F6EC", warn: "#B9740A", error: "#D92D20", errorBg: "#FDECEA", errorPressed: "#B42318",
  brand: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  shSm: "0 1px 3px rgba(12,13,15,.06)", shMd: "0 4px 14px rgba(12,13,15,.09)", shLg: "0 10px 30px rgba(12,13,15,.13)",
};

// ---------- Icon (Ionicons-style outline) ----------
const ICON_PATHS = {
  camera: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="3.2"/><circle cx="12" cy="13.5" r="3.7"/><path d="M8 7l1.4-2.4h5.2L16 7"/></g>,
  mic: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21M8.5 21h7"/></g>,
  settings: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5l1.4 2.6 2.9-.5.6 2.9 2.6 1.4-1 2.7 1 2.7-2.6 1.4-.6 2.9-2.9-.5L12 21.5l-1.4-2.6-2.9.5-.6-2.9L4.5 15l1-2.7-1-2.7 2.6-1.4.6-2.9 2.9.5z"/></g>,
  add: (s) => <g fill="none" stroke="currentColor" strokeWidth={s+0.3} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></g>,
  edit: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></g>,
  trash: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 6h17M8 6V3.8h8V6M6.5 6l1 13.5h9l1-13.5M10 10v6M14 10v6"/></g>,
  cube: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinejoin="round"><path d="M12 2.8l8 4.4v9.6L12 21.2l-8-4.4V7.2zM4 7.2l8 4.4 8-4.4M12 11.6V21"/></g>,
  home: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/></g>,
  arrow: (s) => <g fill="none" stroke="currentColor" strokeWidth={s+0.3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M12 6l6 6-6 6"/></g>,
  back: (s) => <g fill="none" stroke="currentColor" strokeWidth={s+0.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></g>,
  check: (s) => <g fill="none" stroke="currentColor" strokeWidth={s+0.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></g>,
  close: (s) => <g fill="none" stroke="currentColor" strokeWidth={s+0.3} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></g>,
  refresh: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2 5.3M20 5v6h-6"/></g>,
  alert: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.2v.2"/></g>,
  time: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/></g>,
  volume: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></g>,
  tag: (s) => <g fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6M12 4v16"/></g>,
};
function Icon({ name, size = 24, color = "currentColor", stroke = 1.7, style }) {
  const draw = ICON_PATHS[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, display: "block", ...style }}>{draw ? draw(stroke) : null}</svg>;
}

// ---------- Lola lens mark ----------
function LolaMark({ size = 40, variant = "geometric", bg = T.primary, ring = "#fff", iris = T.primary }) {
  // variants: geometric (aperture), bloom (iris of light), oo (double-o handled in wordmark)
  const r = size / 40;
  if (variant === "bloom") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="11" fill={bg}/>
        {[13.5,10,6.6].map((rr,i)=><circle key={i} cx="20" cy="20" r={rr} fill="#fff" opacity={0.18+i*0.22}/>)}
        <circle cx="20" cy="20" r="3.6" fill="#fff"/>
      </svg>
    );
  }
  if (variant === "aperture") {
    const blades = [0,60,120,180,240,300];
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="11" fill={bg}/>
        <g transform="translate(20 20)">
          {blades.map((a,i)=>(
            <path key={i} d="M0 -11 L9.5 -5.5 L0 0 Z" fill="#fff" opacity={i%2?0.78:1} transform={`rotate(${a})`}/>
          ))}
          <circle r="3.2" fill={bg}/>
        </g>
      </svg>
    );
  }
  // geometric (default): clean lens with offset catchlight
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect width="40" height="40" rx="11" fill={bg}/>
      <circle cx="20" cy="20" r="11" fill={ring}/>
      <circle cx="20" cy="20" r="5.6" fill={iris}/>
      <circle cx="22.6" cy="17.4" r="1.9" fill="#fff"/>
    </svg>
  );
}

// ---------- Photo placeholder (stand-in for reference photo) ----------
function PhotoPlaceholder({ tint = 0, label, radius = 8, style, mono = true }) {
  const [a, b] = (window.PHOTO_TINTS && window.PHOTO_TINTS[tint]) || ["#cbd6e6", "#9fb4cf"];
  const id = "ph" + Math.random().toString(36).slice(2, 7);
  return (
    <div style={{ position: "relative", borderRadius: radius, overflow: "hidden", background: `linear-gradient(135deg,${a},${b})`, ...style }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, opacity: .35 }}>
        <defs><pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#fff" strokeWidth="1.4"/></pattern></defs>
        <rect width="100" height="100" fill={`url(#${id})`}/>
      </svg>
      {label && <div style={{ position: "absolute", left: 0, right: 0, bottom: 6, textAlign: "center", fontFamily: mono ? T.mono : T.brand, fontSize: 9, color: "rgba(20,28,40,.62)", letterSpacing: ".3px" }}>{label}</div>}
    </div>
  );
}

// ---------- Phone status bar + nav (platform aware) ----------
function StatusBar({ dark = false, platform = "ios", time = "9:41", bg }) {
  const c = dark ? "#fff" : T.ink;
  return (
    <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", flex: "none", color: c, fontFamily: T.brand, background: bg || "transparent" }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: platform === "ios" ? "0" : ".2px" }}>{time}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="17" height="12" viewBox="0 0 17 12" fill={c}><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1"/><rect x="9" y="2" width="3" height="10" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1" opacity=".4"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill={c}><path d="M8.5 2.5c2.3 0 4.4.9 6 2.4l-1.4 1.4a6.6 6.6 0 0 0-9.2 0L2.5 4.9A8.6 8.6 0 0 1 8.5 2.5zM8.5 6c1.2 0 2.3.5 3.1 1.3l-3.1 3.1L5.4 7.3A4.4 4.4 0 0 1 8.5 6z"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke={c} strokeWidth="1.2" opacity=".5"/><rect x="2.6" y="2.6" width="16" height="7.8" rx="1.6" fill={c}/><rect x="23.4" y="4" width="1.6" height="5" rx=".8" fill={c} opacity=".5"/></svg>
      </div>
    </div>
  );
}
function NavBar({ dark = false, platform = "ios", bg }) {
  const c = dark ? "rgba(255,255,255,.92)" : "rgba(12,13,15,.5)";
  if (platform === "android") {
    return (
      <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center", gap: 64, flex: "none", background: bg || "transparent" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M15 5l-7 7 7 7"/></svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </div>
    );
  }
  return <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", background: bg || "transparent" }}><div style={{ width: 134, height: 5, borderRadius: 3, background: c }}/></div>;
}

// ---------- Phone frame ----------
function Phone({ children, platform = "ios", statusDark = false, navDark, statusTime, statusBg, navBg, frameBg = "#fff", noChrome = false, hideNav = false }) {
  return (
    <div style={{ width: 384, height: 812, background: frameBg, borderRadius: 44, overflow: "hidden", position: "relative", boxShadow: "0 30px 80px rgba(12,13,15,.28), 0 0 0 11px #15171b, 0 0 0 12px #2b2e34", display: "flex", flexDirection: "column", fontFamily: T.brand }}>
      {!noChrome && <StatusBar dark={statusDark} platform={platform} time={statusTime} bg={statusBg} />}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>{children}</div>
      {!noChrome && !hideNav && <NavBar dark={navDark !== undefined ? navDark : statusDark} platform={platform} bg={navBg} />}
    </div>
  );
}

// ---------- Buttons ----------
function PrimaryButton({ children, onClick, arrow = true, disabled, danger, full = true, style, dad = false }) {
  const [press, setPress] = React.useState(false);
  const bg = disabled ? T.primaryDisabled : danger ? (press ? T.errorPressed : T.error) : (press ? T.primary700 : T.primary);
  return (
    <button onClick={disabled ? undefined : onClick}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{ width: full ? "100%" : "auto", background: bg, color: "#fff", border: "none", borderRadius: dad ? 20 : 12, padding: dad ? "22px 24px" : "16px 24px", fontFamily: T.brand, fontWeight: 700, fontSize: dad ? 22 : 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", transition: "background .12s", boxShadow: disabled ? "none" : T.shSm, ...style }}>
      {children}{arrow && !disabled && <Icon name="arrow" size={dad ? 24 : 22} stroke={2} />}
    </button>
  );
}
function SecondaryButton({ children, onClick, style, icon }) {
  return (
    <button onClick={onClick} style={{ background: T.white, color: T.primary, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 20px", fontFamily: T.brand, fontWeight: 700, fontSize: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", ...style }}>
      {icon && <Icon name={icon} size={18} stroke={2} />}{children}
    </button>
  );
}

// ---------- Field (always-visible label) ----------
function Field({ label, value, onChange, placeholder, focusKey, focused, onFocus, multiline, error }) {
  return (
    <div onClick={() => onFocus && onFocus(focusKey)}
      style={{ background: T.white, border: `1.5px solid ${error ? T.error : focused ? T.primary : T.border}`, borderRadius: 12, padding: "11px 16px 12px", position: "relative", boxShadow: focused ? `0 0 0 3px ${T.primary50}` : "none", transition: "border .12s, box-shadow .12s", cursor: "text", minHeight: multiline ? 96 : "auto" }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: error ? T.error : T.medium, lineHeight: "14px", marginBottom: 3 }}>{label}</span>
      <input value={value} onChange={(e) => onChange && onChange(e.target.value)} placeholder={placeholder || ""}
        style={{ border: "none", outline: "none", background: "transparent", fontFamily: T.brand, fontSize: 16, lineHeight: "22px", color: T.high, width: "100%", padding: 0, display: "block" }} />
    </div>
  );
}
function CanonicalHint({ value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: T.low, flex: "none" }}>Internal name</span>
      <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.medium, background: T.sunken, padding: "2px 8px", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{value || "—"}</span>
    </div>
  );
}

// ---------- Tabs ----------
function Tabs({ value, onChange, items }) {
  return (
    <div style={{ display: "flex", gap: 6, background: T.sunken, padding: 5, borderRadius: 13 }}>
      {items.map((it) => (
        <button key={it.key} onClick={() => onChange(it.key)}
          style={{ flex: 1, padding: "12px 8px", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: T.brand, fontWeight: 700, fontSize: 15.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: value === it.key ? T.white : "transparent", color: value === it.key ? T.high : T.medium, boxShadow: value === it.key ? T.shSm : "none", transition: "all .15s" }}>
          <Icon name={it.icon} size={18} stroke={1.8} />{it.label}
        </button>
      ))}
    </div>
  );
}

// ---------- List row ----------
function ListRow({ thumb, title, subtitle, onEdit, onDelete, seenIcon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 12px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 14 }}>
      {thumb}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: T.high, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: T.medium, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>{seenIcon && <Icon name="time" size={13} stroke={1.8} color={T.low} />}{subtitle}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flex: "none" }}>
        <button onClick={onEdit} style={{ width: 44, height: 40, borderRadius: 9, border: `1px solid ${T.border}`, background: T.white, color: T.medium, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="edit" size={18} stroke={1.8} /></button>
        <button onClick={onDelete} style={{ width: 44, height: 40, borderRadius: 9, border: "none", background: T.error, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="trash" size={18} stroke={1.9} /></button>
      </div>
    </div>
  );
}

// ---------- Toast ----------
function Toast({ show, text, type = "success" }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 60, transition: "transform .26s cubic-bezier(0,0,0,1), opacity .26s", transform: show ? "translateY(0)" : "translateY(24px)", opacity: show ? 1 : 0 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 11, background: T.ink, color: "#fff", padding: "13px 18px", borderRadius: 13, fontWeight: 600, fontSize: 15, boxShadow: T.shLg, maxWidth: "84%" }}>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: type === "error" ? T.error : T.success, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Icon name={type === "error" ? "close" : "check"} size={15} color="#fff" stroke={2.4} />
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
      </div>
    </div>
  );
}

// ---------- Header (caregiver) ----------
function SetupHeader({ title, onBack, onDone, rightLabel }) {
  return (
    <div style={{ padding: "6px 18px 14px", borderBottom: `1px solid ${T.border}`, flex: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 40 }}>
        {onBack ? <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 2, color: T.primary, fontFamily: T.brand, fontSize: 16, fontWeight: 600, cursor: "pointer", marginLeft: -6 }}><Icon name="back" size={22} /> </button> : <div style={{ width: 40 }} />}
        <div style={{ fontSize: 19, fontWeight: 800, color: T.high }}>{title}</div>
        {rightLabel ? <button onClick={onDone} style={{ background: "none", border: "none", color: T.primary, fontFamily: T.brand, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>{rightLabel}</button> : <div style={{ width: 40 }} />}
      </div>
    </div>
  );
}

Object.assign(window, { T, Icon, LolaMark, PhotoPlaceholder, StatusBar, NavBar, Phone, PrimaryButton, SecondaryButton, Field, CanonicalHint, Tabs, ListRow, Toast, SetupHeader });
