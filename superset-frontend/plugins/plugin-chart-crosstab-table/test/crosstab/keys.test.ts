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
  });

  it('builds tuple keys without separator collisions', () => {
    expect(encodeTuple(['A/B', 'C'])).not.toBe(encodeTuple(['A', 'B/C']));
  });
});
