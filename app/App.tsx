// Thin shim — the real root is at src/app.tsx so it lives under the @/ alias tree.
// The Expo entry (index.ts) imports this file; this file re-exports the canonical App.
export { default } from './src/app';
