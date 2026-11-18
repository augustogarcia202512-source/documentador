const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const caseUtils = require('./case-utils.js');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  async function buildCaseBodyBlocks(');
const end = html.indexOf('  function normalizeCaseIdInputValue(', start);
assert.ok(start !== -1 && end !== -1, 'Word case builder must exist');

class DocumentNode {
  constructor(options) {
    this.options = options;
  }
}

const context = {
  docx: {
    Paragraph: DocumentNode, TextRun: DocumentNode, ImageRun: DocumentNode,
    Table: DocumentNode, TableRow: DocumentNode, TableCell: DocumentNode,
    WidthType: { DXA: 'dxa' }, AlignmentType: { CENTER: 'center' },
  },
  caseUtils,
  DEFAULT_TEMPLATE_KEY: 'general',
  SEVERITY_LABEL: { media: 'Media', alta: 'Alta', baja: 'Baja' },
  SEVERITY_DOCX_COLOR: {},
  buildCaseSummary: caseUtils.buildCaseSummary,
  buildDocumentNotesLines: caseUtils.buildDocumentNotesLines,
  getDocumentNotesValue: () => '',
  getStepStatusLabel: caseUtils.getStepStatusLabel,
  sortedNovedades: (steps) => steps,
  panamLabelRun: (text) => new DocumentNode({ text }),
  panamValueRun: (text) => new DocumentNode({ text }),
  buildWordEvidenceImage: async () => ({ data: new Uint8Array(), width: 10, height: 10 }),
  fitToPage: () => ({ width: 10, height: 10 }),
};
const buildCaseBodyBlocks = vm.runInNewContext(`(${html.slice(start, end).trim()})`, context);

function texts(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node.text === 'string') return [node.text];
  return Object.values(node).flatMap(texts);
}

async function build(steps, options = {}) {
  const blocks = await buildCaseBodyBlocks({
    caseId: 'CP-1', description: '', steps, documentNotes: '',
  }, options);
  return texts(blocks);
}

test('Word summary counts and lists only evidence marked with a novelty', async () => {
  const output = await build([
    { stepStatus: 'pendiente', comment: 'Normal 1' },
    { stepStatus: 'fallo', severity: 'media', novedad: true, comment: 'Error XML' },
    { stepStatus: 'aprobado', comment: 'Normal 3' },
    { stepStatus: 'pendiente', comment: 'Normal 4' },
    { stepStatus: 'pendiente', comment: 'Normal 5' },
  ]);
  assert.ok(output.includes('Total de evidencias con novedad: 1'));
  assert.ok(output.includes('Estados de evidencias con novedad: Pendiente 0 • Aprobado 0 • Falló 1 • Observado 0'));
  assert.ok(output.some((text) => text.startsWith('Evidencia 2:') && text.includes('Error XML')));
  assert.equal(output.filter((text) => /^Evidencia \d+(?:\.\d+)?:/.test(text)).length, 1);
  assert.ok(!output.some((text) => text.startsWith('Resumen ejecutivo:')));
  assert.ok(!output.some((text) => text.startsWith('Total de pasos:')));
  assert.deepEqual(Array.from(output.filter((text) => /^Evidencia \d+(?:\.\d+)?$/.test(text))),
    ['Evidencia 1', 'Evidencia 2', 'Evidencia 3', 'Evidencia 4', 'Evidencia 5']);
  assert.equal(output.filter((text) => /^Paso \d/.test(text)).length, 0);
});

test('Word summary keeps the original grouped evidence label and handles no novelties', async () => {
  const grouped = await build([
    { stepStatus: 'aprobado' },
    { stepStatus: 'pendiente' },
    { stepStatus: 'observado', sameAsPrevious: true, severity: 'alta', novedad: true, comment: 'Detalle' },
  ], { onlyNovedades: true });
  assert.ok(grouped.some((text) => text.startsWith('Evidencia 2.2:') && text.includes('Detalle')));
  const empty = await build([{ stepStatus: 'pendiente' }]);
  assert.ok(empty.includes('Total de evidencias con novedad: 0'));
  assert.equal(empty.filter((text) => /^Evidencia \d+(?:\.\d+)?:/.test(text)).length, 0);
  assert.ok(empty.includes('Evidencia 1'));
  const groupedDetail = await build([
    { stepStatus: 'pendiente' },
    { stepStatus: 'pendiente', sameAsPrevious: true },
    { stepStatus: 'pendiente' },
  ]);
  assert.deepEqual(Array.from(groupedDetail.filter((text) => /^Evidencia \d+(?:\.\d+)?$/.test(text))),
    ['Evidencia 1.1', 'Evidencia 1.2', 'Evidencia 2']);
});
