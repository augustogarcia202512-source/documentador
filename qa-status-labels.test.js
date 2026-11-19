const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const labelStart = html.indexOf('  function getQaExecutionStatusLabel(status) {');
const labelEnd = html.indexOf('  function renderQaCycleControls(project) {', labelStart);
assert.ok(labelStart !== -1 && labelEnd !== -1, 'QA execution status label helper must exist');
const labelHelper = html.slice(labelStart, labelEnd);

test('QA execution status displays Blocked as Not Applicable', () => {
  const getLabel = vm.runInNewContext(`(function () { ${labelHelper}; return getQaExecutionStatusLabel; })()`);
  assert.equal(getLabel('blocked'), 'Not Applicable');

  const blockedButtons = [...html.matchAll(/data-status="blocked"[^>]*><span>([^<]+)<\/span>/g)];
  assert.equal(blockedButtons.length, 2);
  assert.deepEqual(blockedButtons.map(([, label]) => label), ['Not Applicable', 'Not Applicable']);
});

test('QA summaries and exports use the Not Applicable label', () => {
  assert.match(html, /status-blocked"><span class="qa-chip-dot"><\/span>Not Applicable/);
  assert.match(html, /\{ key: "blocked", label: "Not Applicable" \}/);
  assert.match(html, /blocked: "Not Applicable"/);
  assert.match(html, /"Not Applicable", "Sin ejec\."/);
});

test('the issue tracker keeps its separate Blocked issue status', () => {
  assert.match(html, /\.dashboard-issue-summary-item\[data-status="Blocked"\]/);
});
