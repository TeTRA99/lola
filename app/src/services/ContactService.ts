// Family contacts for the local SOS / "call family" feature (no backend).
// Stored as JSON in Settings (a handful of contacts, no relational queries).
// One contact is the emergency/SOS contact — the target for a bare "ayuda"
// and for any future fall-detection trigger (always reached by phone call).

import * as Settings from '@/services/Settings';
import { COPY } from '@/services/CopyModule';

export type ContactChannel = 'call' | 'whatsapp';

export type Contact = {
  id: string;
  name: string;
  phone: string; // E.164 ideally ("+5491122334455")
  emergency?: boolean;
};

export const MAX_CONTACTS = 5;

/** Read the stored contacts (always returns a normalized list). */
export async function listContacts(): Promise<Contact[]> {
  const raw = await Settings.getString(Settings.KEYS.familyContacts, '[]');
  return normalize(parse(raw));
}

/** Persist contacts: cap at MAX_CONTACTS and keep exactly one emergency flag. */
export async function saveContacts(contacts: Contact[]): Promise<Contact[]> {
  const normalized = normalize(contacts).slice(0, MAX_CONTACTS);
  await Settings.setString(Settings.KEYS.familyContacts, JSON.stringify(normalized));
  return normalized;
}

function parse(raw: string): Contact[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(c => c && typeof c.name === 'string' && typeof c.phone === 'string');
  } catch {
    return [];
  }
}

// Cap at 5, drop blanks, and guarantee a single emergency contact (defaulting to
// the first when none is flagged) so the "ayuda" path always has a target.
function normalize(contacts: Contact[]): Contact[] {
  const cleaned = contacts
    .filter(c => c.name.trim() && c.phone.trim())
    .slice(0, MAX_CONTACTS)
    .map(c => ({ id: c.id || makeId(c), name: c.name.trim(), phone: c.phone.trim(), emergency: false }));
  if (cleaned.length === 0) return cleaned;
  const flaggedIdx = contacts.findIndex(c => c.emergency && c.name.trim() && c.phone.trim());
  cleaned[flaggedIdx >= 0 ? flaggedIdx : 0].emergency = true;
  return cleaned;
}

// Deterministic-ish id from name+phone (Math.random/Date.now are fine in the
// app runtime; this only needs to be stable enough to key a list row).
function makeId(c: Contact): string {
  return `${c.name}|${c.phone}`.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Resolve which contact a request targets. With a name → match by name (exact,
 * then a bounded fuzzy includes, mirroring OnboardingService.referencePhotoFor).
 * Without a name (bare "ayuda"/"emergencia") → the emergency contact. Returns
 * null when nothing matches or no contacts are configured. PURE (unit-tested).
 */
export function resolveContact(name: string | null, contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  const trimmed = name?.trim().toLowerCase();
  if (!trimmed) {
    return contacts.find(c => c.emergency) ?? contacts[0];
  }
  return (
    contacts.find(c => c.name.toLowerCase() === trimmed) ??
    contacts.find(
      c => c.name.toLowerCase().includes(trimmed) || trimmed.includes(c.name.toLowerCase()),
    ) ??
    null
  );
}

/** Build the deep link to reach a contact via the chosen channel. For WhatsApp,
 *  `message` is the dictated body (falls back to the default greeting). */
export function contactUrl(c: Contact, channel: ContactChannel, message?: string | null): string {
  if (channel === 'whatsapp') {
    // WhatsApp wants digits only (country code, no '+'/spaces) + a pre-filled body.
    const digits = c.phone.replace(/[^\d]/g, '');
    // A dictated message gets the Lola signature; the no-message fallback already
    // names Lola, so it doesn't.
    const body = message?.trim()
      ? `${message.trim()}${COPY.sos.whatsappSignature}`
      : COPY.sos.whatsappText;
    return `whatsapp://send?phone=${digits}&text=${encodeURIComponent(body)}`;
  }
  // ACTION_DIAL: opens the dialer pre-filled — the user taps call (natural
  // confirmation, no CALL_PHONE permission needed). tel: tolerates the '+'.
  return `tel:${c.phone.replace(/[^\d+]/g, '')}`;
}
