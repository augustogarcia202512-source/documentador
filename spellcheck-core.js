function findMisspellings(text, spell, ignoredWords = new Set()) {
  const errors = [];
  const ignored = ignoredWords instanceof Set
    ? new Set(Array.from(ignoredWords, (word) => String(word).toLocaleLowerCase("es")))
    : new Set();
  const words = String(text || "").matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*(?:[-_]?\p{N}[\p{L}\p{M}\p{N}_-]*)?/gu);

  for (const match of words) {
    const word = match[0];
    if (/\p{N}/u.test(word) || ignored.has(word.toLocaleLowerCase("es")) || spell.correct(word)) continue;
    const suggestions = spell.suggest(word);
    if (!suggestions.length && word.length > 3 && word.length <= 32) {
      const recovered = new Set();
      for (let index = 0; index < word.length && recovered.size < 3; index += 1) {
        const shorter = word.slice(0, index) + word.slice(index + 1);
        spell.suggest(shorter).forEach((suggestion) => {
          if (spell.correct(suggestion)) recovered.add(suggestion);
        });
      }
      suggestions.push(...recovered);
    }
    errors.push({
      word,
      index: match.index,
      suggestions: suggestions.slice(0, 3),
    });
  }
  return errors;
}

function preserveWordCase(original, replacement) {
  if (original === original.toLocaleUpperCase("es")) {
    return replacement.toLocaleUpperCase("es");
  }
  if (original[0] === original[0].toLocaleUpperCase("es")) {
    return replacement[0].toLocaleUpperCase("es") + replacement.slice(1);
  }
  return replacement;
}

function applySuggestion(text, error, suggestion) {
  const value = String(text || "");
  if (!error || value.slice(error.index, error.index + error.word.length) !== error.word) {
    return value;
  }
  return value.slice(0, error.index) +
    preserveWordCase(error.word, suggestion) +
    value.slice(error.index + error.word.length);
}

module.exports = { findMisspellings, applySuggestion };
