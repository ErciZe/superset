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
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '../src');

const officialTablePackage = 'plugin-chart-ag-grid-table';
const disallowedImports = [
  `../../${officialTablePackage}/src/`,
  `../../../${officialTablePackage}/src/`,
  `@superset-ui/${officialTablePackage}/src/`,
];

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(entry => {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });

test('noway table v1 does not import official AG Grid Table internals', () => {
  const offenders = collectSourceFiles(sourceRoot).flatMap(file => {
    const source = readFileSync(file, 'utf8');
    return disallowedImports
      .filter(disallowedImport => source.includes(disallowedImport))
      .map(disallowedImport => ({
        file: path.relative(sourceRoot, file),
        disallowedImport,
      }));
  });

  expect(offenders).toEqual([]);
});
