// caregiver.jsx — Caregiver surface: Setup tabs, lists, forms, capture modal
const { T, Icon, LolaMark, PhotoPlaceholder, PrimaryButton, SecondaryButton, Field, CanonicalHint, Tabs, ListRow, SetupHeader } = window;
const EN = () => window.COPY.en;

// ---------------- EMPTY STATE ----------------
function EmptyState({ kind, onAdd }) {
  const C = EN();
  const room = kind === "rooms";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", textAlign: "center" }}>
      <div style={{ width: 96, height: 96, borderRadius: 26, background: T.primary50, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Icon name={room ? "home" : "cube"} size={48} color={T.primary} stroke={1.5} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.high, marginBottom: 10, letterSpacing: "-.3px" }}>{room ? C.emptyRoomTitle : C.emptyObjTitle}</div>
      <div style={{ fontSize: 15, color: T.medium, lineHeight: 1.55, marginBottom: 28, maxWidth: "30ch" }}>{room ? C.emptyRoomBody : C.emptyObjBody}</div>
      <div style={{ width: "100%", maxWidth: 300 }}>
        <PrimaryButton onClick={onAdd} arrow><Icon name="add" size={22} stroke={2} color="#fff" />{room ? C.emptyRoomCta : C.emptyObjCta}</PrimaryButton>
      </div>
    </div>
  );
}

// ---------------- SETUP LIST ----------------
function Setup({ tab = "objects", onTab, objects, rooms, onAdd, onEdit, onDelete, onDone, scrollTop }) {
  const C = EN();
  const list = tab === "objects" ? objects : rooms;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.canvas }}>
      <SetupHeader title={C.setup} onDone={onDone} rightLabel={C.done} />
      <div style={{ padding: "16px 18px 10px", flex: "none" }}>
        <Tabs value={tab} onChange={onTab} items={[{ key: "objects", label: C.objects, icon: "cube" }, { key: "rooms", label: C.rooms, icon: "home" }]} />
      </div>
      {list.length === 0 ? (
        <EmptyState kind={tab} onAdd={() => onAdd(tab)} />
      ) : (
        <>
          <div style={{ padding: "6px 18px 12px", flex: "none" }}>
            <PrimaryButton onClick={() => onAdd(tab)} arrow={false}><Icon name="add" size={22} stroke={2} color="#fff" />{tab === "objects" ? C.addObject : C.addRoom}</PrimaryButton>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((it) => (
              <ListRow key={it.id}
                thumb={<PhotoPlaceholder tint={it.tint} label={tab === "rooms" ? `${it.photos}/5` : "ref"} style={{ width: 56, height: 56, flex: "none" }} />}
                title={it.name}
                seenIcon={tab === "objects"}
                subtitle={tab === "objects"
                  ? (it.desc ? it.desc + (it.seen ? ` · ${C.lastSeen(it.seen).toLowerCase()}` : "") : (it.seen ? C.lastSeen(it.seen) : C.neverSeen))
                  : (it.desc || `${it.photos} ${it.photos === 1 ? "photo" : "photos"}`)}
                onEdit={() => onEdit(tab, it)} onDelete={() => onDelete(tab, it)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- CAPTURE MODAL ----------------
function CaptureModal({ hint, tint = 0, onUse, onCancel }) {
  const C = EN();
  const [phase, setPhase] = React.useState("live"); // live | review
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, background: "#000", display: "flex", flexDirection: "column", animation: "lolaSheetUp .26s cubic-bezier(0,0,0,1)" }}>
      {/* viewfinder */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <PhotoPlaceholder tint={tint} radius={0} mono={false} style={{ position: "absolute", inset: 0, filter: phase === "live" ? "blur(2px)" : "none" }} />
        <div style={{ position: "absolute", inset: 0, background: phase === "live" ? "rgba(0,0,0,.12)" : "rgba(0,0,0,0)" }} />
        {phase === "live" && (
          <>
            {/* framing guides */}
            <div style={{ position: "absolute", inset: 28, border: "2px solid rgba(255,255,255,.5)", borderRadius: 18 }} />
            <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: 600, textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{hint}</div>
          </>
        )}
        {phase === "review" && (
          <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: 700, textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>¿Se ve bien?</div>
        )}
      </div>
      {/* controls */}
      <div style={{ flex: "none", background: "#000", padding: "22px 24px 30px" }}>
        {phase === "live" ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={onCancel} style={{ background: "none", border: "none", color: "#5AA2F5", fontFamily: T.brand, fontSize: 17, fontWeight: 600, cursor: "pointer", width: 80, textAlign: "left" }}>{C.capCancel}</button>
            <button onClick={() => setPhase("review")} style={{ width: 78, height: 78, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,.35)", cursor: "pointer", boxShadow: "0 0 0 2px #000 inset" }} />
            <div style={{ width: 80 }} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <SecondaryButton icon="refresh" onClick={() => setPhase("live")} style={{ flex: 1, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>{C.capRetake}</SecondaryButton>
            <PrimaryButton arrow={false} full onClick={() => onUse(tint)} style={{ flex: 2 }}><Icon name="check" size={20} stroke={2.2} color="#fff" />{C.capUse}</PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- OBJECT FORM ----------------
function ObjectForm({ initial, onSave, onCancel }) {
  const C = EN();
  const editing = !!(initial && initial.id);
  const [name, setName] = React.useState(initial?.name || "");
  const [desc, setDesc] = React.useState(initial?.desc || "");
  const [photos, setPhotos] = React.useState(() => {
    const n = initial?.photos || (initial && initial.tint != null ? 1 : 0);
    const base = initial ? (initial.tint ?? 0) : 0;
    return Array.from({ length: n }, (_, i) => (base + i) % 6);
  });
  const [focus, setFocus] = React.useState(null);
  const [capturing, setCapturing] = React.useState(false);
  const [tried, setTried] = React.useState(false);
  const canon = window.toCanonical(name);
  const MAX = 3;
  const full = photos.length >= MAX;
  const valid = name.trim() && photos.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.canvas, position: "relative" }}>
      <SetupHeader title={editing ? C.editObject : C.newObject} onBack={onCancel} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 20px" }}>
        <FormField label={C.fName} value={name} onChange={setName} placeholder="Termo de Papá" focusKey="n" focused={focus === "n"} onFocus={setFocus} hint={C.fNameHint} error={tried && !name.trim() ? C.requiredName : null} />
        <div style={{ height: 16 }} />
        <FormField label={C.fDesc} value={desc} onChange={setDesc} placeholder={C.fDescObjPh} focusKey="d" focused={focus === "d"} onFocus={setFocus} />

        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <FieldLabel>{C.fRefPhoto} <Req/></FieldLabel>
            <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 500, color: full ? T.success : T.medium }}>{photos.length}/{MAX}</span>
          </div>
          <div style={{ fontSize: 13, color: T.medium, marginBottom: 12 }}>{C.fRefPhotoSub}</div>

          {photos.length === 0 ? (
            <button onClick={() => setCapturing(true)} style={{ width: "100%", height: 168, borderRadius: 16, border: `2px dashed ${tried ? T.error : T.n300}`, background: T.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", color: T.primary }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.primary50, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="camera" size={28} color={T.primary} stroke={1.7} /></div>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{C.takePhoto}</span>
            </button>
          ) : (
            <>
              {/* main reference photo */}
              <div style={{ position: "relative", width: "100%", height: 196, borderRadius: 16, overflow: "hidden" }}>
                <PhotoPlaceholder tint={photos[0]} radius={16} mono={false} style={{ width: "100%", height: "100%" }} />
                <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(12,13,15,.8)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 7, letterSpacing: ".3px" }}>REFERENCE</div>
                <button onClick={() => setCapturing("replace0")} style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(12,13,15,.78)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontFamily: T.brand, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", backdropFilter: "blur(4px)" }}><Icon name="refresh" size={16} stroke={2} color="#fff" />{C.retake}</button>
              </div>

              {/* additional angles */}
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.high, marginTop: 18, marginBottom: 3 }}>{C.objMore}</div>
              <div style={{ fontSize: 12.5, color: T.medium, marginBottom: 12 }}>{C.objMoreSub}</div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "9px 9px 6px 9px", margin: "0 -9px" }}>
                {photos.slice(1).map((t, i) => (
                  <div key={i} style={{ position: "relative", flex: "none" }}>
                    <PhotoPlaceholder tint={t} radius={12} mono={false} style={{ width: 92, height: 92 }} />
                    <button onClick={() => setPhotos(photos.filter((_, j) => j !== i + 1))} style={{ position: "absolute", top: -7, right: -7, width: 26, height: 26, borderRadius: "50%", background: T.ink, border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="close" size={13} stroke={2.4} color="#fff" /></button>
                  </div>
                ))}
                {!full && (
                  <button onClick={() => setCapturing("add")} style={{ flex: "none", width: 92, height: 92, borderRadius: 12, border: `2px dashed ${T.n300}`, background: T.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", color: T.primary }}>
                    <Icon name="add" size={24} stroke={2} color={T.primary} />
                    <span style={{ fontSize: 11.5, fontWeight: 700 }}>Add</span>
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: T.low, marginTop: 8 }}>{C.objFirstIsRef}</div>
            </>
          )}
          {tried && photos.length === 0 && <ErrText>{C.requiredPhoto}</ErrText>}
        </div>
      </div>
      <FormFooter>
        <PrimaryButton arrow onClick={() => { if (!valid) { setTried(true); return; } onSave({ id: initial?.id, name: name.trim(), desc: desc.trim(), tint: photos[0], photos: photos.length, seen: initial?.seen ?? null }); }}>{C.saveObject}</PrimaryButton>
      </FormFooter>
      {capturing && <CaptureModal hint={C.capHintObj} tint={(photos[0] != null ? photos[0] + photos.length : Math.floor(Math.random() * 6)) % 6}
        onCancel={() => setCapturing(false)}
        onUse={(t) => { if (capturing === "replace0") setPhotos([t, ...photos.slice(1)]); else setPhotos([...photos, t]); setCapturing(false); }} />}
    </div>
  );
}

// ---------------- ROOM FORM ----------------
function RoomForm({ initial, onSave, onCancel }) {
  const C = EN();
  const editing = !!(initial && initial.id);
  const [name, setName] = React.useState(initial?.name || "");
  const [desc, setDesc] = React.useState(initial?.desc || "");
  const [photos, setPhotos] = React.useState(() => {
    const n = initial?.photos || 0; const base = initial ? (initial.tint ?? 0) : 0;
    return Array.from({ length: n }, (_, i) => (base + i) % 6);
  });
  const [focus, setFocus] = React.useState(null);
  const [capturing, setCapturing] = React.useState(false);
  const [tried, setTried] = React.useState(false);
  const canon = window.toCanonical(name);
  const full = photos.length >= 5;
  const valid = name.trim() && photos.length > 0;

  const progress = photos.length === 0 ? null : full ? C.photosFull : (photos.length < 3 ? C.photosProgressLow(photos.length) : C.photosProgressOk(photos.length));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.canvas, position: "relative" }}>
      <SetupHeader title={editing ? C.editRoom : C.newRoom} onBack={onCancel} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 20px" }}>
        <FormField label={C.fName} value={name} onChange={setName} placeholder="Cocina" focusKey="n" focused={focus === "n"} onFocus={setFocus} error={tried && !name.trim() ? C.requiredName : null} />
        <div style={{ height: 16 }} />
        <FormField label={C.fDesc} value={desc} onChange={setDesc} placeholder={C.fDescRoomPh} focusKey="d" focused={focus === "d"} onFocus={setFocus} />

        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <FieldLabel>{C.refPhotos} <Req/></FieldLabel>
            <PhotoCounter n={photos.length} />
          </div>
          <div style={{ fontSize: 13, color: T.medium, marginBottom: 14 }}>{C.refPhotosSub}</div>

          {/* horizontal strip */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "9px 9px 6px 9px", margin: "-9px -9px 0 -9px" }}>
            {photos.map((t, i) => (
              <div key={i} style={{ position: "relative", flex: "none" }}>
                <PhotoPlaceholder tint={t} radius={12} mono={false} style={{ width: 104, height: 128 }} />
                {i === 0 && <div style={{ position: "absolute", top: 7, left: 7, background: "rgba(12,13,15,.8)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6, letterSpacing: ".3px" }}>COVER</div>}
                <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: -7, right: -7, width: 26, height: 26, borderRadius: "50%", background: T.ink, border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="close" size={13} stroke={2.4} color="#fff" /></button>
              </div>
            ))}
            {!full && (
              <button onClick={() => setCapturing(true)} style={{ flex: "none", width: 104, height: 128, borderRadius: 12, border: `2px dashed ${tried && photos.length === 0 ? T.error : T.n300}`, background: T.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: T.primary }}>
                <Icon name="add" size={28} stroke={2} color={T.primary} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{C.takePhoto}</span>
              </button>
            )}
          </div>

          {/* progress encouragement */}
          {progress && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.sunken, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(photos.length / 5) * 100}%`, background: full ? T.success : T.primary, borderRadius: 3, transition: "width .3s cubic-bezier(0,0,0,1)" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: full ? T.success : T.medium, whiteSpace: "nowrap" }}>{full ? "Done" : `${photos.length}/5`}</span>
            </div>
          )}
          {progress && <div style={{ fontSize: 13, color: full ? T.success : T.medium, marginTop: 8 }}>{progress}</div>}
          {photos.length > 0 && <div style={{ fontSize: 12.5, color: T.low, marginTop: 6 }}>{C.firstIsThumb}</div>}
          {tried && photos.length === 0 && <ErrText>{C.requiredPhoto}</ErrText>}
        </div>
      </div>
      <FormFooter>
        <PrimaryButton arrow onClick={() => { if (!valid) { setTried(true); return; } onSave({ id: initial?.id, name: name.trim(), desc: desc.trim(), photos: photos.length, tint: photos[0] ?? 0 }); }}>{C.saveRoom}</PrimaryButton>
      </FormFooter>
      {capturing && <CaptureModal hint={C.capHintRoom} tint={(photos.length + (initial?.tint ?? 1)) % 6} onCancel={() => setCapturing(false)} onUse={(t) => { setPhotos([...photos, t]); setCapturing(false); }} />}
    </div>
  );
}

// ---------------- small form helpers ----------------
function FieldLabel({ children }) { return <div style={{ fontSize: 14, fontWeight: 700, color: T.high, marginBottom: 4 }}>{children}</div>; }
function Req() { return <span style={{ color: T.error, fontWeight: 700 }}>*</span>; }
function ErrText({ children }) { return <div style={{ color: T.error, fontSize: 13, fontWeight: 600, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name="alert" size={14} stroke={2} /> {children}</div>; }
function FormField({ label, value, onChange, placeholder, focusKey, focused, onFocus, hint, error }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Field label={label} value={value} onChange={onChange} placeholder={placeholder} focusKey={focusKey} focused={focused} onFocus={onFocus} error={!!error} />
      {hint && !error && <div style={{ fontSize: 12.5, color: T.low, marginTop: 6, paddingLeft: 2 }}>{hint}</div>}
      {error && <ErrText>{error}</ErrText>}
    </div>
  );
}
function FormFooter({ children }) {
  return <div style={{ flex: "none", padding: "14px 18px", borderTop: `1px solid ${T.border}`, background: "rgba(246,247,249,.9)", backdropFilter: "blur(8px)" }}>{children}</div>;
}
function PhotoCounter({ n }) {
  return <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 500, color: n >= 5 ? T.success : T.medium }}>{n}/5</span>;
}

Object.assign(window, { Setup, EmptyState, CaptureModal, ObjectForm, RoomForm });
