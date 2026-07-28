const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStepStatus, buildCaseSummary, buildDocumentNotesLines } = require('./case-utils.js');

test('normalizeStepStatus returns a valid fallback', () => {
  assert.equal(normalizeStepStatus('aprobado'), 'aprobado');
  assert.equal(normalizeStepStatus('desconocido'), 'pendiente');
  assert.equal(normalizeStepStatus(undefined), 'pendiente');
});

test('buildCaseSummary counts statuses and novedad', () => {
  const summary = buildCaseSummary([
    { comment: 'Primero', severity: 'alta', stepStatus: 'fallo' },
    { comment: 'Segundo', severity: null, stepStatus: 'aprobado' },
    { comment: 'Tercero', stepStatus: 'observado' },
  ]);

  assert.equal(summary.totalSteps, 3);
  assert.equal(summary.novedadCount, 1);
  assert.equal(summary.statusCounts.aprobado, 1);
  assert.equal(summary.statusCounts.fallo, 1);
  assert.equal(summary.statusCounts.observado, 1);
  assert.equal(summary.stepSummaries[0].statusLabel, '❌ Falló');
  assert.equal(summary.stepSummaries[1].severityLabel, 'Sin novedad');
});

test('buildDocumentNotesLines trims and splits pending notes', () => {
  assert.deepEqual(buildDocumentNotesLines('Primera nota\n\nSegunda nota'), ['Primera nota', 'Segunda nota']);
  assert.deepEqual(buildDocumentNotesLines('   '), []);
});
