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
    listening: 'Te escucho…',
    thinking: 'Un momento…',
    errCamera: 'No veo nada',
    errCameraSub: 'Probá de nuevo desde el menú.',
    errPerm: 'Necesito la cámara',
    errPermSub: 'Tocá para darme permiso.',
    errPermBtn: 'Abrir ajustes',
  },
  // "Guíame a X" guidance flow (FR voseo). `obj` is the noun the user said.
  guide: {
    searching: (obj: string): string => `Buscando ${obj}. Movéme despacio por el lugar.`,
    cannotGuide: (obj: string): string => `Por ahora no puedo guiarte hasta ${obj}.`,
    found: '¡Ahí está! Lo tenés enfrente.',
    notFound: (obj: string): string => `No encuentro ${obj} por acá. ¿Probamos de nuevo?`,
  },
  // Splash caregiver legend pointing to the OS app-icon setup shortcut.
  splash: {
    // On-screen greeting under the wordmark (distinct from the spoken `greeting`).
    hello: 'Hola, soy Lola',
    settings: 'Configuración',
    settingsHint: 'Accedé manteniendo presionado el ícono de la app en tu teléfono',
    // Subtitle shown on the OS app-icon shortcut row (Android dynamic action;
    // the iOS static action mirrors this in app.json).
    shortcutSub: 'Para el cuidador',
  },
} as const;

export type Copy = typeof COPY;
