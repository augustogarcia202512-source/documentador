const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  function openDashboardIssueFullText(');
const end = html.indexOf('  function bindDashboardIssueLogControls()', start);
assert.ok(start !== -1 && end !== -1, 'issue full-text dialog handler must exist');
const fullTextHandler = html.slice(start, end);

function createDialog() {
  const elements = Object.fromEntries([
    'dashboardIssueFullTextOverlay',
    'dashboardIssueFullTextTitle',
    'dashboardIssueFullTextMeta',
    'dashboardIssueFullTextContent',
    'dashboardIssueFullTextCloseBtn',
  ].map((id) => [id, { textContent: '', style: {}, focus() {} }]));
  let opened;
  const context = {
    projects: [{
      id: 'project-1',
      issues: [{
        id: 'issue-1',
        testId: 'TC-1',
        displayId: 'ISSUE-001',
        findingTitle: 'Título completo del hallazgo',
        observation: 'Descripción completa\ncon saltos de línea',
      }],
    }],
    activeProjectId: 'project-1',
    document: { getElementById: (id) => elements[id] },
    cleanDashboardIssueObservation: (value) => String(value || ''),
    openOverlay: (overlay, options) => { opened = { overlay, options }; },
  };
  const open = vm.runInNewContext(`(function () { ${fullTextHandler}; return openDashboardIssueFullText; })()`, context);
  return { elements, open, getOpened: () => opened };
}

test('issue title and description full-text actions open an accessible dialog with the selected content', () => {
  const dialog = createDialog();
  const opener = { focus() {} };

  dialog.open('issue-1', 'title', opener);
  assert.equal(dialog.elements.dashboardIssueFullTextTitle.textContent, 'Título del hallazgo');
  assert.equal(dialog.elements.dashboardIssueFullTextContent.textContent, 'Título completo del hallazgo');
  assert.equal(dialog.elements.dashboardIssueFullTextMeta.textContent, 'TC-1 · ISSUE-001');
  assert.equal(dialog.getOpened().options.opener, opener);

  dialog.open('issue-1', 'description', opener);
  assert.equal(dialog.elements.dashboardIssueFullTextTitle.textContent, 'Descripción del hallazgo');
  assert.equal(dialog.elements.dashboardIssueFullTextContent.textContent, 'Descripción completa\ncon saltos de línea');
});

test('long issue title and description cells provide their respective full-text actions', () => {
  assert.match(html, /data-issue-full-text-type="title">Ver título completo/);
  assert.match(html, /data-issue-full-text-type="description">Ver descripción completa/);
});
