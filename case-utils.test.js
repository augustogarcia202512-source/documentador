const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeStepStatus,
  buildCaseSummary,
  buildDocumentNotesLines,
  CASE_TEMPLATES,
  getCaseTemplate,
  buildExecutiveSummary,
  getClipboardFallbackMessage,
} = require('./case-utils.js');

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

test('getCaseTemplate returns a known template and default fallback', () => {
  assert.equal(getCaseTemplate('funcional').label, 'Caso funcional');
  assert.equal(getCaseTemplate('inexistente').key, 'general');
  assert.equal(CASE_TEMPLATES.general.key, 'general');
});

test('buildExecutiveSummary generates a concise summary from template and steps', () => {
  const summary = buildExecutiveSummary({
    templateKey: 'funcional',
    description: 'Validar login con credenciales válidas',
    steps: [
      { severity: 'alta', comment: 'El usuario no puede ingresar', stepStatus: 'fallo' },
      { severity: 'baja', comment: 'La pantalla está bien alineada', stepStatus: 'aprobado' },
    ],
  });

  assert.match(summary.text, /Validar login con credenciales válidas/);
  assert.match(summary.text, /Novedad principal/);
  assert.match(summary.text, /Impacto/);
  assert.equal(summary.template.key, 'funcional');
  assert.equal(summary.totalSteps, 2);
  assert.equal(summary.novedadCount, 2);
});

test('getClipboardFallbackMessage offers a helpful browser fallback without false errors', () => {
  assert.match(getClipboardFallbackMessage('Paso 1'), /Este navegador no permite copiar imágenes/i);
  assert.match(getClipboardFallbackMessage('Paso 1'), /abrirla/i);
  assert.match(getClipboardFallbackMessage(), /imágenes|imagen/i);
});
