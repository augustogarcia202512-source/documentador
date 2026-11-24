const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const helperStart = html.indexOf('  function getActiveExecutionCycle(project) {');
const helperEnd = html.indexOf('  function getQaExecutionStatusLabel(status) {', helperStart);
const dashboardStart = html.indexOf('  function renderDashboard() {');
const dashboardEnd = html.indexOf('  function getDashboardProjectAssignees(project) {', dashboardStart);
assert.ok(helperStart !== -1 && helperEnd !== -1 && dashboardStart !== -1 && dashboardEnd !== -1);

function createDashboard(project, cases) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', style: {} });
    return elements.get(id);
  };
  const context = {
    projects: [project],
    activeProjectId: project.id,
    document: { getElementById: element },
    localStorage: { setItem() {} },
    caseUtils: require('./case-utils.js'),
    normalizeStepStatus: require('./case-utils.js').normalizeStepStatus,
    getActiveProjectCases: () => cases,
    renderDashboardNovedades() {},
    setProgressBar: (id, value) => { element(id).value = value; },
    escapeHtml: (value) => String(value),
    renderDashboardProjects() {},
    renderProjectSelector() {},
    renderDocumenterCasePicker() {},
    renderQaPanel() {},
    renderDashboardNotes() {},
  };
  const dashboard = vm.runInNewContext(
    `(function () { ${html.slice(helperStart, helperEnd)} ${html.slice(dashboardStart, dashboardEnd)}; return renderDashboard; })()`,
    context,
  );
  return { dashboard, element };
}

test('dashboard metrics count project cases and use evaluated cases for approval', () => {
  const cases = [
    { qaId: '1', projectId: 'p', executionStatus: 'pass', steps: [{}, {}, {}] },
    { qaId: '2', projectId: 'p', executionStatus: 'failed', steps: [] },
    { qaId: '3', projectId: 'p', executionStatus: 'blocked' },
    { qaId: '4', projectId: 'p', executionStatus: 'in-progress' },
    { qaId: '5', projectId: 'p', executionStatus: 'not-executed' },
  ];
  const { dashboard, element } = createDashboard({ id: 'p', name: 'Proyecto', qaCyclesEnabled: false }, cases);
  dashboard();
  assert.equal(element('metricCases').textContent, 5);
  assert.equal(element('metricExecution').textContent, '80%');
  assert.equal(element('metricExecutionHint').textContent, '4 de 5 casos ejecutados');
  assert.equal(element('metricApproval').textContent, '50%');
  assert.equal(element('metricApprovalHint').textContent, '1 de 2 casos evaluados aprobados');
  assert.equal(element('metricFailures').textContent, 1);
  assert.equal(element('progressFailuresLabel').textContent, '20%');
  assert.equal(element('metricExecutionScope').textContent, 'Proyecto · modo actual');
});

test('dashboard metrics follow the selected cycle scope and switch back to current mode', () => {
  const source = { id: 'first', name: 'Ciclo 1', results: { a: { status: 'failed' }, b: { status: 'pass' } } };
  const retry = {
    id: 'retry', name: 'Reejecución', retryFromCycleId: 'first',
    retryCaseIds: ['a'], knownCaseIds: ['a', 'b', 'c'],
    results: { a: { status: 'pass' } },
  };
  const cases = [
    { qaId: 'a', projectId: 'p', executionStatus: 'failed' },
    { qaId: 'b', projectId: 'p', executionStatus: 'failed' },
    { qaId: 'c', projectId: 'p', executionStatus: 'not-executed' },
  ];
  const project = { id: 'p', name: 'Proyecto', qaCyclesEnabled: true, activeExecutionCycleId: 'retry', executionCycles: [source, retry] };
  const { dashboard, element } = createDashboard(project, cases);
  dashboard();
  assert.equal(element('metricCases').textContent, 3);
  assert.equal(element('metricExecutionHint').textContent, '1 de 1 casos ejecutados');
  assert.equal(element('metricApproval').textContent, '100%');
  assert.equal(element('metricFailures').textContent, 0);
  for (const id of ['metricExecutionScope', 'metricApprovalScope', 'metricFailuresScope']) {
    assert.equal(element(id).textContent, 'Ciclo: Reejecución · 1 caso');
  }
  assert.equal(element('dashboardProgressScope').textContent, '1 caso · Ciclo: Reejecución');

  project.activeExecutionCycleId = 'first';
  dashboard();
  assert.equal(element('metricExecutionHint').textContent, '2 de 3 casos ejecutados');
  assert.equal(element('metricApproval').textContent, '50%');
  assert.equal(element('metricFailures').textContent, 1);
  assert.equal(element('metricExecutionScope').textContent, 'Ciclo: Ciclo 1 · 3 casos');

  project.qaCyclesEnabled = false;
  dashboard();
  assert.equal(element('metricExecutionHint').textContent, '2 de 3 casos ejecutados');
  assert.equal(element('metricApproval').textContent, '0%');
  assert.equal(element('metricFailures').textContent, 2);
  assert.equal(element('metricFailuresScope').textContent, 'Proyecto · modo actual');
});

test('dashboard handles no evaluated cases and derives legacy case statuses from steps', () => {
  const cases = [
    { qaId: '1', projectId: 'p', executionStatus: 'not-executed', steps: [{ stepStatus: 'observado' }] },
    { qaId: '2', projectId: 'p', executionStatus: 'blocked' },
    { qaId: '3', projectId: 'p', executionStatus: 'not-executed' },
  ];
  const { dashboard, element } = createDashboard({ id: 'p', name: 'Proyecto' }, cases);
  dashboard();
  assert.equal(element('metricExecution').textContent, '67%');
  assert.equal(element('metricApproval').textContent, '—');
  assert.equal(element('metricApprovalHint').textContent, '0 de 0 casos evaluados aprobados');
  assert.equal(element('progressApproval').value, 0);
  assert.equal(element('metricFailures').textContent, 0);
});

test('empty projects and missing active cycles do not report a misleading approval rate', () => {
  const project = { id: 'p', name: 'Proyecto', qaCyclesEnabled: false };
  const { dashboard, element } = createDashboard(project, []);
  dashboard();
  assert.equal(element('metricCases').textContent, 0);
  assert.equal(element('metricExecution').textContent, '0%');
  assert.equal(element('metricApproval').textContent, '—');
  assert.equal(element('dashboardProgressScope').textContent, '0 casos · Proyecto · modo actual');
  project.qaCyclesEnabled = true;
  dashboard();
  assert.equal(element('metricExecutionScope').textContent, 'Ciclo no disponible');
});

test('case metric labels clarify that progress bars use case-based denominators', () => {
  assert.match(html, /Ejecución de casos/);
  assert.match(html, /Total de casos del proyecto/);
  assert.match(html, /Casos guardados, sin duplicar por ciclo/);
  assert.match(html, /Casos fallidos/);
  assert.match(html, /Aprobación \(evaluados\)/);
  assert.match(html, /Fallidos \(total\)/);
});
