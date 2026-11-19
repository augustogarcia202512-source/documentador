const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  async function saveDashboardIssue(event) {');
const end = html.indexOf('  function openDashboardIssueEvidence(', start);
assert.ok(start !== -1 && end !== -1, 'issue editor save handler must exist');
const saveHandler = html.slice(start, end);

function createEditor({ caseSuiteId, selectedSuiteId = '', existingSuiteId = '', isNew = false, assignee = '' } = {}) {
  const relatedCase = { qaId: 'case-1' };
  if (caseSuiteId !== undefined) relatedCase.suiteId = caseSuiteId;
  const existing = {
    id: 'issue-1', displayId: 'ISSUE-001', source: 'auto', caseQaId: 'case-1',
    suiteId: existingSuiteId, observation: 'Detalle', severity: 'Medium', priority: 'Medium', status: 'Open',
  };
  const project = {
    id: 'project-1',
    suites: [{ id: 'suite-a', name: 'Suite A' }, { id: 'suite-b', name: 'Suite B' }],
    issues: isNew ? [] : [existing],
  };
  const values = {
    dashboardIssueCase: 'case-1',
    dashboardIssueSuite: selectedSuiteId,
    dashboardIssueId: isNew ? '' : 'issue-1',
    dashboardIssueTestId: 'CP-1',
    dashboardIssueFormName: 'Caso',
    dashboardIssueFindingTitle: 'Hallazgo',
    dashboardIssueObservation: 'Detalle',
    dashboardIssueSeverity: 'Medium',
    dashboardIssuePriority: 'Medium',
    dashboardIssueStatus: 'Open',
    dashboardIssueCreatedAt: '',
    dashboardIssueClosedAt: '',
    dashboardIssueAssignee: assignee,
  };
  const elements = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value, focus() {} }]));
  for (const id of ['dashboardIssueFormError', 'dashboardIssueSaveBtn', 'dashboardIssueCancelBtn']) {
    elements[id] = { hidden: true, disabled: false, textContent: '', focus() {} };
  }
  let persisted;
  const context = {
    document: { getElementById: (id) => elements[id] },
    projects: [project],
    activeProjectId: project.id,
    getActiveProjectCases: () => [relatedCase],
    dashboardIssueSaving: false,
    dashboardIssuePendingImages: 0,
    dashboardIssueDraftImages: [{ id: 'image-1', dataUrl: 'data:image/png;base64,abc' }],
    dashboardIssueDraftComments: [],
    DASHBOARD_ISSUE_STATUSES: ['Open', 'Closed'],
    DASHBOARD_ISSUE_PRIORITIES: ['Low', 'Medium', 'High'],
    addDashboardIssueDraftComment() {},
    toDateTimeLocalValue: () => '',
    createQaIssueId: () => 'new-issue',
    caseUtils: { nextSuiteIssueDisplayId: () => 'SUITE-001' },
    saveProjectsToDB: async () => { persisted = JSON.parse(JSON.stringify(project)); return true; },
    closeDashboardIssueEditor() {},
    renderDashboard() {},
    showTransientStatus() {},
    console,
  };
  const save = vm.runInNewContext(`(function () { ${saveHandler}; return saveDashboardIssue; })()`, context);
  return { save: () => save({ preventDefault() {} }), elements, getPersisted: () => persisted };
}

for (const caseSuiteId of [undefined, null, '']) {
  test(`editing an automatic issue saves its attachment when the case has no suite (${String(caseSuiteId)})`, async () => {
    const editor = createEditor({ caseSuiteId, existingSuiteId: 'stale-suite' });
    await editor.save();
    assert.equal(editor.getPersisted().issues[0].suiteId, '');
    assert.equal(editor.getPersisted().issues[0].attachments[0].id, 'image-1');
    assert.equal(editor.elements.dashboardIssueFormError.textContent, '');
  });
}

test('editing an issue retains matching suite and saves its attachment', async () => {
  const editor = createEditor({ caseSuiteId: 'suite-a', selectedSuiteId: 'suite-a', existingSuiteId: 'suite-a' });
  await editor.save();
  assert.equal(editor.getPersisted().issues[0].suiteId, 'suite-a');
  assert.equal(editor.getPersisted().issues[0].attachments[0].id, 'image-1');
});

test('editing an issue still rejects a genuinely different suite', async () => {
  const editor = createEditor({ caseSuiteId: 'suite-a', selectedSuiteId: 'suite-b' });
  await editor.save();
  assert.equal(editor.getPersisted(), undefined);
  assert.equal(editor.elements.dashboardIssueFormError.textContent, 'La suite seleccionada no coincide con la suite del caso relacionado.');
});

test('a new manual issue still requires a suite', async () => {
  const editor = createEditor({ isNew: true });
  await editor.save();
  assert.equal(editor.getPersisted(), undefined);
  assert.equal(editor.elements.dashboardIssueFormError.textContent, 'Selecciona una suite para generar el ID automático del issue.');
});

test('saving an issue preserves a selected or manually entered assignee', async () => {
  const editor = createEditor({ caseSuiteId: 'suite-a', selectedSuiteId: 'suite-a', existingSuiteId: 'suite-a', assignee: 'Ana Pérez' });
  await editor.save();
  assert.equal(editor.getPersisted().issues[0].assignee, 'Ana Pérez');
});

test('selecting the empty Sin asignar option clears the issue assignee', async () => {
  const editor = createEditor({ caseSuiteId: 'suite-a', selectedSuiteId: 'suite-a', existingSuiteId: 'suite-a', assignee: '' });
  await editor.save();
  assert.equal(editor.getPersisted().issues[0].assignee, '');
});
