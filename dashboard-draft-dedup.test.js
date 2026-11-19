const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  function getDashboardCasesWithDraft(projectCases) {');
const end = html.indexOf('  function getFilteredDashboardIssues(', start);
assert.ok(start !== -1 && end !== -1, 'dashboard draft merge helper must exist');
const helperSource = html.slice(start, end);

function getCasesWithDraft({ savedCases = [], draftCase, editingCaseIndex = null } = {}) {
  const project = { id: 'project-1' };
  const steps = draftCase.steps || [];
  const context = {
    activeProjectId: project.id,
    editingCaseIndex,
    savedCases,
    projects: [project],
    steps,
    document: {
      getElementById: (id) => ({
        value: id === 'caseId' ? draftCase.caseId || '' : draftCase.description || '',
      }),
    },
    getSelectedProjectId: () => project.id,
    currentCaseData: () => draftCase,
  };
  const getCases = vm.runInNewContext(
    `(function () { ${helperSource}; return getDashboardCasesWithDraft; })()`,
    context
  );
  return getCases(savedCases);
}

test('open recovered draft updates a saved novelty case with overlapping step IDs instead of duplicating it', () => {
  const saved = {
    qaId: 'case-1',
    projectId: 'project-1',
    caseId: 'TC-1',
    description: 'Login',
    steps: [{ id: 'step-1', comment: 'Anterior' }, { id: 'step-2' }],
  };
  const result = getCasesWithDraft({
    savedCases: [saved],
    draftCase: {
      projectId: 'project-1',
      caseId: 'TC-1',
      description: 'Login',
      steps: [{ id: 'step-1', comment: 'Actualizado' }, { id: 'step-2' }],
    },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].qaId, 'case-1');
  assert.equal(result[0].steps[0].comment, 'Actualizado');
});

test('a different draft remains visible as a separate case', () => {
  const saved = {
    qaId: 'case-1',
    projectId: 'project-1',
    caseId: 'TC-1',
    steps: [{ id: 'step-1' }],
  };
  const result = getCasesWithDraft({
    savedCases: [saved],
    draftCase: {
      projectId: 'project-1',
      caseId: 'TC-2',
      steps: [{ id: 'step-2' }],
    },
  });

  assert.equal(result.length, 2);
  assert.equal(result[1].caseId, 'TC-2');
});
