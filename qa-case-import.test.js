const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

test('QA case import offers document upload and direct paste in one dialog', () => {
  assert.match(html, /id="qaBulkImportFileBtn"[^>]*>Adjuntar documento<\/button>/);
  assert.match(html, /id="qaBulkImportFile"[^>]*accept="\.xlsx,\.csv,\.tsv/);
  assert.match(html, /id="qaBulkImportText"[^>]*placeholder="Login válido/);
  assert.match(html, /document\.getElementById\("qaBulkImportText"\)\.value = text/);
  assert.match(html, /file\.text\(\)/);
});

test('QA case Excel upload prefers the Casos worksheet and reuses the workbook reader', () => {
  assert.match(html, /readXlsxWorksheetRows\(file, "Casos"\)/);
  assert.match(html, /readXlsxWorksheetRows\(file, "Bitácora"\)/);
  assert.match(html, /Selecciona un archivo \.xlsx, \.csv o \.tsv\./);
});

test('QA case import remains additive and validates pasted or uploaded data before saving', () => {
  assert.match(html, /caseUtils\.parseQaCaseImportRows\(input\.value, \{ autoId: true \}\)/);
  assert.match(html, /savedCases\.push\(\.\.\.importedCases\)/);
  assert.match(html, /Se importaron \$\{importedCases\.length\} casos correctamente\./);
});
