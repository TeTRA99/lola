// Single source of truth for every dad-facing Spanish string.
// FR-6.1 (name), FR-6.4 (errors as gentle questions), FR-6.5 (voseo).
// NO Spanish string literal lives outside this file — enforced by lint (E1.2).

export const COPY = {
  // Spoken on launch (TTS). The on-screen wordmark greeting is `splash.hello`.
  greeting: 'Hola, ¿en qué puedo ayudarte?',
  // Personalized launch greeting — uses the caregiver-set name when present
  // ("Hola Carlos, ¿en qué puedo ayudarte?"), else falls back to `greeting`.
  // No vocative comma after "Hola": TTS reads it as an unnatural pause
  // ("Hola… Carlos"), so it's "Hola <name>" to flow as one breath.
  greetingFor: (name?: string): string =>
    name && name.trim()
      ? `Hola ${name.trim()}, ¿en qué puedo ayudarte?`
      : 'Hola, ¿en qué puedo ayudarte?',
  repeatTrigger: 'Lola, ¿otra vez?',
  extendTrigger: 'Lola, contame más',
  errors: {
    lowConfidence: 'No estoy segura — ¿podés acercarte un poquito?',
    noNetwork: 'No tengo señal ahora — ¿probamos en un ratito?',
    cameraPermission: 'Necesito ver para ayudarte — ¿me dejás usar la cámara?',
    micPermission: '¿Me dejás escucharte?',
    generic: 'Algo se me cruzó — ¿lo intentamos de nuevo?',
    // Spoken generic-error variants — errorCopyFor picks one at random so the
    // retry prompt doesn't feel repetitive when errors cluster.
    genericVariants: [
      'Algo se me cruzó — ¿lo intentamos de nuevo?',
      'Uy, se me trabó algo — ¿probamos otra vez?',
      'Se me complicó por un momento — ¿lo volvemos a intentar?',
    ],
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
    // Small grey label next to the gear icon, so the affordance is legible.
    settingsLabel: 'Ajustes',
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
    // Spoken once, the first time the volume-button trigger fires (after the
    // caregiver turns it on). Explains the two double-press gestures.
    volumeTriggerHint:
      'Activaste el control por volumen. Desde esta pantalla, apretá dos veces el botón de subir volumen para que describa, o dos veces el de bajar volumen para preguntarme.',
  },
  // "Guíame a X" guidance flow (FR voseo). `obj` is the noun the user said.
  guide: {
    searching: (obj: string): string => `Buscando ${obj}. Movéme despacio por el lugar.`,
    // Cloud (online) opening instructions — a DIFFERENT interaction than the
    // continuous Geiger: point at one area, wait for the buzz (one answer per
    // area), then move to another area. Spoken on open in cloud mode.
    searchingCloud: (obj: string): string =>
      `Buscando ${obj}. Apuntá la cámara a una zona y mantené quieto un momento. Cada vibración es una respuesta de esa zona y te digo dónde lo veo. Movéme despacio a otra zona para seguir buscando.`,
    spotted: 'Creo que lo veo. Movéme despacio.',
    // Confidence-tiered on-device guide: tentative spot → ask to stop & focus; if it
    // doesn't firm up within a few seconds, retract it so a phantom isn't trusted.
    checking: 'Creo que lo veo. Parate y enfocá ahí.',
    notThere: 'No, parece que no está. Seguí buscando.',
    // Truly unsupported object: be warm and point to Describir instead. No noun
    // here — the IntentRouter gives a bare, article-less noun ("termo"), which
    // reads wrong inserted into a sentence, and naming it doesn't matter when we
    // can't guide anyway.
    cannotGuide: 'Disculpá, la funcionalidad de encontrar objetos está limitada a algunos tipos de objetos en esta versión. Probá usando «Describir» y te cuento qué tenés enfrente.',
    // Device can't run the on-device detector at all (ARMv8.0 CPU — see
    // adapters/cpuFeatures.ts). Same warm redirect to Describir as cannotGuide.
    unsupportedDevice: 'Disculpá, en este teléfono todavía no puedo guiarte hasta objetos. Probá usando «Describir» y te cuento qué tenés enfrente.',
    // Approximate match (e.g. "termo" → botella): warn before guiding anyway.
    approxWarning: 'Ese tipo de objeto todavía no lo reconozco del todo, pero voy a hacer lo posible para guiarte.',
    found: '¡Ahí está! Lo tenés enfrente. Tocá la pantalla cuando termines.',
    // Cloud-only short spoken hint per positive poll: which way to point (from the
    // box's frame position) + an optional landmark the model reported ("al lado del
    // termo"). Kept short — it's spoken every ~3s. `near` is model-generated Spanish.
    locate: (p: { dx: 'left' | 'right' | null; dy: 'up' | 'down' | null; near: string | null }): string => {
      const parts: string[] = [];
      if (p.dy === 'up') parts.push('arriba');
      if (p.dy === 'down') parts.push('abajo');
      if (p.dx === 'left') parts.push('a la izquierda');
      if (p.dx === 'right') parts.push('a la derecha');
      const dir = parts.join(' ');
      let s = dir
        ? `¡Ahí está! ${dir.charAt(0).toUpperCase()}${dir.slice(1)}`
        : '¡Ahí está! Lo tenés enfrente';
      if (p.near) s += `, ${p.near}`;
      return `${s}.`;
    },
    notFound: (obj: string): string => `No encuentro ${obj} por acá. Tocá la pantalla para volver.`,
    // Spoken on a long idle so the search never closes silently on a blind user.
    // After "found": a gentle reminder how to leave; while still searching: a
    // reassurance + the same exit hint. Tap is the only way out.
    checkin: 'Seguí buscando si querés. Tocá la pantalla para salir.',
    checkinFound: 'Cuando lo tengas, tocá la pantalla para salir.',
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
  // On-device model download/preparation (feat/on-device-models). The banner is
  // caregiver-facing on Home; the spoken line plays if a feature is triggered
  // before the model finished downloading.
  models: {
    // Home progress card while the on-device model downloads (first run).
    bannerTitle: 'Preparando a Lola',
    bannerSubtitle: 'Descargando lo necesario para que Lola funcione sin internet. Esto pasa una sola vez.',
    bannerProgress: (pct: number): string => `Descargando… ${pct}%`,
    // Download done, loading the model into memory (warm-up).
    bannerPreparing: 'Casi lista, preparando el modelo…',
    // VLM ready, the small voice-command model is still loading.
    bannerVoice: 'Preparando el asistente de voz…',
    bannerReady: '¡Lola ya está lista!',
    bannerError: 'No pude preparar el modelo. Probá reiniciar la app.',
    // Detection-model prep card on Home (shown after the caregiver changes the
    // "Detección de objetos" level to one whose model isn't on the device yet).
    detectorTitle: 'Preparando la guía',
    detectorSubtitle: 'Descargando el detector de objetos para el nivel elegido. Pasa una sola vez por nivel.',
    detectorReady: 'Guía lista.',
    // Spoken once if Describir/Preguntar is tapped before the model is ready.
    preparing: 'Esperá un momentito, todavía me estoy preparando. La primera vez puede tardar un poco.',
  },
  // Local SOS / "call family". Dad says "llamá a X" / "necesito ayuda" → a phone
  // call; "mandale un WhatsApp a X" → a pre-filled chat. No backend.
  sos: {
    calling: (name: string): string => `Llamando a ${name}.`,
    messaging: (name: string): string => `Le escribo a ${name}.`,
    // Pre-filled WhatsApp body when the user didn't dictate a message.
    whatsappText: 'Hola, te escribo con Lola.',
    // Appended to a DICTATED message so family knows it came via the assistive app
    // ("Estoy bien — enviado con Lola.").
    whatsappSignature: ' — enviado con Lola.',
    // WhatsApp not installed / link failed.
    openFailed: 'No pude abrir WhatsApp. Probá llamando.',
    // The phone dialer failed to open — never leave the user in silence.
    callFailed: 'No pude abrir el teléfono. Probá llamar de la forma habitual.',
    // No contacts saved yet — point to the caregiver setup, gently.
    notConfigured: 'Todavía no tengo a quién llamar. Pedile a alguien de confianza que cargue un contacto en la configuración.',
    // A name was said but it's not in the saved contacts.
    notFound: 'No encontré a esa persona en tus contactos. Pedile a alguien que la agregue en la configuración.',
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
