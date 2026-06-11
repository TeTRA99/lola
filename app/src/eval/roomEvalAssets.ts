// Bundled holdout photos for the Debug "Room-ID eval" panel (Charly-only).
//
// How to add photos:
//   1. Drop JPEGs under assets/eval/rooms/ (e.g. cocina-noche-01.jpg). Use
//      FRESH shots — different time of day / angle than the photos used to
//      register the room — or the eval just re-tests the registration session.
//   2. Add an entry below. `expected` must be the room's display name exactly
//      as registered in Setup ("Cocina"), or null for photos that must NOT
//      match any room (a neighbor's hallway, the street) — those test the
//      "no estoy segura" abstain path.
//   3. Metro picks the new require() up on reload; sideloaded builds need a
//      rebundle.
//
// Example:
//   { expected: 'Cocina', asset: require('../../assets/eval/rooms/cocina-noche-01.jpg') },
//   { expected: null, asset: require('../../assets/eval/rooms/pasillo-vecino-01.jpg') },

export const ROOM_EVAL_HOLDOUT: Array<{ expected: string | null; asset: number }> = [];
