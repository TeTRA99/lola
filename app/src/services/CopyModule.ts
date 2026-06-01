// Single source of truth for every dad-facing Spanish string.
// FR-6.1 (name), FR-6.4 (errors as gentle questions), FR-6.5 (voseo).
// NO Spanish string literal lives outside this file — enforced by lint (E1.2).

export const COPY = {
  // Spoken on launch (TTS). The on-screen wordmark greeting is `splash.hello`.
  greeting: 'Hola, ¿en qué puedo ayudarte?',
  // Personalized launch greeting — uses the caregiver-set name when present
  // ("Hola, Carlos, ¿en qué puedo ayudarte?"), else falls back to `greeting`.
  greetingFor: (name?: string): string =>
    name && name.trim()
      ? `Hola, ${name.trim()}, ¿en qué puedo ayudarte?`
      : 'Hola, ¿en qué puedo ayudarte?',
  repeatTrigger: 'Lola, ¿otra vez?',
  extendTrigger: 'Lola, contame más',
  errors: {
    lowConfidence: 'No estoy segura — ¿podés acercarte un poquito?',
    noNetwork: 'No tengo señal ahora — ¿probamos en un ratito?',
    cameraPermission: 'Necesito ver para ayudarte — ¿me dejás usar la cámara?',
    micPermission: '¿Me dejás escucharte?',
    generic: 'Algo se me cruzó — ¿lo intentamos de nuevo?',
  },
  buttons: {
    describeLabel: 'Describir',
    askLabel: 'Preguntar',
  },
  // Dad-facing Home surface (handoff data.jsx → COPY.es). These are the on-
  // screen labels for each in-panel state and the calm error headings; the
  // spoken lines are produced separately by errorCopy / the services.
  home: {
    // Top-bar prompt above the two action cards (handoff_home).
    homePrompt: '¿Qué querés hacer?',
    // Shown when the settings gear is tapped instead of long-pressed — the gear
    // is long-press-gated so the end user can't trip into the caregiver Setup.
    settingsHint: 'Mantené presionado para ajustes',
    listening: 'Te escucho…',
    thinking: 'Un momento…',
    errCamera: 'No veo nada',
    errCameraSub: 'Probá de nuevo desde el menú.',
    errPerm: 'Necesito la cámara',
    errPermSub: 'Tocá para darme permiso.',
    errPermBtn: 'Abrir ajustes',
  },
  // First-run onboarding (voseo). The welcome plays once after the splash; the
  // hints play once each, the first time a feature is used. The splash already
  // said "Hola, soy Lola", so the welcome continues rather than re-greeting.
  onboarding: {
    // Spoken once on first launch. Core (Describir/Preguntar) + a gentle nudge
    // to set up objects/rooms with a trusted person, ending with the tap cue.
    welcome:
      'Te voy a ayudar a saber qué tenés alrededor. ' +
      'Tocá la parte de arriba de la pantalla y te describo lo que tenés enfrente. ' +
      'Tocá la parte de abajo y preguntame lo que quieras saber. ' +
      'Si alguien de confianza te ayuda una vez a guardar tus objetos y tus lugares, te voy a poder ayudar todavía más. Igual, podés empezar a usarme ahora mismo. ' +
      'Cuando quieras, tocá la pantalla para empezar.',
    // On-screen version of the welcome (big, for low-vision who can still read).
    welcomeTitle: 'Estoy para ayudarte',
    welcomeBody: 'Arriba, te describo lo que tenés enfrente.\nAbajo, preguntame lo que quieras.',
    welcomeTapHint: 'Tocá la pantalla para empezar',
    // First-use hints (spoken once, just before that feature runs). Each opens
    // by naming what the user just did, then how to use it.
    describeHint: 'Tocaste Describir. Apuntá el teléfono hacia adelante y ya te cuento qué veo.',
    askHint: 'Tocaste Preguntar. Cuando escuches el tono, preguntame en voz alta lo que quieras saber.',
    // Spoken once, the first time the "guíame a algo" homing flow opens.
    guideHint: 'Te voy a guiar con vibraciones: cuanto más rápido vibra, más cerca estás.',
    // Spoken once, the first time the idle heartbeat is felt.
    heartbeatHint: 'Ese latido suave soy yo, que estoy acá con vos.',
  },
  // "Guíame a X" guidance flow (FR voseo). `obj` is the noun the user said.
  guide: {
    searching: (obj: string): string => `Buscando ${obj}. Movéme despacio por el lugar.`,
    spotted: 'Creo que lo veo. Movéme despacio.',
    // Truly unsupported object: be warm and point to Describir instead. No noun
    // here — the IntentRouter gives a bare, article-less noun ("termo"), which
    // reads wrong inserted into a sentence, and naming it doesn't matter when we
    // can't guide anyway.
    cannotGuide: 'Disculpá, la funcionalidad de encontrar objetos está limitada a algunos tipos de objetos en esta versión. Probá usando «Describir» y te cuento qué tenés enfrente.',
    // Approximate match (e.g. "termo" → botella): warn before guiding anyway.
    approxWarning: 'Ese tipo de objeto todavía no lo reconozco del todo, pero voy a hacer lo posible para guiarte.',
    found: '¡Ahí está! Lo tenés enfrente. Tocá la pantalla cuando termines.',
    notFound: (obj: string): string => `No encuentro ${obj} por acá. Tocá la pantalla para volver.`,
    // Spoken once if the on-device model is still downloading on first use.
    preparing: 'Esperá un momento, me estoy preparando. La primera vez puede tardar un poco.',
    // On-screen legend (low-vision may see it; matches the app's other screens).
    looking: (obj: string): string => `Buscando ${obj}`,
    seeingIt: '¡La veo!',
    here: '¡Ahí está!',
    preparingLegend: 'Preparando…',
    tapHint: 'Tocá la pantalla para volver',
    // Shown if the guide screen fails to load (e.g. its native module).
    loadError: 'No pude abrir esto. Tocá para volver.',
  },
  splash: {
    // On-screen greeting under the wordmark (distinct from the spoken `greeting`).
    hello: 'Hola, soy Lola',
    // Label reused by the OS app-icon shortcut and the Home settings gear.
    settings: 'Configuración',
    // Subtitle shown on the OS app-icon shortcut row (Android dynamic action;
    // the iOS static action mirrors this in app.json).
    shortcutSub: 'Para el cuidador',
  },
} as const;

export type Copy = typeof COPY;
