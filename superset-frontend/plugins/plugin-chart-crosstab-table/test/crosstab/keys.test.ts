import { decodeKey, encodeKey, encodeTuple } from '../../src/crosstab/keys';

describe('crosstab keys', () => {
  it('separates type, length, and display value', () => {
    expect(encodeKey(null)).toBe('null:0:');
    expect(encodeKey('12:string')).toBe('string:9:12:string');
    expect(encodeKey(12)).toBe('number:2:12');
    expect(encodeKey(true)).toBe('boolean:4:true');
  });

  it('round trips encoded values', () => {
    expect(decodeKey('null:0:')).toEqual({ type: 'null', value: null });
    expect(decodeKey('string:9:12:string')).toEqual({
      type: 'string',
      value: '12:string',
    });
    expect(decodeKey('number:4:12.5')).toEqual({
      type: 'number',
      value: 12.5,
    });
    expect(decodeKey('boolean:5:false')).toEqual({
      type: 'boolean',
      value: false,
    });
    expect(decodeKey('boolean:4:true')).toEqual({
      type: 'boolean',
      value: true,
    });
  });

  it('rejects unsupported encode inputs', () => {
    expect(() => encodeKey(undefined)).toThrow(
      'Unsupported crosstab key value type: undefined',
    );
    expect(() => encodeKey({ value: 'A' })).toThrow(
      'Unsupported crosstab key value type: object',
    );
  });

  it('rejects non-finite encode inputs', () => {
    expect(() => encodeKey(NaN)).toThrow(
      'Unsupported crosstab key number value: NaN',
    );
    expect(() => encodeKey(Infinity)).toThrow(
      'Unsupported crosstab key number value: Infinity',
    );
    expect(() => encodeKey(-Infinity)).toThrow(
      'Unsupported crosstab key number value: -Infinity',
    );
  });

  it('rejects invalid encoded keys', () => {
    expect(() => decodeKey('date:10:2026-05-01')).toThrow(
      'Invalid crosstab key type: date',
    );
    expect(() => decodeKey('string:x:value')).toThrow(
      'Invalid crosstab key length: x',
    );
    expect(() => decodeKey('string:4:value')).toThrow(
      'Invalid crosstab key length: expected 4, received 5',
    );
    expect(() => decodeKey('boolean:3:yes')).toThrow(
      'Invalid crosstab boolean key value: yes',
    );
    expect(() => decodeKey('number:8:Infinity')).toThrow(
      'Invalid crosstab number key value: Infinity',
    );
    expect(() => decodeKey('number:0:')).toThrow(
      'Invalid crosstab number key encoding: number:0:',
    );
    expect(() => decodeKey('number:2:01')).toThrow(
      'Invalid crosstab number key encoding: number:2:01',
    );
  });

  it('builds tuple keys without separator collisions', () => {
    expect(encodeTuple(['A/B', 'C'])).not.toBe(encodeTuple(['A', 'B/C']));
  });
});
