const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeStepStatus,
  getLegacyCaseExecutionStatus,
  buildCaseSummary,
  buildDocumentNotesLines,
  extractCaseFieldsFromPreviewText,
  CASE_TEMPLATES,
  getCaseTemplate,
  buildExecutiveSummary,
  getClipboardFallbackMessage,
  dualCaseRecord,
  buildCaseRecordTitle,
  parseQaCaseImportRows,
  parseQaCaseIdAndDescription,
  buildIssueLogEntries,
} = require('./case-utils.js');

test('normalizeStepStatus returns a valid fallback', () => {
  assert.equal(normalizeStepStatus('aprobado'), 'aprobado');
  assert.equal(normalizeStepStatus('desconocido'), 'pendiente');
  assert.equal(normalizeStepStatus(undefined), 'pendiente');
});

test('getLegacyCaseExecutionStatus derives failed steps when the case only has its default status', () => {
  assert.equal(getLegacyCaseExecutionStatus({
    executionStatus: 'not-executed',
    executionHistory: [],
    steps: [{ stepStatus: 'fallo' }],
  }), 'failed');
  assert.equal(getLegacyCaseExecutionStatus({
    executionStatus: 'not-executed',
    executionHistory: [],
    steps: [{ stepStatus: 'aprobado' }, { stepStatus: 'pendiente' }],
  }), 'in-progress');
});

test('getLegacyCaseExecutionStatus preserves explicitly recorded execution choices', () => {
  assert.equal(getLegacyCaseExecutionStatus({
    executionStatus: 'not-executed',
    executionHistory: [{ status: 'not-executed', at: 1 }],
    steps: [{ stepStatus: 'fallo' }],
  }), 'not-executed');
  assert.equal(getLegacyCaseExecutionStatus({
    executionStatus: 'pass',
    executionHistory: [{ status: 'pass', at: 1 }],
    steps: [{ stepStatus: 'fallo' }],
  }), 'pass');
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

test('extractCaseFieldsFromPreviewText captures the edited document data', () => {
  const previewText = [
    'Caso de Prueba: CASO-123',
    'Descripción: Se validó la corrección del flujo.',
    'Plantilla: Caso funcional',
    'Área / equipo: Soporte',
    'Requisito / historia: HU-10',
    'Ambiente: QA',
    'Versión: 1.2.3',
    'Precondiciones: Usuario autenticado',
    'Documentado por: Ana',
    'Resultado esperado: Login exitoso',
    'Resultado actual: Login bloqueado tras borrar el dato',
  ].join(' ');

  const parsed = extractCaseFieldsFromPreviewText(previewText);
  assert.equal(parsed.caseId, 'CASO-123');
  assert.equal(parsed.description, 'Se validó la corrección del flujo.');
  assert.equal(parsed.team, 'Soporte');
  assert.equal(parsed.requirement, 'HU-10');
  assert.equal(parsed.environment, 'QA');
  assert.equal(parsed.buildVersion, '1.2.3');
  assert.equal(parsed.preconditions, 'Usuario autenticado');
  assert.equal(parsed.tester, 'Ana');
  assert.equal(parsed.expectedResult, 'Login exitoso');
  assert.equal(parsed.actualResult, 'Login bloqueado tras borrar el dato');
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

test('dualCaseRecord duplicates the record without sharing mutable data', () => {
  const source = {
    caseId: 'CP-001',
    description: 'Validar login',
    steps: [{ comment: 'Primera evidencia', boxes: [{ x: 1 }] }],
    qaContext: { requirement: 'HU-1' },
  };

  const copy = dualCaseRecord(source, 'CP-001 copia');

  assert.notStrictEqual(copy, source);
  assert.deepEqual(copy.steps, source.steps);
  assert.notStrictEqual(copy.steps, source.steps);
  assert.equal(copy.caseId, 'CP-001 copia');
  assert.equal(copy.qaContext.requirement, 'HU-1');
  assert.notStrictEqual(copy.qaContext, source.qaContext);
});

test('buildCaseRecordTitle keeps the label readable with and without an ID', () => {
  assert.equal(buildCaseRecordTitle({ caseId: 'CP-001', description: 'Validar login' }), 'CP-001 · Validar login');
  assert.equal(buildCaseRecordTitle({ description: 'Validar login' }), 'Validar login');
  assert.equal(buildCaseRecordTitle({}), 'Caso sin ID');
});

test('parseQaCaseImportRows parses tab-separated Excel rows and an optional header', () => {
  const parsed = parseQaCaseImportRows('ID\tNombre\tSuite\nTC-101\tLogin válido\tLogin\nTC-102\tValidar pagos\tPagos');

  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rows, [
    { row: 2, caseId: 'TC-101', description: 'Login válido', suiteName: 'Login' },
    { row: 3, caseId: 'TC-102', description: 'Validar pagos', suiteName: 'Pagos' },
  ]);
});

test('parseQaCaseImportRows supports CSV quoted commas and reports invalid rows', () => {
  const parsed = parseQaCaseImportRows('TC-101,"Login, válido",Login\nTC-102,,Pagos\nTC-103,Otro,Pagos,Extra');

  assert.deepEqual(parsed.rows, [
    { row: 1, caseId: 'TC-101', description: 'Login, válido', suiteName: 'Login' },
  ]);
  assert.deepEqual(parsed.errors, [
    'Línea 2: el ID y el nombre del caso son obligatorios.',
    'Línea 3: se esperaban 2 o 3 columnas (ID, Nombre y Suite).',
  ]);
});

test('parseQaCaseIdAndDescription separates the first token from the remaining description', () => {
  assert.deepEqual(parseQaCaseIdAndDescription('  TC-1   Login incorrecto  '), {
    caseId: 'TC-1',
    description: 'Login incorrecto',
    error: '',
  });
  assert.deepEqual(parseQaCaseIdAndDescription('TC-1'), {
    caseId: '',
    description: '',
    error: 'Escribe el ID seguido de la descripción, por ejemplo: TC-1 Login incorrecto.',
  });
});

test('buildIssueLogEntries groups by case and keeps only failed or novel steps', () => {
  const cases = [
    {
      caseId: 'CP-001',
      steps: [
        { stepStatus: 'fallo', comment: 'Falló sin severidad.' },
        { stepStatus: 'aprobado', severity: 'media', comment: 'Novedad observada.' },
        { stepStatus: 'fallo', severity: 'alta', comment: 'Falló con severidad.' },
        { stepStatus: 'aprobado', comment: 'Sin incidencia.' },
      ],
    },
    {
      caseId: 'CP-002',
      steps: [{ stepStatus: 'aprobado', comment: 'Sin incidencia.' }],
    },
  ];

  const entries = buildIssueLogEntries(cases);

  assert.equal(entries.length, 1);
  assert.strictEqual(entries[0].caseRecord, cases[0]);
  assert.deepEqual(entries[0].steps.map(({ index }) => index), [0, 1, 2]);
});

test('buildIssueLogEntries recognizes legacy novelty flags without severity', () => {
  const caseRecord = {
    caseId: 'CP-LEGACY',
    steps: [
      { stepStatus: 'aprobado', novedad: true },
      { stepStatus: 'aprobado', novedad: false },
    ],
  };

  const entries = buildIssueLogEntries([caseRecord]);

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].steps.map(({ index }) => index), [0]);
});
