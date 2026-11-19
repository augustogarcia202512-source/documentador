const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

test('issue log provides document upload and direct-paste import in one dialog', () => {
  assert.match(html, /id="dashboardIssueImportOpenBtn"[^>]*>Importar issues<\/button>/);
  assert.match(html, /id="dashboardIssueImportFileInput"[^>]*accept="\.xlsx,\.csv,\.tsv/);
  assert.match(html, /id="dashboardIssueImportText"[^>]*placeholder="TC-101/);
  assert.match(html, /caseUtils\.parseDashboardIssueImportText\(text\)/);
  assert.match(html, /id="dashboardIssueImportSubmitBtn"[^>]*>Importar<\/button>/);
});

test('XLSX reader chooses the Bitácora sheet and supports inline and shared strings', () => {
  assert.match(html, /name"\)\?\.trim\(\)\.toLocaleLowerCase\(\) === "bitácora"/);
  assert.match(html, /type === "inlineStr"/);
  assert.match(html, /type === "s" \? sharedStrings\[Number\(value\)\]/);
  assert.match(html, /file\.size > 50 \* 1024 \* 1024/);
});

test('issue import appends without replacing existing issues and protects against duplicates', () => {
  assert.match(html, /reservedDisplayIds\.has\(importedDisplayId\.toLocaleLowerCase\(\)\)/);
  assert.match(html, /project\.issues = \[\.\.\.issuesBefore, \.\.\.candidates\]/);
  assert.match(html, /project\.issues = issuesBefore;/);
  assert.match(html, /No se reemplazarán los issues existentes/);
});

test('import date parser supports Excel serials and Spanish dates', () => {
  const start = html.indexOf('  function parseDashboardIssueImportDate(value, fallback) {');
  const end = html.indexOf('  async function importDashboardIssues(parsed, opener, sourceLabel) {', start);
  assert.ok(start !== -1 && end !== -1);
  const parseDate = vm.runInNewContext(`(function () { ${html.slice(start, end)}; return parseDashboardIssueImportDate; })()`);
  assert.equal(parseDate('01/02/2025', null), new Date(2025, 1, 1).getTime());
  assert.equal(parseDate('45689', null), Date.UTC(1899, 11, 30) + 45689 * 86400000);
});
