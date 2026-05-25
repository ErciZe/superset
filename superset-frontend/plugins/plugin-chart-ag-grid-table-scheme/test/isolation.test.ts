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
