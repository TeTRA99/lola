// data.jsx — sample content + final copy strings (ES dad-facing, EN caregiver)
// Exported to window at end.

const COPY = {
  // ---- Dad-facing (Spanish) ----
  es: {
    greeting: "Hola, soy Lola",
    describe: "Describir",
    ask: "Preguntar",
    homePrompt: "¿Qué querés hacer?",
    homePromptSub: "Tocá una opción",
    listening: "Te escucho…",
    thinking: "Un momento…",
    speakingHint: "Toca para detener",
    stopped: "Listo",
    errCamera: "No veo nada",
    errCameraSub: "Probá de nuevo desde el menú.",
    errCameraBtn: "Reintentar",
    errPerm: "Necesito la cámara",
    errPermSub: "Tocá para darme permiso.",
    errPermBtn: "Abrir ajustes",
    // sample spoken responses
    describeResult: "Estás mirando la mesa de la cocina. Hay una taza azul, una banana y tus lentes de leer.",
    askResult: "La última vez vi tu termo sobre la mesa de la cocina.",
  },
  // ---- Caregiver-facing (English) ----
  en: {
    setup: "Setup",
    done: "Done",
    objects: "Objects",
    rooms: "Rooms",
    addObject: "Add object",
    addRoom: "Add room",
    edit: "Edit",
    // empty states
    emptyObjTitle: "No objects yet",
    emptyObjBody: "Tag the things Dad asks about — his thermos, his pills, the remote. Each one becomes an answer to “where is…?”",
    emptyObjCta: "Add your first object",
    emptyRoomTitle: "No rooms yet",
    emptyRoomBody: "Map the rooms Dad moves through, so Lola can tell him where he is. A few photos per room is all it takes.",
    emptyRoomCta: "Add your first room",
    // object form
    newObject: "New object",
    editObject: "Edit object",
    fName: "Display name (Spanish)",
    fNameHint: "What Lola says out loud.",
    fCanonical: "Internal name",
    fDesc: "Description (optional)",
    fDescObjPh: "el azul de tapa roja",
    fDescRoomPh: "donde toma el café por la mañana",
    fRefPhoto: "Reference photo",
    fRefPhotoSub: "One clear photo of the object.",
    takePhoto: "Take photo",
    retake: "Retake",
    objMore: "More angles (optional)",
    objMoreSub: "Up to 3 photos help Lola recognise it from any side.",
    objFirstIsRef: "First photo is the main reference.",
    saveObject: "Save object",
    saveRoom: "Save room",
    // room form
    newRoom: "New room",
    editRoom: "Edit room",
    refPhotos: "Reference photos",
    refPhotosSub: "Take 3–5 photos from different angles so Lola can recognise the room.",
    photosProgressLow: (n) => `${n} of 5 — add a couple more angles.`,
    photosProgressOk: (n) => `${n} of 5 — looking good.`,
    photosFull: "All 5 captured — that's plenty.",
    firstIsThumb: "First photo is used as the cover.",
    // capture modal
    capCancel: "Cancel",
    capUse: "Use photo",
    capRetake: "Retake",
    capHintObj: "Fill the frame with the object",
    capHintRoom: "Step back — capture the whole room",
    // toasts
    savedObject: (n) => `“${n}” saved`,
    savedRoom: (n) => `“${n}” saved`,
    deleted: "Deleted",
    saveFailedTitle: "Couldn't save",
    saveFailedBody: "Check your connection and try again.",
    // misc
    lastSeen: (r) => `Last seen in the ${r}`,
    neverSeen: "Not seen yet",
    requiredName: "Give it a name so Lola can say it.",
    requiredPhoto: "Add at least one photo.",
  },
};

// canonical name generator (mirrors RN helper)
function toCanonical(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// soft photo placeholder palettes (stand-ins for real reference photos)
const PHOTO_TINTS = [
  ["#cbd6e6", "#9fb4cf"], ["#d9d2c4", "#b8ac95"], ["#cdd8d2", "#a3b5ac"],
  ["#e0cfc6", "#c2a890"], ["#d2cede", "#aaa2c4"], ["#c9d9da", "#9cbfc0"],
];
Object.assign(window, { PHOTO_TINTS });

const OBJECTS = [
  { id: "o1", name: "Termo de Papá", desc: "el azul de tapa roja", seen: "Cocina", tint: 0, photos: 3 },
  { id: "o2", name: "Sus lentes", desc: "de leer, marco negro", seen: "Living", tint: 2, photos: 1 },
  { id: "o3", name: "El control remoto", desc: "del televisor", seen: "Living", tint: 1, photos: 2 },
  { id: "o4", name: "Sus pastillas", desc: "caja blanca de la mañana", seen: null, tint: 4, photos: 1 },
];

const OBJECT_LONG = { id: "oL", name: "Termo de Papá Que Es Muy Grande de Color Azul", desc: "el que dejó en la oficina la semana pasada", seen: "Escritorio", tint: 0, photos: 2 };

const ROOMS = [
  { id: "r1", name: "Cocina", desc: "donde toma el café por la mañana", photos: 4, tint: 1 },
  { id: "r2", name: "Living", desc: "el sillón y la tele", photos: 3, tint: 2 },
  { id: "r3", name: "Dormitorio", desc: "su cama y la mesa de luz", photos: 5, tint: 4 },
  { id: "r4", name: "Baño", desc: "", photos: 2, tint: 5 },
];

// 20-item list for the dense edge case
function makeManyObjects() {
  const base = ["Llaves", "Bastón", "Audífonos", "Billetera", "Reloj", "Pañuelo", "Vaso", "Plato", "Cuchara", "Radio", "Diario", "Gorra", "Abrigo", "Zapatos", "Paraguas", "Cargador"];
  const list = [...OBJECTS];
  base.forEach((n, i) => list.push({ id: "m" + i, name: n, desc: "", seen: i % 3 === 0 ? "Cocina" : (i % 3 === 1 ? "Living" : null), tint: i % 6 }));
  return list;
}

Object.assign(window, { COPY, toCanonical, OBJECTS, OBJECT_LONG, ROOMS, OBJECT_LONG, makeManyObjects });
