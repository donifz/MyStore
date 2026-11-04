import { expect, it } from 'vitest';
import { code128SvgPath, encodeCode128B } from './code128';

it('encodes Code 128 B values with the standard weighted checksum', () => {
  expect(encodeCode128B('AB')).toEqual([104, 33, 34, 102, 106]);
});

it('rejects values that cannot be represented by Code 128 B', () => {
  expect(() => encodeCode128B('товар')).toThrow(
    'Штрихкод содержит неподдерживаемые символы',
  );
});

it('uses compact Code 128C for eight-digit labels, with a 99-module symbol including quiet zones', () => {
  expect(code128SvgPath('00001234').width).toBe(99);
});
