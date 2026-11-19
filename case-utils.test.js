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
  getGroupedStepLabel,
  buildAutoIssueSnapshots,
  nextIssueDisplayId,
  migrateProjectIssueIds,
  getClipboardFallbackMessage,
  dualCaseRecord,
  buildCaseRecordTitle,
  parseDashboardIssueImportRows,
  parseDashboardIssueImportText,
  parseQaCaseImportRows,
  parseQaCaseIdAndDescription,
  buildIssueLogEntries,
  buildAutoIssueSnapshot,
  previewSuiteIssueDisplayId,
  nextSuiteIssueDisplayId,
} = require('./case-utils.js');

test('parseDashboardIssueImportRows maps the exported issue columns', () => {
  const parsed = parseDashboardIssueImportRows(
    ['Test ID', 'ID issue', 'Título del hallazgo', 'Caso de prueba', 'Módulo', 'Descripción del hallazgo', 'Resultado QA', 'Severidad', 'Prioridad', 'Estado', 'Asignado a'],
    [['TC-101', 'ISS-001', 'Error al guardar', 'Guardar formulario', 'Pagos', 'El sistema presenta un error.', 'Failed', 'High', 'Critical', 'Open', 'Ana']],
  );
  assert.deepEqual(parsed, {
    rows: [{
      testId: 'TC-101',
      displayId: 'ISS-001',
      findingTitle: 'Error al guardar',
      formName: 'Guardar formulario',
      module: 'Pagos',
      observation: 'El sistema presenta un error.',
      qaResult: 'Failed',
      severity: 'High',
      priority: 'Critical',
      status: 'Open',
      assignee: 'Ana',
      createdAt: '',
      closedAt: '',
      lastValidationAt: '',
      comments: '',
    }],
    errors: [],
  });
});

test('parseDashboardIssueImportRows reports missing columns and invalid rows', () => {
  const missing = parseDashboardIssueImportRows(['Test ID'], []);
  assert.match(missing.errors[0], /Faltan columnas obligatorias/);

  const parsed = parseDashboardIssueImportRows(
    ['Test ID', 'Título del hallazgo', 'Caso de prueba', 'Módulo', 'Descripción del hallazgo', 'Estado'],
    [['TC-1', 'Hallazgo', 'Caso', 'Pagos', 'Detalle', 'Unknown']],
  );
  assert.equal(parsed.rows.length, 0);
  assert.match(parsed.errors[0], /Fila 2:.*no es válido/);
});

test('parseDashboardIssueImportText parses headerless tab-separated issue data', () => {
  const parsed = parseDashboardIssueImportText(
    'TC-101\tError al guardar\tGuardar formulario\tPagos\tEl sistema presenta un error.\nTC-102\tBotón no responde\tEnviar formulario\tPagos\tNo se ejecuta la acción.',
  );
  assert.deepEqual(parsed, {
    rows: [
      {
        testId: 'TC-101',
        displayId: '',
        findingTitle: 'Error al guardar',
        formName: 'Guardar formulario',
        module: 'Pagos',
        observation: 'El sistema presenta un error.',
        qaResult: '',
        severity: 'Medium',
        priority: 'Medium',
        status: 'Open',
        assignee: '',
        createdAt: '',
        closedAt: '',
        lastValidationAt: '',
        comments: '',
      },
      {
        testId: 'TC-102',
        displayId: '',
        findingTitle: 'Botón no responde',
        formName: 'Enviar formulario',
        module: 'Pagos',
        observation: 'No se ejecuta la acción.',
        qaResult: '',
        severity: 'Medium',
        priority: 'Medium',
        status: 'Open',
        assignee: '',
        createdAt: '',
        closedAt: '',
        lastValidationAt: '',
        comments: '',
      },
    ],
    errors: [],
  });
});

test('parseDashboardIssueImportText accepts export headers and reports invalid headerless rows', () => {
  const withHeader = parseDashboardIssueImportText(
    'Test ID\tID issue\tTítulo del hallazgo\tCaso de prueba\tMódulo\tDescripción del hallazgo\nTC-1\t\tFalla\tLogin\tAutenticación\tDetalle',
  );
  assert.equal(withHeader.rows[0].findingTitle, 'Falla');
  assert.deepEqual(withHeader.errors, []);

  const invalid = parseDashboardIssueImportText('TC-1\tFalla\tLogin\tAutenticación');
  assert.equal(invalid.rows.length, 0);
  assert.match(invalid.errors[0], /Línea 1: se esperaban 5 columnas/);

  const mixed = parseDashboardIssueImportText('TC-1\tFalla\tLogin\tAutenticación\nTC-2\t\tLogin\tAutenticación\tDetalle');
  assert.match(mixed.errors[0], /Línea 1: se esperaban 5 columnas/);
  assert.match(mixed.errors[1], /Línea 2: faltan Título del hallazgo/);
});

test('issue identifiers migrate existing issues once and remain sequential per project', () => {
  const project = {
    issues: [
      { id: 'old-1', source: 'auto', testId: 'TC-1-N1', baseTestId: 'TC-1', noveltyNo: 1, status: 'Closed' },
      { id: 'old-2', source: 'auto', testId: 'TC-1-N2', baseTestId: 'TC-1', noveltyNo: 2, observation: 'Detalle' },
      { id: 'old-3', source: 'manual', testId: 'TC-3-N1' },
    ],
  };
  assert.equal(migrateProjectIssueIds(project), true);
  assert.deepEqual(project.issues.map(({ testId, displayId }) => [testId, displayId]), [
    ['TC-1', 'ISSUE-001'], ['TC-1', 'ISSUE-002'], ['TC-3-N1', 'ISSUE-003'],
  ]);
  assert.equal(project.issues[0].status, 'Closed');
  assert.equal(project.issues[1].observation, 'Detalle');
  assert.equal(migrateProjectIssueIds(project), false);
  project.issues.pop();
  assert.equal(nextIssueDisplayId(project), 'ISSUE-004');
  assert.equal(nextIssueDisplayId({ issues: [] }), 'ISSUE-001');
});

test('issue migration reserves existing identifiers and preserves case IDs ending in novelty-like suffixes', () => {
  const project = {
    issues: [
      { source: 'auto', testId: 'TC-N1-N1', baseTestId: 'TC-N1', noveltyNo: 1 },
      { source: 'manual', displayId: 'ISSUE-009', testId: 'TC-2' },
      { source: 'auto', testId: 'TC-3-N2', baseTestId: 'TC-3', noveltyNo: 2 },
    ],
  };
  assert.equal(migrateProjectIssueIds(project), true);
  assert.deepEqual(project.issues.map((issue) => issue.displayId), ['ISSUE-010', 'ISSUE-009', 'ISSUE-011']);
  assert.equal(project.issues[0].testId, 'TC-N1');
  assert.equal(migrateProjectIssueIds(project), false);
  assert.equal(project.issues[0].testId, 'TC-N1');
});

test('manual issue IDs use stable suite prefixes and never reuse a deleted sequence number', () => {
  const project = { issues: [] };
  assert.equal(previewSuiteIssueDisplayId(project, 'suite-pagos', 'Pagos'), 'PAG-001');
  assert.equal(project.issueSuiteCodes, undefined);
  assert.equal(nextSuiteIssueDisplayId(project, 'suite-pagos', 'Pagos'), 'PAG-001');
  project.issues.push({ suiteId: 'suite-pagos', displayId: 'PAG-001' });
  assert.equal(nextSuiteIssueDisplayId(project, 'suite-pagos', 'Pagos renombrados'), 'PAG-002');
  project.issues = [];
  assert.equal(nextSuiteIssueDisplayId(project, 'suite-pagos', 'Pagos renombrados'), 'PAG-003');
  assert.equal(nextIssueDisplayId(project), 'ISSUE-001');
});

test('manual issue suite prefixes avoid collisions with existing suites and issue IDs', () => {
  const project = {
    issues: [{ suiteId: 'legacy-suite', displayId: 'PAG-001' }],
  };
  assert.equal(previewSuiteIssueDisplayId(project, 'suite-pagos', 'Pagos'), 'PAGO-001');
  assert.equal(nextSuiteIssueDisplayId(project, 'suite-pagos', 'Pagos'), 'PAGO-001');
  assert.equal(previewSuiteIssueDisplayId(project, 'suite-pago-web', 'Pagos Web'), 'PAGOS-001');
});

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

test('buildAutoIssueSnapshot splits an ID with a combined description', () => {
  const snapshot = buildAutoIssueSnapshot({
    caseId: 'TC-01 - Ingresar un usuario inválido',
    description: '',
    steps: [{ stepStatus: 'fallo', comment: 'x' }],
  });
  assert.equal(snapshot.testId, 'TC-01');
  assert.equal(snapshot.formName, 'Ingresar un usuario inválido');
  const legacy = buildAutoIssueSnapshot({ caseId: 'TC-01', description: '- Ingresar', steps: [{ stepStatus: 'fallo' }] });
  assert.equal(legacy.formName, 'Ingresar');
});

test('parseQaCaseIdAndDescription separates the first token from the remaining description', () => {
  assert.deepEqual(parseQaCaseIdAndDescription('  TC-1   Login incorrecto  '), {
    caseId: 'TC-1',
    description: 'Login incorrecto',
    error: '',
  });
  assert.deepEqual(parseQaCaseIdAndDescription('TC-01 - Ingresar un usuario inválido'), {
    caseId: 'TC-01',
    description: 'Ingresar un usuario inválido',
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

test('buildAutoIssueSnapshot groups failed steps into one issue and derives severity', () => {
  const issue = buildAutoIssueSnapshot({
    caseId: 'TC-12',
    description: 'Guardar comprobante',
    steps: [
      { id: 'step-1', stepStatus: 'fallo', severity: 'media', comment: 'No guarda el archivo.' },
      { id: 'step-2', stepStatus: 'fallo', severity: 'alta', comment: 'Se pierde la sesión.' },
      { id: 'step-3', stepStatus: 'aprobado', comment: 'Paso correcto.' },
      { id: 'step-4', stepStatus: 'aprobado', severity: 'baja', comment: 'El texto está desalineado.' },
    ],
  });

  assert.equal(issue.testId, 'TC-12');
  assert.equal(issue.formName, 'Guardar comprobante');
  assert.match(issue.observation, /Paso 1 \(Fallido · Severidad Media\): No guarda el archivo\./);
  assert.match(issue.observation, /Paso 2 \(Fallido · Severidad Alta\): Se pierde la sesión\./);
  assert.match(issue.observation, /Paso 4 \(Aprobado · Severidad Baja\): El texto está desalineado\./);
  assert.deepEqual(issue.evidenceStepIds, ['step-1', 'step-2', 'step-4']);
  assert.equal(issue.qaResult, 'Failed');
  assert.equal(issue.severity, 'High');
  assert.equal(issue.priority, 'High');
});

test('buildAutoIssueSnapshot creates a novelty issue from a severity-tagged documenter step', () => {
  const issue = buildAutoIssueSnapshot({
    caseId: 'TC-15',
    description: 'Validar alineación',
    steps: [
      { id: 'step-1', stepStatus: 'aprobado', severity: 'media', comment: 'El texto queda desalineado.' },
    ],
  });

  assert.equal(issue.qaResult, 'Novedad');
  assert.equal(issue.observation, 'Paso 1 (Aprobado · Severidad Media): El texto queda desalineado.');
  assert.deepEqual(issue.evidenceStepIds, ['step-1']);
  assert.equal(issue.severity, 'Medium');
});

test('buildAutoIssueSnapshot omits the empty-observation fallback when the step has an image', () => {
  const issue = buildAutoIssueSnapshot({
    caseId: 'TC-16',
    steps: [{ id: 'step-1', stepStatus: 'pendiente', severity: 'alta', dataUrl: 'data:image/png;base64,abc' }],
  });

  assert.doesNotMatch(issue.observation, /Novedad sin observación registrada/);
  assert.match(issue.observation, /Paso 1 \(Pendiente · Severidad Alta\)$/);
});

test('buildAutoIssueSnapshot supports a failed execution without failed steps', () => {
  const issue = buildAutoIssueSnapshot({
    caseId: 'TC-13',
    description: 'Proceso manual',
    steps: [],
  }, true, 'La validación del servicio falló.');

  assert.equal(issue.observation, 'La validación del servicio falló.');
  assert.deepEqual(issue.evidenceStepIds, []);
});

test('buildAutoIssueSnapshot skips cases without failures', () => {
  assert.equal(buildAutoIssueSnapshot({
    caseId: 'TC-14',
    steps: [{ stepStatus: 'aprobado' }],
  }), null);
});

test('getGroupedStepLabel numbers grouped images and auto issue uses it', () => {
  const steps = [{}, {}, { sameAsPrevious: true }, { sameAsPrevious: true, stepStatus: 'fallo', comment: 'x' }];
  assert.deepEqual(steps.map((_, i) => getGroupedStepLabel(steps, i)), ['1', '2.1', '2.2', '2.3']);
  assert.match(buildAutoIssueSnapshot({ caseId: 'TC-1', steps }).observations || buildAutoIssueSnapshot({ caseId: 'TC-1', steps }).observation, /Paso 2\.3/);
});

test('buildAutoIssueSnapshots creates one snapshot per novelty and groups images', () => {
  const snaps = buildAutoIssueSnapshots({
    caseId: 'TC-9 Pago',
    steps: [
      { id: 1, stepStatus: 'fallo', comment: 'a' },
      { id: 2, sameAsPrevious: true },
      { id: 3, stepStatus: 'aprobado' },
      { id: 4, severity: 'baja' },
    ],
  });
  assert.equal(snaps.length, 2);
  assert.deepEqual(snaps.map((s) => s.stepKey), ['1', '4']);
  assert.deepEqual(snaps[0].evidenceStepIds, ['1', '2']);
  assert.equal(snaps[0].baseTestId, 'TC-9');
  assert.equal(snaps[1].severity, 'Low');
});

test('buildAutoIssueSnapshots omits the fallback for novelties with grouped image evidence', () => {
  const [snapshot] = buildAutoIssueSnapshots({
    caseId: 'TC-10',
    steps: [
      { id: 1, stepStatus: 'pendiente', severity: 'alta' },
      { id: 2, sameAsPrevious: true, thumbnailDataUrl: 'data:image/png;base64,def' },
    ],
  });

  assert.doesNotMatch(snapshot.observation, /Novedad sin observación registrada/);
  assert.deepEqual(snapshot.evidenceStepIds, ['1', '2']);
});

test('buildAutoIssueSnapshots falls back to a case-level snapshot only when failed', () => {
  assert.deepEqual(buildAutoIssueSnapshots({ caseId: 'TC-1', steps: [] }), []);
  const [snap] = buildAutoIssueSnapshots({ caseId: 'TC-1', steps: [] }, true, 'nota');
  assert.equal(snap.stepKey, 'case');
  assert.equal(snap.observation, 'nota');
});