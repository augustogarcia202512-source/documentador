const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const getAssigneesStart = html.indexOf('  function getDashboardProjectAssignees(project) {');
const getAssigneesEnd = html.indexOf('  function renderDashboardProjectAssignees(project) {', getAssigneesStart);
const renderOptionsStart = html.indexOf('  function populateProjectPersonSelect(select, project, selectedName, emptyLabel) {');
const renderOptionsEnd = html.indexOf('  function openDashboardProjectAssignees(opener) {', renderOptionsStart);
assert.ok(getAssigneesStart !== -1 && getAssigneesEnd !== -1, 'project assignee helper must exist');
assert.ok(renderOptionsStart !== -1 && renderOptionsEnd !== -1, 'project person dropdown renderers must exist');

const functions = [
  html.slice(getAssigneesStart, getAssigneesEnd),
  html.slice(renderOptionsStart, renderOptionsEnd),
].join('\n');

function createSelect() {
  return {
    children: [],
    value: '',
    replaceChildren(...children) {
      this.children = children;
    },
  };
}

function createAssigneeHelpers() {
  const assigneeSelect = createSelect();
  const testerSelect = createSelect();
  class Option {
    constructor(label, value) {
      this.label = label;
      this.value = value;
    }
  }
  const context = {
    document: {
      getElementById: (id) => ({
        dashboardIssueAssignee: assigneeSelect,
        tester: testerSelect,
      })[id] || null,
    },
    Option,
  };
  const helpers = vm.runInNewContext(`(function () { ${functions}; return { getDashboardProjectAssignees, renderDashboardAssigneeOptions, renderDocumenterTesterOptions }; })()`, context);
  return { ...helpers, assigneeSelect, testerSelect };
}

test('project assignee catalog trims names and ignores invalid entries', () => {
  const { getDashboardProjectAssignees } = createAssigneeHelpers();
  assert.deepEqual(
    Array.from(getDashboardProjectAssignees({ issueAssignees: [' Ana ', '', null, ' Luis '] })),
    ['Ana', 'Luis'],
  );
  assert.deepEqual(Array.from(getDashboardProjectAssignees({ issueAssignees: 'Ana' })), []);
});

test('assignee dropdown lists Sin asignar and the project names', () => {
  const { renderDashboardAssigneeOptions, assigneeSelect } = createAssigneeHelpers();
  renderDashboardAssigneeOptions({ issueAssignees: ['Ana', 'Luis'] });
  assert.deepEqual(
    assigneeSelect.children.map(({ label, value }) => [label, value]),
    [['Sin asignar', ''], ['Ana', 'Ana'], ['Luis', 'Luis']],
  );
});

test('assignee dropdown preserves a historical assignment absent from the catalog', () => {
  const { renderDashboardAssigneeOptions, assigneeSelect } = createAssigneeHelpers();
  renderDashboardAssigneeOptions({ issueAssignees: ['Ana'] }, 'Luis');
  assert.deepEqual(
    assigneeSelect.children.map(({ label, value }) => [label, value]),
    [['Sin asignar', ''], ['Ana', 'Ana'], ['Luis (actual)', 'Luis']],
  );
  assert.equal(assigneeSelect.value, 'Luis');
});

test('Documentado por dropdown lists project people and preserves previous values', () => {
  const { renderDocumenterTesterOptions, testerSelect } = createAssigneeHelpers();
  const project = { issueAssignees: ['Ana', 'Luis'] };
  renderDocumenterTesterOptions(project);
  assert.deepEqual(
    testerSelect.children.map(({ label, value }) => [label, value]),
    [['Selecciona una persona...', ''], ['Ana', 'Ana'], ['Luis', 'Luis']],
  );
  renderDocumenterTesterOptions(project, 'Marta');
  assert.deepEqual(
    testerSelect.children.map(({ label, value }) => [label, value]),
    [['Selecciona una persona...', ''], ['Ana', 'Ana'], ['Luis', 'Luis'], ['Marta (actual)', 'Marta']],
  );
  assert.equal(testerSelect.value, 'Marta');
});
