const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const helperStart = html.indexOf('  function getDashboardNoveltyIssue(');
const helperEnd = html.indexOf('  function renderDashboardNovedades(', helperStart);
assert.ok(helperStart !== -1 && helperEnd !== -1, 'novelty-to-issue lookup must exist');
const helperSource = html.slice(helperStart, helperEnd);
const getNoveltyIssue = vm.runInNewContext(
  `(function () { ${helperSource}; return getDashboardNoveltyIssue; })()`
);

test('novelty tracking links the matching automatic issue by case and grouped step evidence', () => {
  const expectedIssue = {
    id: 'issue-1',
    source: 'auto',
    caseQaId: 'case-1',
    evidenceStepIds: ['step-1', 'step-2'],
  };
  const project = {
    issues: [
      { ...expectedIssue, id: 'wrong-case', caseQaId: 'case-2' },
      { ...expectedIssue, id: 'manual', source: 'manual' },
      expectedIssue,
    ],
  };

  assert.equal(getNoveltyIssue({ qaId: 'case-1' }, { id: 'step-2' }, project), expectedIssue);
  assert.equal(getNoveltyIssue({ qaId: 'case-1' }, { id: 'step-3' }, project), null);
});

test('novelty tracking does not guess an issue when case or step IDs are missing', () => {
  const project = { issues: [{ source: 'auto', caseQaId: 'case-1', stepKey: 'step-1' }] };

  assert.equal(getNoveltyIssue({}, { id: 'step-1' }, project), null);
  assert.equal(getNoveltyIssue({ qaId: 'case-1' }, {}, project), null);
});

test('novelty cards label the action as opening evidence and show issue tracking fields', () => {
  assert.match(html, /data-novelty-open="\$\{noveltyIndex\}">Abrir evidencia/);
  assert.match(html, /issueStatusLabels\[linkedIssue\.status\]/);
  assert.match(html, /linkedIssue\.assignee \|\| "Sin responsable"/);
  assert.match(html, /Sin issue asociado/);
});
