const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

test('new projects and workspace resets begin without predefined suites', () => {
  assert.doesNotMatch(html, /createDefaultSuites/);
  const reset = html.slice(html.indexOf('  async function resetWorkspaceData()'), html.indexOf('  async function ', html.indexOf('  async function resetWorkspaceData()') + 10));
  const initialize = html.slice(html.indexOf('  async function initializeDashboard()'), html.indexOf('  async function ', html.indexOf('  async function initializeDashboard()') + 10));
  assert.match(reset, /suites:\s*\[\]/);
  assert.match(initialize, /suites:\s*\[\]/);
  assert.match(initialize, /if \(!Array\.isArray\(project\.suites\)\)/);
  assert.doesNotMatch(initialize, /!project\.suites\.length/);
  assert.match(html, /name: cleanName, createdAt: Date\.now\(\), suites: \[\]/);
});

test('empty projects explain how to create a suite, separately from search results', () => {
  assert.match(html, /Este proyecto aún no tiene suites\. Pulsa “\+ Nueva suite”/);
  assert.match(html, /Este proyecto aún no tiene suites\. Abre “QA Casos”/);
  assert.match(html, /No hay suites que coincidan con la búsqueda/);
});
