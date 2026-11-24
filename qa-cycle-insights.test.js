const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const helpersStart = html.indexOf('  function getActiveExecutionCycle(project) {');
const helpersEnd = html.indexOf('  function getQaExecutionStatusLabel(status) {', helpersStart);
const insightsStart = html.indexOf('  function getQaCycleReadiness(project, cycle, projectCases) {');
const insightsEnd = html.indexOf('  function renderQaCycleComparison(project, projectCases) {', insightsStart);
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart && insightsStart >= 0 && insightsEnd > insightsStart);

function setup(project) {
  const container = { hidden: true, innerHTML: '' };
  const context = {
    projects: [project],
    document: { getElementById: () => container },
    escapeHtml: (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  };
  const functions = vm.runInNewContext(
    `(function () { ${html.slice(helpersStart, helpersEnd)} ${html.slice(insightsStart, insightsEnd)}; return { getQaCycleReadiness, getQaRetestSummary, getQaInsightCases, renderQaCycleInsights }; })()`,
    context,
  );
  return { ...functions, container };
}

test('closure recommendation checks cycle statuses and all project Critical/High issues', () => {
  const cycle = { id: 'one', name: 'Ciclo 1', results: { a: { status: 'pass' }, b: { status: 'blocked' } } };
  const project = { id: 'p', qaCyclesEnabled: true, activeExecutionCycleId: 'one', executionCycles: [cycle], issues: [] };
  const cases = ['a', 'b', 'c', 'd', 'e'].map((qaId) => ({ qaId }));
  cycle.results.c = { status: 'in-progress' };
  cycle.results.d = { status: 'failed' };
  project.issues = [
    { severity: 'Critical', status: 'Open' },
    { severity: 'High', status: 'Ready for Retest' },
    { severity: 'Critical', status: 'Closed' },
    { severity: 'Medium', status: 'Open' },
  ];
  const { getQaCycleReadiness, renderQaCycleInsights, container } = setup(project);
  const result = getQaCycleReadiness(project, cycle, cases);
  assert.equal(result.ready, false);
  assert.equal(result.counts.blocked, 1);
  assert.equal(result.counts['not-executed'], 1);
  assert.equal(result.counts['in-progress'], 1);
  assert.equal(result.counts.failed, 1);
  assert.equal(result.critical, 1);
  assert.equal(result.high, 1);
  renderQaCycleInsights(project, cases);
  assert.equal(container.hidden, false);
  assert.match(container.innerHTML, /Requiere atención/);
  assert.match(container.innerHTML, /Los issues se consideran a nivel de proyecto/);
  assert.match(container.innerHTML, /PDF conserva su criterio de salida independiente/);

  cycle.results.c.status = 'pass';
  cycle.results.d.status = 'pass';
  cycle.results.e = { status: 'pass' };
  project.issues[0].status = 'Closed';
  project.issues[1].status = 'Closed';
  assert.equal(getQaCycleReadiness(project, cycle, cases).ready, true);
  renderQaCycleInsights(project, cases);
  assert.match(container.innerHTML, /Listo para cierre/);
});

test('empty scope and missing retest references never show ready', () => {
  const cycle = { id: 'retry', retryCaseIds: ['missing'], retryFromCycleId: 'unknown', results: {} };
  const project = { qaCyclesEnabled: true, activeExecutionCycleId: 'retry', executionCycles: [cycle], issues: [] };
  const { getQaCycleReadiness, renderQaCycleInsights, container } = setup(project);
  const result = getQaCycleReadiness(project, cycle, []);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((reason) => reason.includes('no tiene casos')));
  assert.ok(result.reasons.some((reason) => reason.includes('no disponibles')));
  assert.ok(result.reasons.some((reason) => reason.includes('origen')));
  renderQaCycleInsights(project, []);
  assert.match(container.innerHTML, /ya no están disponibles/);
  assert.match(container.innerHTML, /ciclo de origen no está disponible/);
});

test('retest summarizes original selection plus source failures, excluding unrelated new cases', () => {
  const source = { id: 'source', name: '<Origen>', results: { a: { status: 'pass' }, b: { status: 'failed' }, c: { status: 'failed' }, d: { status: 'failed' }, e: { status: 'failed' } } };
  const retry = {
    id: 'retry', name: '<Reejecución>', retryFromCycleId: 'source', retryCaseIds: ['a', 'b', 'c', 'd'],
    knownCaseIds: ['a', 'b', 'c', 'd', 'e'],
    results: { a: { status: 'pass' }, b: { status: 'failed' }, c: { status: 'in-progress' }, d: { status: 'blocked' } },
  };
  const project = { qaCyclesEnabled: true, activeExecutionCycleId: 'retry', executionCycles: [source, retry], issues: [] };
  const cases = ['a', 'b', 'c', 'd', 'e', 'new'].map((qaId) => ({ qaId }));
  const { getQaRetestSummary, getQaCycleReadiness, renderQaCycleInsights, container } = setup(project);
  const result = getQaRetestSummary(project, retry, cases);
  assert.equal(result.total, 5);
  assert.equal(result.counts.pass, 1);
  assert.equal(result.counts.failed, 1);
  assert.equal(result.counts['in-progress'], 1);
  assert.equal(result.counts['not-executed'], 1);
  assert.equal(result.counts.blocked, 1);
  assert.equal(getQaCycleReadiness(project, retry, cases).cycleCases.length, 6);
  renderQaCycleInsights(project, cases);
  assert.match(container.innerHTML, /&lt;Origen&gt;/);
  assert.match(container.innerHTML, /&lt;Reejecución&gt;/);
  assert.match(container.innerHTML, /Corregidos \(Pass\): <strong>1<\/strong>/);
  assert.match(container.innerHTML, /No incluye casos nuevos/);
});

test('insights hide when cycles are disabled and show no retest card for first cycle', () => {
  const cycle = { id: 'one', results: {} };
  const project = { qaCyclesEnabled: true, activeExecutionCycleId: 'one', executionCycles: [cycle], issues: [] };
  const { renderQaCycleInsights, container } = setup(project);
  renderQaCycleInsights(project, []);
  assert.match(container.innerHTML, /Recomendación de cierre/);
  assert.doesNotMatch(container.innerHTML, /Resumen de reejecución/);
  project.qaCyclesEnabled = false;
  renderQaCycleInsights(project, []);
  assert.equal(container.hidden, true);
  assert.equal(container.innerHTML, '');
});

test('interactive lists match the corresponding counts and update as cases change', () => {
  const source = { id: 'source', results: { b: { status: 'failed' } } };
  const retry = { id: 'retry', retryFromCycleId: 'source', retryCaseIds: ['a'], knownCaseIds: ['a', 'b'], results: {
    a: { status: 'failed' }, b: { status: 'pass' }, new: { status: 'failed' },
  } };
  const project = { qaCyclesEnabled: true, activeExecutionCycleId: 'retry', executionCycles: [source, retry], issues: [] };
  const cases = ['a', 'b', 'new'].map((qaId) => ({ qaId }));
  const { getQaInsightCases, getQaRetestSummary, getQaCycleReadiness, renderQaCycleInsights, container } = setup(project);
  for (const status of ['pass', 'failed', 'not-executed', 'in-progress', 'blocked']) {
    assert.equal(getQaInsightCases(project, retry, cases, 'retry', status).length, getQaRetestSummary(project, retry, cases).counts[status]);
    assert.equal(getQaInsightCases(project, retry, cases, 'cycle', status).length, getQaCycleReadiness(project, retry, cases).counts[status]);
  }
  assert.deepEqual(Array.from(getQaInsightCases(project, retry, cases, 'retry', 'failed'), (item) => item.qaId), ['a']);
  assert.deepEqual(Array.from(getQaInsightCases(project, retry, cases, 'cycle', 'failed'), (item) => item.qaId), ['a', 'new']);
  renderQaCycleInsights(project, cases);
  assert.match(container.innerHTML, /data-insight-kind="retry" data-insight-filter="blocked" disabled/);
  assert.match(container.innerHTML, /data-insight-kind="cycle" data-insight-filter="failed"/);
  retry.results.a.status = 'pass';
  assert.equal(getQaInsightCases(project, retry, cases, 'retry', 'failed').length, 0);
});

test('issue filters include every non-closed status and only the selected severity', () => {
  const start = html.indexOf('  function getFilteredDashboardIssues(project) {');
  const end = html.indexOf('  const dashboardIssueSelection', start);
  assert.ok(start >= 0 && end > start);
  const filters = { query: '', status: 'not-closed', severity: 'Critical', suiteId: 'all' };
  const getFilteredDashboardIssues = vm.runInNewContext(
    `(function () { ${html.slice(start, end)} return getFilteredDashboardIssues; })()`,
    { dashboardIssueFilters: filters, getDashboardIssueCase: () => null },
  );
  const issues = ['Open', 'Ready for Retest', 'In progress', 'Re-Open', 'Closed'].map((status) => ({ status, severity: 'Critical' }));
  issues.push({ status: 'Open', severity: 'High' });
  assert.deepEqual(Array.from(getFilteredDashboardIssues({ issues }), (issue) => issue.status), ['Open', 'Ready for Retest', 'In progress', 'Re-Open']);
  filters.severity = 'High';
  assert.equal(getFilteredDashboardIssues({ issues }).length, 1);
  filters.status = 'all';
  filters.severity = 'all';
  assert.equal(getFilteredDashboardIssues({ issues }).length, 6);
});
