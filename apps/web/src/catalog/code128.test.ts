import { expect, it } from 'vitest';
import { encodeCode128B } from './code128';

it('encodes Code 128 B values with the standard weighted checksum', () => {
  expect(encodeCode128B('AB')).toEqual([104, 33, 34, 102, 106]);
});

it('rejects values that cannot be represented by Code 128 B', () => {
  expect(() => encodeCode128B('товар')).toThrow(
    'Штрихкод содержит неподдерживаемые символы',
  );
});
