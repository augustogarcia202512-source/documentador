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

function createCaseFilter() {
  const cases = [
    { qaId: 'a', caseId: 'A-01', description: 'Caso A', suiteId: 'suite-a' },
    { qaId: 'b', caseId: 'B-01', description: 'Caso B', suiteId: 'suite-b' },
    { qaId: 'legacy', caseId: 'L-01', description: 'Sin suite' },
  ];
  const select = {
    options: [],
    _value: '',
    replaceChildren(option) { this.options = [option]; this._value = ''; },
    append(option) { this.options.push(option); },
    set value(value) { this._value = this.options.some((option) => option.value === value) ? value : ''; },
    get value() { return this._value; },
  };
  const elements = {
    dashboardIssueSuite: { value: '' },
    dashboardIssueCase: select,
    dashboardIssueCaseHint: { textContent: '' },
    dashboardIssueTestId: { value: '' },
    dashboardIssueFormName: { value: '' },
  };
  const begin = html.indexOf('  function updateDashboardIssueCases(');
  const finish = html.indexOf('  function updateDashboardIssueSuite(', begin);
  assert.ok(begin >= 0 && finish > begin);
  const helpers = vm.runInNewContext(`(function () { ${html.slice(begin, finish)} return { updateDashboardIssueCases, updateDashboardIssueCaseFields }; })()`, {
    document: { getElementById: (id) => elements[id] },
    getActiveProjectCases: () => cases,
    Option: function (text, value) { this.text = text; this.value = value; },
  });
  return { ...helpers, cases, elements, select };
}

test('case options follow the selected suite and handle empty suites', () => {
  const { updateDashboardIssueCases, elements, select } = createCaseFilter();
  updateDashboardIssueCases();
  assert.deepEqual(select.options.map((option) => option.value), ['']);
  elements.dashboardIssueSuite.value = 'suite-a';
  updateDashboardIssueCases('a');
  assert.deepEqual(select.options.map((option) => option.value), ['', 'a']);
  assert.equal(select.value, 'a');
  elements.dashboardIssueSuite.value = 'suite-b';
  updateDashboardIssueCases('a');
  assert.deepEqual(select.options.map((option) => option.value), ['', 'b']);
  assert.equal(select.value, '');
  elements.dashboardIssueSuite.value = 'empty';
  updateDashboardIssueCases();
  assert.match(elements.dashboardIssueCaseHint.textContent, /no tiene casos/);
});

test('editing retains a legacy associated case even when its suite is missing', () => {
  const { updateDashboardIssueCases, elements, select } = createCaseFilter();
  elements.dashboardIssueSuite.value = '';
  updateDashboardIssueCases('legacy', true);
  assert.equal(select.value, 'legacy');
  assert.match(select.options[1].text, /sin suite/);
});

test('changing case replaces derived fields but preserves manual values', () => {
  const { updateDashboardIssueCaseFields, cases, elements } = createCaseFilter();
  updateDashboardIssueCaseFields(null, cases[0]);
  assert.equal(elements.dashboardIssueTestId.value, 'A-01');
  elements.dashboardIssueFormName.value = 'Nombre personalizado';
  updateDashboardIssueCaseFields(cases[0], cases[1]);
  assert.equal(elements.dashboardIssueTestId.value, 'B-01');
  assert.equal(elements.dashboardIssueFormName.value, 'Nombre personalizado');
  updateDashboardIssueCaseFields(cases[1], null);
  assert.equal(elements.dashboardIssueTestId.value, '');
  assert.equal(elements.dashboardIssueFormName.value, 'Nombre personalizado');
});
