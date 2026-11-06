const test = require('node:test');
const assert = require('node:assert/strict');
const { applySuggestion, findMisspellings } = require('./spellcheck-core.js');

async function createSpanishSpellchecker() {
  const [{ default: nspell }, { default: dictionary }] = await Promise.all([
    import('nspell'),
    import('dictionary-es'),
  ]);
  return nspell({
    aff: dictionary.aff.toString(),
    dic: dictionary.dic.toString(),
  });
}

test('Spanish dictionary recognizes valid accents and suggests corrections locally', async () => {
  const spell = await createSpanishSpellchecker();
  assert.equal(spell.correct('prueba'), true);
  assert.equal(spell.correct('corrección'), true);
  assert.equal(spell.correct('correcion'), false);
  assert.ok(spell.suggest('correcion').includes('corrección'));

  const errors = findMisspellings('La correcion quedó lista.', spell);
  assert.deepEqual(errors.map(({ word }) => word), ['correcion']);
  assert.ok(errors[0].suggestions.includes('corrección'));
  assert.deepEqual(
    findMisspellings('TC-1 correcion', spell).map(({ word }) => word),
    ['correcion'],
  );
});

test('a repeated-letter typo still receives a Spanish dictionary suggestion', async () => {
  const spell = await createSpanishSpellchecker();
  const errors = findMisspellings('correcccion', spell);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].suggestions.includes('corrección'));
});

test('session ignores match case-insensitively and only for the specified word', async () => {
  const spell = await createSpanishSpellchecker();
  const errors = findMisspellings(
    'Correcion y correcion',
    spell,
    new Set(['correcion']),
  );
  assert.deepEqual(errors, []);
});

test('suggestions replace the exact occurrence and preserve capitalization', () => {
  const error = { word: 'Correcion', index: 4 };
  assert.equal(
    applySuggestion('Una Correcion más', error, 'corrección'),
    'Una Corrección más',
  );
  assert.equal(
    applySuggestion('CORRECION lista', { word: 'CORRECION', index: 0 }, 'corrección'),
    'CORRECCIÓN lista',
  );
  assert.equal(
    applySuggestion('Texto cambiado', error, 'corrección'),
    'Texto cambiado',
  );
});
