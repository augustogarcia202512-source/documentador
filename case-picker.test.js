const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  function renderDocumenterCasePicker(selectedValue) {');
const end = html.indexOf('  function renderDashboardProjects()', start);
assert.ok(start !== -1 && end !== -1, 'documenter case picker renderer must exist');
const renderPicker = html.slice(start, end);

class MockOption {
  constructor(text, value) {
    this.textContent = text;
    this.value = value;
  }
}

class MockOptionGroup {
  constructor() {
    this.children = [];
  }

  append(option) {
    this.children.push(option);
  }
}

class MockSelect {
  constructor() {
    this.children = [];
    this.value = '';
  }

  get options() {
    return this.children.flatMap((child) => child.children || [child]);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  append(child) {
    this.children.push(child);
  }
}

function createPicker({ selectedValue = '', cases = [], suites = [] } = {}) {
  const selector = new MockSelect();
  const context = {
    MANUAL_CASE_PICKER_VALUE: '__manual__',
    activeProjectId: 'project-1',
    projects: [{ id: 'project-1', suites }],
    savedCases: cases,
    document: {
      getElementById: () => selector,
      createElement: () => new MockOptionGroup(),
    },
    Option: MockOption,
  };
  vm.runInNewContext(`${renderPicker}; renderDocumenterCasePicker(${JSON.stringify(selectedValue)});`, context);
  return selector;
}

test('documenter case picker keeps the manual unforeseen-case option available and selected', () => {
  const picker = createPicker({
    selectedValue: '__manual__',
    cases: [{ projectId: 'project-1', suiteId: 'suite-1', caseId: 'TC-1', description: 'Login' }],
    suites: [{ id: 'suite-1', name: 'Suite 1' }],
  });

  assert.equal(picker.value, '__manual__');
  assert.ok(picker.options.some((option) =>
    option.value === '__manual__' && option.textContent === '➕ Caso manual imprevisto'
  ));
  assert.ok(picker.options.some((option) => option.value === 'case:0'));
});
