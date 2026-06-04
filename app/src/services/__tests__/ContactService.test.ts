// In-memory Settings stub so list/save round-trips without SQLite.
jest.mock('@/services/Settings', () => {
  const store: Record<string, string> = {};
  return {
    getString: jest.fn(async (k: string, d = '') => store[k] ?? d),
    setString: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    KEYS: { familyContacts: 'family_contacts' },
  };
});

import * as ContactService from '../ContactService';
import type { Contact } from '../ContactService';
import { COPY } from '@/services/CopyModule';

const c = (name: string, phone: string, emergency = false): Contact => ({ id: '', name, phone, emergency });

beforeEach(() => { jest.clearAllMocks(); });

describe('ContactService.resolveContact (pure)', () => {
  const list: Contact[] = [
    { id: 'a', name: 'Charly', phone: '+541', emergency: false },
    { id: 'b', name: 'Mariana', phone: '+542', emergency: true },
  ];

  test('exact match is case-insensitive', () => {
    expect(ContactService.resolveContact('charly', list)?.id).toBe('a');
  });

  test('fuzzy includes match ("mi hija mariana" → Mariana)', () => {
    expect(ContactService.resolveContact('mi hija mariana', list)?.id).toBe('b');
  });

  test('null name → the emergency contact', () => {
    expect(ContactService.resolveContact(null, list)?.id).toBe('b');
  });

  test('null name with none flagged → the first contact', () => {
    const noFlag: Contact[] = [
      { id: 'a', name: 'Charly', phone: '+541', emergency: false },
      { id: 'b', name: 'Mariana', phone: '+542', emergency: false },
    ];
    expect(ContactService.resolveContact(null, noFlag)?.id).toBe('a');
  });

  test('no contacts → null', () => {
    expect(ContactService.resolveContact('Charly', [])).toBeNull();
  });

  test('named but no match → null', () => {
    expect(ContactService.resolveContact('Pedro', list)).toBeNull();
  });
});

describe('ContactService.contactUrl (pure)', () => {
  const contact: Contact = { id: 'a', name: 'Charly', phone: '+54 9 11 2233', emergency: true };

  test('call → tel: keeps the +, strips spaces', () => {
    expect(ContactService.contactUrl(contact, 'call')).toBe('tel:+549112233');
  });

  test('whatsapp → digits only + default pre-filled text', () => {
    const url = ContactService.contactUrl(contact, 'whatsapp');
    expect(url).toContain('whatsapp://send?phone=549112233');
    expect(url).toContain('&text=');
  });

  test('whatsapp with a dictated message uses it + the Lola signature', () => {
    const url = ContactService.contactUrl(contact, 'whatsapp', 'Estoy bien');
    expect(url).toContain(`&text=${encodeURIComponent('Estoy bien' + COPY.sos.whatsappSignature)}`);
  });

  test('whatsapp with a blank message falls back to the default body', () => {
    const url = ContactService.contactUrl(contact, 'whatsapp', '   ');
    expect(url).toContain(`&text=${encodeURIComponent(COPY.sos.whatsappText)}`);
  });
});

describe('ContactService.saveContacts / listContacts', () => {
  test('round-trips and caps at 5, keeping one emergency', async () => {
    const six = [c('A', '1'), c('B', '2'), c('C', '3'), c('D', '4'), c('E', '5'), c('F', '6')];
    const saved = await ContactService.saveContacts(six);
    expect(saved).toHaveLength(ContactService.MAX_CONTACTS);
    expect(saved.filter(x => x.emergency)).toHaveLength(1);

    const read = await ContactService.listContacts();
    expect(read).toHaveLength(ContactService.MAX_CONTACTS);
    expect(read.filter(x => x.emergency)).toHaveLength(1);
  });

  test('preserves an explicitly flagged emergency contact', async () => {
    const saved = await ContactService.saveContacts([c('A', '1'), c('B', '2', true)]);
    expect(saved.find(x => x.emergency)?.name).toBe('B');
  });

  test('drops blank name/phone rows', async () => {
    const saved = await ContactService.saveContacts([c('', ''), c('Charly', '+541')]);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Charly');
    expect(saved[0].emergency).toBe(true); // defaults to the only contact
  });
});
