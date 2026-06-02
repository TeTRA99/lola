// Caregiver Setup UI strings (ES/EN). The dad-facing surface stays Spanish
// always (see services/CopyModule) — this dictionary only covers the caregiver
// tool, which follows the device language with a manual override in Settings.
//
// Spanish here uses Argentine voseo (Agregá, Sacá, Ponele) to match Lola's
// dad-facing voice. This file is exempt from the inline-Spanish lint rule
// (see eslint.config.mjs ignores).

export type Lang = 'es' | 'en';

type SetupCopy = {
  setup: string;
  done: string;
  // One-time caregiver intro card (first Setup open).
  introTitle: string;
  introBody: string;
  introDismiss: string;
  objects: string;
  rooms: string;
  settings: string;
  addObject: string;
  addRoom: string;
  emptyObjTitle: string;
  emptyObjBody: string;
  emptyObjCta: string;
  emptyRoomTitle: string;
  emptyRoomBody: string;
  emptyRoomCta: string;
  newObject: string;
  editObject: string;
  newRoom: string;
  editRoom: string;
  fName: string;
  fDesc: string;
  fRefPhoto: string;
  fRefPhotoSub: string;
  takePhoto: string;
  retake: string;
  objMore: string;
  objMoreSub: string;
  objFirstIsRef: string;
  saveObject: string;
  saveRoom: string;
  refPhotos: string;
  refPhotosSub: string;
  firstIsThumb: string;
  neverSeen: string;
  requiredName: string;
  requiredPhoto: string;
  deleted: string;
  saveFailed: string;
  reference: string;
  cover: string;
  add: string;
  quietCapture: string;
  quietCaptureHint: string;
  heartbeat: string;
  heartbeatHint: string;
  yourName: string;
  yourNameHint: string;
  yourNamePh: string;
  language: string;
  langSpanish: string;
  langEnglish: string;
  voice: string;
  voiceHint: string;
  voiceDefault: string;
  noVoices: string;
  voiceTuning: string;
  voiceTuningHint: string;
  speed: string;
  pitch: string;
  detectionQuality: string;
  detectionQualityHint: string;
  detectionLevels: readonly [string, string, string, string, string];
  aiMode: string;
  aiModeHint: string;
  aiModeCloud: string;
  aiModeLocal: string;
  aiModeCloudHint: string;
  aiModeLocalHint: string;
  // photo placeholders shown in the Spanish name fields
  phObjName: string;
  phObjDesc: string;
  phRoomName: string;
  phRoomDesc: string;
  // capture modal
  capCancel: string;
  capUse: string;
  capRetake: string;
  capLooksGood: string;
  capHintObj: string;
  capHintRoom: string;
  capPermTitle: string;
  capPermBody: string;
  capClose: string;
  // fns
  savedQuote: (n: string) => string;
  lastSeen: (room: string) => string;
  photosLow: (n: number) => string;
  photosOk: (n: number) => string;
  photosFull: string;
  modelDownloading: (pct: number) => string;
  deleteConfirmTitle: string;
  deleteConfirmBody: (n: string) => string;
  cancel: string;
  delete: string;
};

const en: SetupCopy = {
  setup: 'Setup',
  done: 'Done',
  introTitle: 'Welcome to Lola',
  introBody: 'This is where you set Lola up — for you, your things, your home. Add the objects that matter most in your daily life, so Lola recognizes them and helps find them. Add the rooms in your home so Lola knows where you are.',
  introDismiss: 'Got it',
  objects: 'Objects',
  rooms: 'Rooms',
  settings: 'Settings',
  addObject: 'Add object',
  addRoom: 'Add room',
  emptyObjTitle: 'No objects yet',
  emptyObjBody: 'Tag the things Dad asks about — his thermos, his pills, the remote. Each one becomes an answer to “where is…?”',
  emptyObjCta: 'Add your first object',
  emptyRoomTitle: 'No rooms yet',
  emptyRoomBody: 'Map the rooms Dad moves through, so Lola can tell him where he is. A few photos per room is all it takes.',
  emptyRoomCta: 'Add your first room',
  newObject: 'New object',
  editObject: 'Edit object',
  newRoom: 'New room',
  editRoom: 'Edit room',
  fName: 'Name',
  fDesc: 'Description (optional)',
  fRefPhoto: 'Reference photo',
  fRefPhotoSub: 'One clear photo of the object.',
  takePhoto: 'Take photo',
  retake: 'Retake',
  objMore: 'More angles (optional)',
  objMoreSub: 'Up to 3 photos help Lola recognise it from any side.',
  objFirstIsRef: 'First photo is the main reference.',
  saveObject: 'Save object',
  saveRoom: 'Save room',
  refPhotos: 'Reference photos',
  refPhotosSub: 'Take 3–5 photos from different angles so Lola can recognise the room.',
  firstIsThumb: 'First photo is used as the cover.',
  neverSeen: 'Not seen yet',
  requiredName: 'Give it a name so Lola can say it.',
  requiredPhoto: 'Add at least one photo.',
  deleted: 'Deleted',
  saveFailed: "Couldn't save",
  reference: 'REFERENCE',
  cover: 'COVER',
  add: 'Add',
  quietCapture: 'Quiet capture',
  quietCaptureHint: 'Mute the shutter sound when Lola takes a picture.',
  heartbeat: 'Idle heartbeat',
  heartbeatHint: 'A gentle pulse every few seconds on the home screen so Dad can feel the app is on and ready.',
  yourName: 'Your name',
  yourNameHint: 'How Lola greets you when the app opens.',
  yourNamePh: 'e.g. Carlos',
  language: 'Language',
  langSpanish: 'Español',
  langEnglish: 'English',
  voice: 'Voice',
  voiceHint: 'Tap a voice to hear it. Lola will use the selected one.',
  voiceDefault: 'System default',
  noVoices: 'No Spanish voices are installed on this phone.',
  voiceTuning: 'Voice tuning',
  voiceTuningHint: 'Adjust speed and pitch. Release a slider to hear it.',
  speed: 'Speed',
  pitch: 'Pitch',
  detectionQuality: 'Object detection',
  detectionQualityHint: 'How hard Lola looks when guiding to an object. Higher finds more (like small items), but uses more battery and can react slower. Changing it downloads a new detector when you go back to Home (just once per level).',
  detectionLevels: ['Minimum', 'Low', 'Medium', 'High', 'Maximum'] as const,
  aiMode: 'How Lola sees',
  aiModeHint: 'Where Lola processes photos when describing or answering.',
  aiModeCloud: 'Online',
  aiModeLocal: 'On the phone',
  aiModeCloudHint: 'Recommended. Photos are sent to the cloud, so Lola sees more and can name specific things (like a mate). Needs an internet connection.',
  aiModeLocalHint: 'Private and works offline — photos never leave the phone. But Lola recognizes far fewer things and won’t name specific objects (a mate becomes “a cup”). The first time, it downloads a model to the phone.',
  phObjName: 'e.g. Dad’s thermos',
  phObjDesc: 'e.g. the blue one with a red lid',
  phRoomName: 'e.g. Kitchen',
  phRoomDesc: 'e.g. where he has his morning coffee',
  capCancel: 'Cancel',
  capUse: 'Use photo',
  capRetake: 'Retake',
  capLooksGood: 'Looks good?',
  capHintObj: 'Fill the frame with the object',
  capHintRoom: 'Step back — capture the whole room',
  capPermTitle: 'Camera permission needed',
  capPermBody: 'Enable camera access in Settings → Apps → Lola → Permissions, then come back.',
  capClose: 'Close',
  savedQuote: (n) => `“${n}” saved`,
  lastSeen: (room) => `Last seen in the ${room}`,
  photosLow: (n) => `${n} of 5 — add a couple more angles.`,
  photosOk: (n) => `${n} of 5 — looking good.`,
  photosFull: "All 5 captured — that's plenty.",
  modelDownloading: (pct) => `First time only: downloading the recognition model… ${pct}%`,
  deleteConfirmTitle: 'Delete?',
  deleteConfirmBody: (n) => `Delete “${n}”?`,
  cancel: 'Cancel',
  delete: 'Delete',
};

const es: SetupCopy = {
  setup: 'Configuración',
  done: 'Listo',
  introTitle: 'Bienvenido a Lola',
  introBody: 'Acá configurás a Lola para vos, tus cosas, tu casa. Registrá los objetos que más te importan en tu día a día, así Lola los reconoce y ayuda a encontrarlos. Registrá los cuartos de tu casa para que Lola reconozca dónde estás.',
  introDismiss: 'Entendido',
  objects: 'Objetos',
  rooms: 'Cuartos',
  settings: 'Ajustes',
  addObject: 'Agregar objeto',
  addRoom: 'Agregar cuarto',
  emptyObjTitle: 'Todavía no hay objetos',
  emptyObjBody: 'Etiquetá las cosas que papá busca — su termo, sus pastillas, el control. Cada una es una respuesta a “¿dónde está…?”',
  emptyObjCta: 'Agregá tu primer objeto',
  emptyRoomTitle: 'Todavía no hay cuartos',
  emptyRoomBody: 'Marcá los cuartos por donde se mueve papá, así Lola puede decirle dónde está. Con unas pocas fotos por cuarto alcanza.',
  emptyRoomCta: 'Agregá tu primer cuarto',
  newObject: 'Nuevo objeto',
  editObject: 'Editar objeto',
  newRoom: 'Nuevo cuarto',
  editRoom: 'Editar cuarto',
  fName: 'Nombre',
  fDesc: 'Descripción (opcional)',
  fRefPhoto: 'Foto de referencia',
  fRefPhotoSub: 'Una foto clara del objeto.',
  takePhoto: 'Sacar foto',
  retake: 'Repetir',
  objMore: 'Más ángulos (opcional)',
  objMoreSub: 'Hasta 3 fotos ayudan a que Lola lo reconozca desde cualquier lado.',
  objFirstIsRef: 'La primera foto es la referencia principal.',
  saveObject: 'Guardar objeto',
  saveRoom: 'Guardar cuarto',
  refPhotos: 'Fotos de referencia',
  refPhotosSub: 'Sacá de 3 a 5 fotos desde distintos ángulos para que Lola reconozca el cuarto.',
  firstIsThumb: 'La primera foto se usa como portada.',
  neverSeen: 'Sin ver todavía',
  requiredName: 'Ponele un nombre para que Lola pueda decirlo.',
  requiredPhoto: 'Agregá al menos una foto.',
  deleted: 'Eliminado',
  saveFailed: 'No se pudo guardar',
  reference: 'REFERENCIA',
  cover: 'PORTADA',
  add: 'Agregar',
  quietCapture: 'Captura silenciosa',
  quietCaptureHint: 'Silenciar el sonido del obturador cuando Lola saca una foto.',
  heartbeat: 'Latido en reposo',
  heartbeatHint: 'Un pulso suave cada pocos segundos en la pantalla principal para que papá sienta que la app está encendida y lista.',
  yourName: 'Tu nombre',
  yourNameHint: 'Cómo te saluda Lola al abrir la app.',
  yourNamePh: 'ej. Carlos',
  language: 'Idioma',
  langSpanish: 'Español',
  langEnglish: 'English',
  voice: 'Voz',
  voiceHint: 'Tocá una voz para escucharla. Lola va a usar la elegida.',
  voiceDefault: 'Voz del sistema',
  noVoices: 'No hay voces en español instaladas en este teléfono.',
  voiceTuning: 'Ajuste de voz',
  voiceTuningHint: 'Ajustá la velocidad y el tono. Soltá el control para escuchar.',
  speed: 'Velocidad',
  pitch: 'Tono',
  detectionQuality: 'Detección de objetos',
  detectionQualityHint: 'Cuánto se esfuerza Lola al guiarte hacia un objeto. Más alto encuentra más cosas (incluso chicas), pero usa más batería y puede reaccionar más lento. Al cambiarlo, se descarga un detector nuevo al volver al inicio (una sola vez por nivel).',
  detectionLevels: ['Mínimo', 'Bajo', 'Medio', 'Alto', 'Máximo'] as const,
  aiMode: 'Cómo ve Lola',
  aiModeHint: 'Dónde procesa Lola las fotos al describir o responder.',
  aiModeCloud: 'En línea',
  aiModeLocal: 'En el teléfono',
  aiModeCloudHint: 'Recomendado. Las fotos se envían a la nube, así Lola ve más y puede nombrar cosas específicas (como un mate). Necesita conexión a internet.',
  aiModeLocalHint: 'Privado y funciona sin internet: las fotos nunca salen del teléfono. Pero Lola reconoce muchas menos cosas y no nombra objetos específicos (un mate pasa a ser “una taza”). La primera vez descarga un modelo al teléfono.',
  phObjName: 'ej. Termo de Papá',
  phObjDesc: 'ej. el azul de tapa roja',
  phRoomName: 'ej. Cocina',
  phRoomDesc: 'ej. donde toma el café por la mañana',
  capCancel: 'Cancelar',
  capUse: 'Usar foto',
  capRetake: 'Repetir',
  capLooksGood: '¿Se ve bien?',
  capHintObj: 'Llená el cuadro con el objeto',
  capHintRoom: 'Alejate — capturá todo el cuarto',
  capPermTitle: 'Hace falta permiso de cámara',
  capPermBody: 'Activá el acceso a la cámara en Ajustes → Apps → Lola → Permisos, y volvé.',
  capClose: 'Cerrar',
  savedQuote: (n) => `“${n}” guardado`,
  lastSeen: (room) => `Visto por última vez en ${room}`,
  photosLow: (n) => `${n} de 5 — agregá un par de ángulos más.`,
  photosOk: (n) => `${n} de 5 — va bien.`,
  photosFull: 'Las 5 listas — con eso alcanza.',
  modelDownloading: (pct) => `Solo la primera vez: descargando el modelo de reconocimiento… ${pct}%`,
  deleteConfirmTitle: '¿Eliminar?',
  deleteConfirmBody: (n) => `¿Eliminar “${n}”?`,
  cancel: 'Cancelar',
  delete: 'Eliminar',
};

export const SETUP_STRINGS: Record<Lang, SetupCopy> = { es, en };
export type { SetupCopy };
