import { parseHasLseAtomics } from '../cpuFeatures';

// Real /proc/cpuinfo shapes. The Redmi Note 11 (SD680, Cortex-A73/A53) line has no
// `atomics`; a Cortex-A55 (Galaxy A12 SM-A127M) line does.
const REDMI = `processor\t: 0
BogoMIPS\t: 38.40
Features\t: fp asimd evtstrm aes pmull sha1 sha2 crc32 cpuid
CPU implementer\t: 0x41
Hardware\t: Qualcomm Technologies, Inc SM6225`;

const A55 = `processor\t: 0
Features\t: fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm lrcpc dcpop asimddp
CPU implementer\t: 0x41`;

describe('parseHasLseAtomics', () => {
  test('ARMv8.0 (SD680) → false', () => expect(parseHasLseAtomics(REDMI)).toBe(false));
  test('ARMv8.2 with LSE (A55) → true', () => expect(parseHasLseAtomics(A55)).toBe(true));
  test('no Features line → null (unknown, caller assumes OK)', () =>
    expect(parseHasLseAtomics('processor: 0\nHardware: x')).toBeNull());
  test('does not match a flag that merely contains the word', () =>
    expect(parseHasLseAtomics('Features: fp asimd atomicsx')).toBe(false));
});
