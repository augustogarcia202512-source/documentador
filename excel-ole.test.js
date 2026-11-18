const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const JSZip = require('jszip');
const CFB = require('cfb');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('  async function downloadDashboardIssuesXlsx(');
const end = html.indexOf('  function buildDashboardIssueSummaryHtml(', start);
assert.ok(start !== -1 && end !== -1, 'Excel export function must exist');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCbAB//2Q==', 'base64');
const dataUrl = (bytes, format) => `data:image/${format};base64,${bytes.toString('base64')}`;

function createHarness() {
  let downloaded;
  const context = {
    Uint8Array, ArrayBuffer, DataView, TextEncoder, Blob,
    atob,
    Image: class {
      constructor() { this.naturalWidth = 1; this.naturalHeight = 1; }
      async decode() {
        if (this.src.includes('YmFk')) throw new Error('Imagen dañada');
      }
    },
    document: {
      createElement(tag) {
        if (tag !== 'a') throw new Error(`Unexpected element ${tag}`);
        return { click() {} };
      },
    },
    URL: { createObjectURL(blob) { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() {},
    docx: { JSZip },
    getDashboardIssueEvidence: (issue) => issue.evidence,
    getDashboardIssueSummarySections: () => [],
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'excel-ole.bundle.js'), 'utf8'), context);
  vm.runInContext(html.slice(start, end), context);
  return { context, downloaded: () => downloaded };
}

function nativeImage(bytes, signature) {
  const cfb = CFB.read(bytes, { type: 'buffer' });
  const native = cfb.FileIndex.find((item) => item.name === '\u0001Ole10Native');
  assert.ok(native);
  const stream = Buffer.from(native.content);
  const offset = stream.indexOf(signature);
  assert.ok(offset >= 4);
  const length = stream.readUInt32LE(offset - 4);
  assert.equal(stream.readUInt32LE(0), stream.length - 4);
  return stream.subarray(offset, offset + length);
}

test('Excel stores every original image in an OLE object anchored to its issue row', async () => {
  const { context, downloaded } = createHarness();
  const issues = [
    { displayId: 'ISSUE-A', evidence: [{ step: { dataUrl: dataUrl(png, 'png') } }, { step: { dataUrl: dataUrl(jpg, 'jpeg') } }] },
    { displayId: 'ISSUE-B', evidence: [{ step: { dataUrl: dataUrl(jpg, 'jpeg') } }] },
    { displayId: 'ISSUE-C', evidence: [] },
  ];
  await context.downloadDashboardIssuesXlsx({ name: 'Prueba' }, issues, ['ID issue', 'Imágenes'],
    [['ISSUE-A', 2], ['ISSUE-B', 1], ['ISSUE-C', 0]], 'test.xlsx');
  const blob = downloaded();
  assert.ok(blob);
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (process.env.OLE_TEST_OUTPUT) fs.writeFileSync(process.env.OLE_TEST_OUTPUT, buffer);
  const zip = await JSZip.loadAsync(buffer);
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const rels = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
  const drawing = await zip.file('xl/drawings/drawing1.xml').async('string');
  const objects = [...sheet.matchAll(/<oleObject shapeId="(\d+)" progId="Package" r:id="(rId\d+)" dvAspect="DVASPECT_ICON"><objectPr[^>]*><anchor[^>]*><from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>\d+<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/g)];
  assert.equal(objects.length, 3);
  assert.deepEqual(objects.map((match) => [match[2], Number(match[3]), Number(match[4])]),
    [['rId3', 2, 1], ['rId4', 3, 1], ['rId5', 2, 2]]);
  assert.match(sheet, /Evidencia 1/);
  assert.match(sheet, /Evidencia 2/);
  assert.match(sheet, /ISSUE-A/);
  assert.match(sheet, /ISSUE-B/);
  assert.match(sheet, /ISSUE-C/);
  assert.match(sheet, /<row r="2"[^>]*>[\s\S]*?ISSUE-A[\s\S]*?<\/row>/);
  assert.match(sheet, /<row r="3"[^>]*>[\s\S]*?ISSUE-B[\s\S]*?<\/row>/);
  assert.doesNotMatch(drawing, /<xdr:pic>/);
  assert.equal((rels.match(/relationships\/oleObject/g) || []).length, 3);
  assert.doesNotMatch(rels, /TargetMode="External"/);
  assert.deepEqual(nativeImage(await zip.file('xl/embeddings/oleObject1.bin').async('nodebuffer'), png.subarray(0, 8)), png);
  assert.deepEqual(nativeImage(await zip.file('xl/embeddings/oleObject2.bin').async('nodebuffer'), jpg.subarray(0, 3)), jpg);
  assert.deepEqual(nativeImage(await zip.file('xl/embeddings/oleObject3.bin').async('nodebuffer'), jpg.subarray(0, 3)), jpg);
  assert.ok(zip.file('xl/worksheets/sheet2.xml'));
  assert.ok(zip.file('xl/media/oleIcon.emf'));
});

test('Excel export rejects a damaged image without downloading an incomplete file', async () => {
  const { context, downloaded } = createHarness();
  await assert.rejects(context.downloadDashboardIssuesXlsx({ name: 'Prueba' },
    [{ displayId: 'ISSUE-BAD', evidence: [{ step: { dataUrl: dataUrl(Buffer.from('bad'), 'png') } }] }],
    ['ID issue'], [['ISSUE-BAD']], 'test.xlsx'), /evidencia 1 del issue ISSUE-BAD/);
  assert.equal(downloaded(), undefined);
});

test('Excel export rejects a missing original even if a thumbnail exists', async () => {
  const { context, downloaded } = createHarness();
  await assert.rejects(context.downloadDashboardIssuesXlsx({ name: 'Prueba' },
    [{ displayId: 'ISSUE-THUMB', evidence: [{ step: { thumbnailDataUrl: dataUrl(png, 'png') } }] }],
    ['ID issue'], [['ISSUE-THUMB']], 'test.xlsx'), /evidencia 1 del issue ISSUE-THUMB/);
  assert.equal(downloaded(), undefined);
});

test('Excel without images contains no OLE relationships', async () => {
  const { context, downloaded } = createHarness();
  await context.downloadDashboardIssuesXlsx({ name: 'Prueba' },
    [{ displayId: 'ISSUE-EMPTY', evidence: [] }], ['ID issue'], [['ISSUE-EMPTY']], 'empty.xlsx');
  const zip = await JSZip.loadAsync(Buffer.from(await downloaded().arrayBuffer()));
  assert.equal(zip.file('xl/worksheets/_rels/sheet1.xml.rels'), null);
  assert.doesNotMatch(await zip.file('xl/worksheets/sheet1.xml').async('string'), /<oleObjects>/);
});

test('Excel export passes only the actively filtered issues to the workbook builder', async () => {
  const start = html.indexOf('  async function exportDashboardIssues(');
  const end = html.indexOf('  function bindDashboardIssueLogControls(', start);
  assert.ok(start !== -1 && end !== -1);
  const selected = [{ id: 'visible', status: 'Open' }];
  const project = { id: 'project', name: 'Test', issues: [...selected, { id: 'hidden' }] };
  let exported;
  const context = {
    projects: [project], activeProjectId: 'project',
    getFilteredDashboardIssues: () => selected,
    buildDashboardIssueExportData: (_, issues) => ({ headers: ['ID'], rows: issues.map((issue) => [issue.id]) }),
    sanitizeFilenamePart: (value) => value,
    DASHBOARD_ISSUE_STATUSES: ['Open'],
    escapeHtml: (value) => value,
    document: { getElementById: () => ({ disabled: false }) },
    downloadDashboardIssuesXlsx: async (...args) => { exported = args; },
    showTransientStatus() {},
    console,
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  await context.exportDashboardIssues('excel');
  assert.equal(exported[1], selected);
  assert.equal(exported[2][0], 'ID');
  assert.equal(exported[3].length, 1);
  assert.equal(exported[3][0][0], 'visible');
});

test('Excel omits step metadata from finding descriptions without changing saved issues', async () => {
  const { context, downloaded } = createHarness();
  const issues = [
    { displayId: 'ISSUE-A', observation: 'Paso 1 (Pendiente · Severidad Media): No genera el archivo\nPaso 2.1 (Fallido · Severidad Alta): Otro hallazgo', evidence: [] },
    { displayId: 'ISSUE-B', observation: 'Descripción manual', evidence: [] },
  ];
  const original = issues[0].observation;
  const project = { id: 'project', name: 'Test', suites: [] };
  Object.assign(context, {
    projects: [project], activeProjectId: 'project',
    getFilteredDashboardIssues: () => issues,
    getDashboardIssueCase: () => null,
    formatDashboardIssueDate: () => '',
    getDashboardIssueAgeDays: () => null,
    sanitizeFilenamePart: (value) => value,
    DASHBOARD_ISSUE_STATUSES: [],
    escapeHtml: (value) => value,
    showTransientStatus() {},
  });
  context.document.getElementById = () => ({ disabled: false });
  const cleanerStart = html.indexOf('  function cleanDashboardIssueReportText(');
  const cleanerEnd = html.indexOf('  function dashboardIssueReportParagraph(', cleanerStart);
  const dataStart = html.indexOf('  function buildDashboardIssueExportData(');
  const dataEnd = html.indexOf('  function downloadDashboardIssueFile(', dataStart);
  const exportStart = html.indexOf('  async function exportDashboardIssues(');
  const exportEnd = html.indexOf('  function bindDashboardIssueLogControls(', exportStart);
  assert.ok(cleanerStart !== -1 && cleanerEnd !== -1 && dataStart !== -1 && dataEnd !== -1 && exportStart !== -1 && exportEnd !== -1);
  vm.runInContext(html.slice(cleanerStart, cleanerEnd) + html.slice(dataStart, dataEnd) + html.slice(exportStart, exportEnd), context);
  await context.exportDashboardIssues('excel');
  const zip = await JSZip.loadAsync(Buffer.from(await downloaded().arrayBuffer()));
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /<c r="F2"[^>]*><is><t[^>]*>No genera el archivo\nOtro hallazgo<\/t>/);
  assert.match(sheet, /<c r="F3"[^>]*><is><t[^>]*>Descripción manual<\/t>/);
  assert.equal(issues[0].observation, original);
});

test('new PNG and JPEG issue attachments retain their original bytes', async () => {
  const start = html.indexOf('  function readIssueImageFile(file) {');
  const end = html.indexOf('  async function addDashboardIssueImages(', start);
  assert.ok(start !== -1 && end !== -1);
  const context = {
    FileReader: class {
      readAsDataURL(file) { this.result = file.dataUrl; this.onload(); }
    },
    Image: class {
      set src(value) { this.onload(); }
    },
    document: { createElement() { throw new Error('Original PNG/JPEG must not be re-encoded'); } },
    Date, Math,
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  for (const [type, bytes] of [['image/png', png], ['image/jpeg', jpg]]) {
    const original = `data:${type};base64,${bytes.toString('base64')}`;
    const attachment = await context.readIssueImageFile({ name: 'test', type, dataUrl: original });
    assert.equal(attachment.dataUrl, original);
  }
});

test('pasted PNG and JPEG evidence preserves original data instead of canvas compression', () => {
  const start = html.indexOf('  function addCapturedStep(');
  const end = html.indexOf('  // Agrega otra imagen al mismo paso', start);
  assert.ok(start !== -1 && end !== -1);
  const steps = [];
  const context = {
    CAPTURE_MAX_WIDTH: 2560, CAPTURE_JPEG_QUALITY: 0.95, steps,
    document: { createElement: () => ({
      getContext: () => ({ drawImage() {} }),
      toDataURL: () => 'data:image/jpeg;base64,cmVlbmNvZGVk',
    }) },
    pushUndoCheckpoint() {}, createStepThumbnail: () => 'thumbnail',
    getCaptureTarget: () => 'new',
    createCapturedStepRecord: (dataUrl, thumbnailDataUrl) => ({ dataUrl, thumbnailDataUrl }),
    addStepCard() {}, renumberSteps() {}, maybeWarnLargeSession() {}, saveStateToDB() {},
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  for (const [format, bytes] of [['png', png], ['jpeg', jpg]]) {
    const original = dataUrl(bytes, format);
    context.addCapturedStep({}, 4000, 1000, original);
    assert.equal(steps.at(-1).dataUrl, original);
    assert.equal(steps.at(-1).thumbnailDataUrl, 'thumbnail');
  }
});
