const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const caseUtils = require('./case-utils');

const html = fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  function syncAutoIssueForCase(');
const end = html.indexOf('  function formatDashboardIssueDate(', start);
assert.ok(start >= 0 && end > start);

function setup(issue) {
  const project = { id: 'p', issues: issue ? [issue] : [] };
  const sync = vm.runInNewContext(`(${html.slice(start, end).trim()})`, {
    projects: [project],
    caseUtils,
    createQaIssueId: () => 'new-issue',
  });
  const record = { qaId: 'case', projectId: 'p', caseId: 'TC-1', steps: [
    { id: 1, severity: 'media', title: 'Error al imprimir', comment: 'No imprime' },
  ] };
  return { project, record, sync };
}

test('automatic title creates, updates and clears without changing description', () => {
  const { project, record, sync } = setup();
  sync(record);
  assert.equal(project.issues[0].findingTitle, 'Error al imprimir');
  assert.equal(project.issues[0].findingTitleEdited, false);
  assert.match(project.issues[0].observation, /No imprime/);
  record.steps[0].title = 'Error de impresión';
  sync(record);
  assert.equal(project.issues[0].findingTitle, 'Error de impresión');
  record.steps[0].title = '';
  sync(record);
  assert.equal(project.issues[0].findingTitle, '');
});

test('existing manual titles are preserved, including titles from older versions', () => {
  for (const findingTitleEdited of [true, undefined]) {
    const { project, record, sync } = setup({
      id: 'existing', source: 'auto', caseQaId: 'case', stepKey: '1',
      status: 'Open', findingTitle: 'Título manual', findingTitleEdited,
    });
    sync(record);
    assert.equal(project.issues[0].findingTitle, 'Título manual');
  }
});

test('legacy issue without title receives the step title without changing identity', () => {
  const { project, record, sync } = setup({
    id: 'existing', displayId: 'ISS-004', source: 'auto', caseQaId: 'case', stepKey: '1',
    status: 'Ready for Retest', observation: 'Descripción manual', observationEdited: true,
  });
  sync(record);
  assert.equal(project.issues.length, 1);
  assert.equal(project.issues[0].id, 'existing');
  assert.equal(project.issues[0].status, 'Ready for Retest');
  assert.equal(project.issues[0].observation, 'Descripción manual');
  assert.equal(project.issues[0].findingTitle, 'Error al imprimir');
  record.steps[0].title = 'Actualizado';
  sync(record);
  assert.equal(project.issues[0].findingTitle, 'Actualizado');
});

test('removing a novelty removes its Open automatic issue but preserves other issues', () => {
  const { project, record, sync } = setup();
  sync(record);
  project.issues.push({ id: 'manual', source: 'manual', status: 'Open' });
  project.issues.push({ id: 'closed', source: 'auto', caseQaId: 'case', stepKey: 'old', status: 'Closed' });
  record.steps = [];
  sync(record);
  assert.deepEqual(Array.from(project.issues, (issue) => issue.id), ['manual', 'closed']);
});

test('pending live synchronization is flushed before navigation and retries failures', async () => {
  const begin = html.indexOf('  let liveIssueTimer = null;');
  const finish = html.indexOf('  async function syncLiveIssueForCurrentCase()', begin);
  assert.ok(begin >= 0 && finish > begin);
  let success = false;
  let calls = 0;
  const api = vm.runInNewContext(`(function () {
    ${html.slice(begin, finish)}
    async function syncLiveIssueForCurrentCase() {
      liveIssueDirty = false;
      const result = await runSync();
      if (!result) liveIssueDirty = true;
      return result;
    }
    return { scheduleLiveIssueSync, flushLiveIssueSync };
  })()`, {
    setTimeout,
    clearTimeout,
    runSync: async () => { calls++; return success; },
  });
  api.scheduleLiveIssueSync();
  assert.equal(await api.flushLiveIssueSync(), false);
  assert.equal(calls, 1);
  success = true;
  assert.equal(await api.flushLiveIssueSync(), true);
  assert.equal(calls, 2);
  assert.equal(await api.flushLiveIssueSync(), true);
  assert.equal(calls, 2);
});
