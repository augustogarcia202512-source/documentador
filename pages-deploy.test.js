const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('GitHub Pages artifact includes every local browser script', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const workflow = fs.readFileSync(path.join(__dirname, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  const copyCommand = workflow.match(/^\s*cp (.+) _site\/\s*$/m);
  assert.ok(copyCommand, 'The Pages workflow must copy files to the artifact');
  const copiedFiles = new Set(copyCommand[1].trim().split(/\s+/));
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
    .map((match) => match[1].split('?')[0])
    .filter((src) => !/^(?:https?:)?\/\//i.test(src));
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    assert.ok(copiedFiles.has(script), `${script} is missing from the Pages artifact`);
    assert.ok(fs.existsSync(path.join(__dirname, script)), `${script} does not exist`);
  }
});
