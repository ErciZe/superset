/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { decodeKey, encodeKey, encodeTuple } from '../../src/crosstab/keys';

function expectErrorMessage(callback: () => unknown, message: string) {
  try {
    callback();
    throw new Error('Expected callback to throw');
  } catch (error) {
    expect((error as Error).message).toBe(message);
  }
}

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
    expectErrorMessage(
      () => encodeKey(undefined),
      'Unsupported crosstab key value type: undefined',
    );
    expectErrorMessage(
      () => encodeKey({ value: 'A' }),
      'Unsupported crosstab key value type: object',
    );
  });

  it('rejects non-finite encode inputs', () => {
    expectErrorMessage(
      () => encodeKey(NaN),
      'Unsupported crosstab key number value: NaN',
    );
    expectErrorMessage(
      () => encodeKey(Infinity),
      'Unsupported crosstab key number value: Infinity',
    );
    expectErrorMessage(
      () => encodeKey(-Infinity),
      'Unsupported crosstab key number value: -Infinity',
    );
  });

  it('rejects invalid encoded keys', () => {
    expectErrorMessage(
      () => decodeKey('date:10:2026-05-01'),
      'Invalid crosstab key type: date',
    );
    expectErrorMessage(
      () => decodeKey('string:x:value'),
      'Invalid crosstab key length: x',
    );
    expectErrorMessage(
      () => decodeKey('string:4:value'),
      'Invalid crosstab key length: expected 4, received 5',
    );
    expectErrorMessage(
      () => decodeKey('boolean:3:yes'),
      'Invalid crosstab boolean key value: yes',
    );
    expectErrorMessage(
      () => decodeKey('number:8:Infinity'),
      'Invalid crosstab number key value: Infinity',
    );
    expectErrorMessage(
      () => decodeKey('number:0:'),
      'Invalid crosstab number key encoding: number:0:',
    );
    expectErrorMessage(
      () => decodeKey('number:2:01'),
      'Invalid crosstab number key encoding: number:2:01',
    );
  });

  it('builds tuple keys without separator collisions', () => {
    expect(encodeTuple(['A|B', 'C'])).not.toBe(encodeTuple(['A', 'B|C']));
  });
});
