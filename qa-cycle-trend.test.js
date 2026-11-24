const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const start = html.indexOf('  function renderQaMetricsPanel(project, projectCases) {');
const end = html.indexOf('  function renderDashboardIssueQuality(', start);
assert.ok(start !== -1 && end !== -1);

function renderTrend(cycles) {
  const container = { innerHTML: '' };
  const context = {
    document: { getElementById: () => container },
    getActiveExecutionCycle: () => null,
    getQaCycleSummary: (cycle) => ({ passRate: cycle.rate }),
    escapeHtml: (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  };
  const render = vm.runInNewContext(`(function () { ${html.slice(start, end)}; return renderQaMetricsPanel; })()`, context);
  render({ suites: [], executionCycles: cycles }, []);
  return container.innerHTML;
}

test('trend reserves space at both edges for two cycle names and values', () => {
  const result = renderTrend([{ name: 'Ciclo1', rate: 50 }, { name: 'Ciclo 2', rate: null }]);
  const svg = result.match(/viewBox="0 0 (\d+) (\d+)"/);
  const dots = [...result.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
  const labels = [...result.matchAll(/<text x="([\d.]+)" y="130" text-anchor="middle"[^>]*><title>(.*?)<\/title>/g)];
  assert.equal(labels.length, 2);
  assert.equal(dots.length, 1);
  assert.ok(Number(labels[0][1]) >= 80, 'first point must not overlap axis labels');
  assert.ok(Number(svg[1]) - Number(labels[1][1]) >= 60, 'last cycle must not be clipped');
  assert.match(result, /Ciclo1: 50\.0%/);
  assert.match(result, /overflow|qa-cycle-trend-scroll/);
});

test('trend gives each cycle room and retains full names and endpoint rates', () => {
  const cycles = Array.from({ length: 8 }, (_, index) => ({
    name: `Ciclo extenso ${index + 1}`,
    rate: index === 0 ? 100 : index === 7 ? 0 : null,
  }));
  const result = renderTrend(cycles);
  assert.match(result, /viewBox="0 0 924 140"/);
  assert.match(result, /min-width:924px/);
  assert.match(result, /<title>Ciclo extenso 1<\/title>Ciclo ext…/);
  assert.match(result, /Ciclo extenso 1: 100\.0%/);
  assert.match(result, /Ciclo extenso 8: 0\.0%/);
  assert.match(html, /\.qa-metrics-block\s*\{\s*min-width:\s*0;/);
  assert.match(html, /\.qa-cycle-trend-scroll\s*\{\s*overflow-x:\s*auto;/);
  const labels = [...result.matchAll(/<text x="([\d.]+)" y="130" text-anchor="middle"/g)].map((match) => Number(match[1]));
  assert.equal(labels.length, 8);
  assert.ok(labels.every((x, index) => index === 0 || x - labels[index - 1] >= 100));
});

test('trend retains the empty state when no cycle has evaluated cases', () => {
  assert.match(renderTrend([{ name: 'Ciclo 1', rate: null }]), /Se mostrará cuando un ciclo tenga casos evaluados/);
});
