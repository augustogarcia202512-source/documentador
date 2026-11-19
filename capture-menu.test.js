const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const panelStart = html.indexOf('<div class="capture-menu-panel" id="captureMenuPanel"');
const panelEnd = html.indexOf('</div>', panelStart);
assert.ok(panelStart !== -1 && panelEnd !== -1, 'capture menu panel must exist');
const panel = html.slice(panelStart, panelEnd);

test('capture menu exposes all capture actions and destination', () => {
  for (const id of ['shareBtn', 'pipBtn', 'captureBtn', 'selectCaptureBtn', 'captureTargetSelect']) {
    assert.match(panel, new RegExp(`id="${id}"`), `${id} must be inside the floating menu`);
  }
});

test('capture menu retains download and undo controls outside the menu', () => {
  const downloadPosition = html.indexOf('id="downloadCapturesBtn"');
  const panelEndPosition = html.indexOf('</div>', panelStart);
  assert.ok(downloadPosition > panelEndPosition);
  assert.ok(html.indexOf('id="undoBtn"') > panelEndPosition);
  assert.ok(html.indexOf('id="redoBtn"') > panelEndPosition);
});

test('capture menu has accessible toggle and closes after an action or outside click', () => {
  assert.match(html, /id="captureMenuToggle"[^>]*aria-expanded="false"[^>]*aria-controls="captureMenuPanel"/);
  assert.match(html, /captureMenuToggle\.addEventListener\("click"/);
  assert.match(html, /captureMenuPanel\.addEventListener\("click"/);
  assert.match(html, /if \(!captureMenuWrap\.contains\(event\.target\)\) setCaptureMenuOpen\(false\)/);
});

test('capture menu floats separately from the capture card and stacks above Comment', () => {
  const floatingControls = html.indexOf('<div class="capture-menu-wrap" id="captureMenuWrap">');
  const commentFab = html.indexOf('id="quickCommentFab"');
  assert.ok(floatingControls > commentFab);
  assert.match(html, /\.capture-menu-wrap\s*\{\s*position:\s*fixed;[^}]*right:\s*18px;[^}]*bottom:\s*140px;/);
  assert.match(html, /\.capture-menu-panel\s*\{[^}]*bottom:\s*calc\(100% \+ 10px\);/);
  assert.match(html, /if \(isOpen\) closeQuickCommentPanel\(\)/);
  assert.match(html, /function openQuickCommentPanel\(\) \{[^}]*setCaptureMenuOpen\(false\)/s);
});
