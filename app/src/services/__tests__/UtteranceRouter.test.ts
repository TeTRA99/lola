import { route } from '../UtteranceRouter';

describe('UtteranceRouter', () => {
  describe('repeat', () => {
    const cases = [
      'otra vez',
      '¿otra vez?',
      'Lola, ¿otra vez?',
      'lola otra vez',
      'de nuevo',
      'repetí',
      'repetí por favor',
      'OTRA VEZ',
      '  lola, otra vez  ',
      'otra vez, contame más',  // repeat wins (precedence)
    ];
    for (const u of cases) {
      test(`"${u}" → repeat`, () => {
        expect(route(u)).toEqual({ type: 'repeat' });
      });
    }
  });

  describe('extend', () => {
    const cases = [
      'contame más',
      'Lola, contame más',
      'contame mas',  // no accent
      'seguí',
      'segui',
      'más detalle',
      'mas detalle',
    ];
    for (const u of cases) {
      test(`"${u}" → extend`, () => {
        expect(route(u)).toEqual({ type: 'extend' });
      });
    }
  });

  describe('memory', () => {
    test('"¿dónde está mi cepillo?" → memory cepillo', () => {
      expect(route('¿dónde está mi cepillo?')).toEqual({
        type: 'memory',
        object: 'mi cepillo',
      });
    });
    test('"dónde está la pava" → memory pava', () => {
      expect(route('dónde está la pava')).toEqual({ type: 'memory', object: 'la pava' });
    });
    test('"¿viste mi yerba?" → memory yerba (the "mi" is part of the trigger)', () => {
      expect(route('¿viste mi yerba?')).toEqual({ type: 'memory', object: 'yerba' });
    });
    test('"¿dónde puse las llaves?" → memory llaves', () => {
      expect(route('¿dónde puse las llaves?')).toEqual({
        type: 'memory',
        object: 'las llaves',
      });
    });
    test('"Lola, ¿dónde está el remedio de la presión?" → memory remedio...', () => {
      expect(route('Lola, ¿dónde está el remedio de la presión?')).toEqual({
        type: 'memory',
        object: 'el remedio de la presión',
      });
    });
    test('case-insensitive', () => {
      expect(route('DÓNDE ESTÁ MI CEPILLO')).toEqual({
        type: 'memory',
        object: 'MI CEPILLO',
      });
    });
  });

  describe('model (default)', () => {
    const cases = [
      '¿qué es esto?',
      'qué es esto',
      'qué tengo en la mano',
      'hola',
      'gracias',
      '',
      '   ',
    ];
    for (const u of cases) {
      test(`"${u}" → model`, () => {
        expect(route(u)).toEqual({ type: 'model' });
      });
    }
  });
});
