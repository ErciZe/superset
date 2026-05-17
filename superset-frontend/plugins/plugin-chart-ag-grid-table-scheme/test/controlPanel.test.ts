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
import controlPanel from '../src/controlPanel';

type ControlSetRows = ReadonlyArray<ReadonlyArray<unknown>>;

const getControlNames = (rows: ControlSetRows) =>
  rows.flatMap(row =>
    row
      .filter(
        (control): control is { name: string } =>
          Boolean(control) &&
          typeof control === 'object' &&
          typeof (control as { name?: unknown }).name === 'string',
      )
      .map(control => control.name),
  );

describe('AG Grid table scheme control panel', () => {
  it('keeps column view controls in Options after Customize columns', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];
    const optionsSection = sections.find(section =>
      section.controlSetRows.some(row =>
        row.some(
          control =>
            Boolean(control) &&
            typeof control === 'object' &&
            (control as { name?: string }).name === 'column_config',
        ),
      ),
    );

    expect(querySection).toBeDefined();
    expect(optionsSection).toBeDefined();

    if (!querySection || !optionsSection) {
      throw new Error('Expected query and options sections to be available');
    }

    const queryControlNames = getControlNames(querySection.controlSetRows);
    const optionControlNames = getControlNames(optionsSection.controlSetRows);

    expect(queryControlNames).toContain('matrix_mode_enabled');
    expect(queryControlNames).not.toContain('column_view_schemes_enabled');
    expect(queryControlNames).not.toContain('column_settings_enabled');

    expect(optionControlNames).toEqual(
      expect.arrayContaining([
        'column_config',
        'column_view_schemes_enabled',
        'column_settings_enabled',
      ]),
    );
    expect(optionControlNames.indexOf('column_view_schemes_enabled')).toBe(
      optionControlNames.indexOf('column_config') + 1,
    );
    expect(optionControlNames.indexOf('column_settings_enabled')).toBe(
      optionControlNames.indexOf('column_view_schemes_enabled') + 1,
    );
  });
});
