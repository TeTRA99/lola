// Single source of truth for every dad-facing Spanish string.
// FR-6.1 (name), FR-6.4 (errors as gentle questions), FR-6.5 (voseo).
// NO Spanish string literal lives outside this file — enforced by lint (E1.2).

export const COPY = {
  greeting: 'Hola, listo cuando quieras.',
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
} as const;

export type Copy = typeof COPY;
