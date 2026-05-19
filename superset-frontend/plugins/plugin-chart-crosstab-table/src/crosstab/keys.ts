export type EncodedValue =
  | { type: 'null'; value: null }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean };

const SUPPORTED_TYPES = new Set(['null', 'string', 'number', 'boolean']);

export function encodeKey(value: unknown): string {
  if (value === null) {
    return 'null:0:';
  }

  const type = typeof value;
  if (type !== 'string' && type !== 'number' && type !== 'boolean') {
    throw new Error(`Unsupported crosstab key value type: ${type}`);
  }

  if (type === 'number' && !Number.isFinite(value)) {
    throw new Error(`Unsupported crosstab key number value: ${value}`);
  }

  const raw = String(value);
  return `${type}:${raw.length}:${raw}`;
}

export function encodeTuple(values: unknown[]): string {
  return values.map(encodeKey).join('|');
}

export function decodeKey(encoded: string): EncodedValue {
  const typeSeparator = encoded.indexOf(':');
  if (typeSeparator <= 0) {
    throw new Error(`Invalid crosstab key format: ${encoded}`);
  }

  const lengthSeparator = encoded.indexOf(':', typeSeparator + 1);
  if (lengthSeparator <= typeSeparator + 1) {
    throw new Error(`Invalid crosstab key format: ${encoded}`);
  }

  const type = encoded.slice(0, typeSeparator);
  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error(`Invalid crosstab key type: ${type}`);
  }

  const lengthRaw = encoded.slice(typeSeparator + 1, lengthSeparator);
  const length = Number(lengthRaw);
  if (!Number.isInteger(length) || length < 0 || String(length) !== lengthRaw) {
    throw new Error(`Invalid crosstab key length: ${lengthRaw}`);
  }

  const raw = encoded.slice(lengthSeparator + 1);
  if (raw.length !== length) {
    throw new Error(
      `Invalid crosstab key length: expected ${length}, received ${raw.length}`,
    );
  }

  if (type === 'null') {
    if (length !== 0) {
      throw new Error(`Invalid crosstab null key length: ${length}`);
    }
    return { type, value: null };
  }

  if (type === 'string') {
    return { type, value: raw };
  }

  if (type === 'number') {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid crosstab number key value: ${raw}`);
    }
    if (encodeKey(value) !== encoded) {
      throw new Error(`Invalid crosstab number key encoding: ${encoded}`);
    }
    return { type, value };
  }

  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`Invalid crosstab boolean key value: ${raw}`);
  }
  return { type, value: raw === 'true' };
}
