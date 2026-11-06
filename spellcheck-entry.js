import nspell from "nspell";
import aff from "./node_modules/dictionary-es/index.aff";
import dic from "./node_modules/dictionary-es/index.dic";
import { applySuggestion, findMisspellings } from "./spellcheck-core.js";

const spell = nspell({ aff, dic });
const ignoredWords = new Set();
const FIELD_SELECTOR = [
  "textarea:not(#qaBulkImportText)",
  "#caseId",
  "#description",
  "#preconditions",
  "#qaNewCaseId",
  "#dashboardIssueFormName",
].join(", ");
const RESULTS_CLASS = "spellcheck-results";
const registeredFields = new Set();

function createButton(label, title, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", action);
  return button;
}

function renderResults(field, errors) {
  let panel = field.nextElementSibling;
  if (!panel?.classList.contains(RESULTS_CLASS)) {
    panel = document.createElement("div");
    panel.className = RESULTS_CLASS;
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    field.insertAdjacentElement("afterend", panel);
  }
  panel.replaceChildren();
  panel.hidden = !errors.length;
  if (!errors.length) return;

  const summary = document.createElement("p");
  summary.className = "spellcheck-results__summary";
  summary.textContent = `Posibles errores ortográficos: ${errors.length}`;
  panel.append(summary);

  const list = document.createElement("ul");
  list.className = "spellcheck-results__list";
  errors.slice(0, 8).forEach((error) => {
    const item = document.createElement("li");
    item.className = "spellcheck-results__item";
    const word = document.createElement("span");
    word.className = "spellcheck-results__word";
    word.textContent = error.word;
    item.append(word);

    if (error.suggestions.length) {
      error.suggestions.forEach((suggestion) => {
        item.append(createButton(suggestion, `Reemplazar «${error.word}» por «${suggestion}»`, () => {
          const updated = applySuggestion(field.value, error, suggestion);
          if (updated === field.value) return;
          field.value = updated;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
          const cursor = error.index + suggestion.length;
          field.setSelectionRange(cursor, cursor);
        }));
      });
    } else {
      const noSuggestions = document.createElement("span");
      noSuggestions.textContent = "Sin sugerencias";
      item.append(noSuggestions);
    }

    item.append(createButton("Ignorar", `Ignorar «${error.word}» durante esta sesión`, () => {
      ignoredWords.add(error.word.toLocaleLowerCase("es"));
      registeredFields.forEach((candidate) => {
        if (candidate.isConnected) checkField(candidate);
        else registeredFields.delete(candidate);
      });
    }));
    list.append(item);
  });
  if (errors.length > 8) {
    const remaining = document.createElement("li");
    remaining.textContent = `y ${errors.length - 8} más…`;
    list.append(remaining);
  }
  panel.append(list);
}

const timers = new WeakMap();
function checkField(field) {
  clearTimeout(timers.get(field));
  timers.set(field, setTimeout(() => {
    if (!field.isConnected) return;
    renderResults(field, findMisspellings(field.value, spell, ignoredWords));
  }, 180));
}

function initializeField(field) {
  if (field.dataset.spellcheckLocal === "true") {
    registeredFields.add(field);
    return;
  }
  field.dataset.spellcheckLocal = "true";
  registeredFields.add(field);
  field.spellcheck = true;
  field.lang = "es";
  field.addEventListener("input", () => checkField(field));
  field.addEventListener("blur", () => checkField(field));
  checkField(field);
}

function initialize(root = document) {
  if (root.matches?.(FIELD_SELECTOR)) initializeField(root);
  root.querySelectorAll?.(FIELD_SELECTOR).forEach(initializeField);
}

if (typeof document !== "undefined") {
  initialize();
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.(FIELD_SELECTOR)) registeredFields.delete(node);
        node.querySelectorAll?.(FIELD_SELECTOR).forEach((field) => registeredFields.delete(field));
      });
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) initialize(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
}
