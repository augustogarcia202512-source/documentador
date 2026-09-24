(function (global) {
  const STEP_STATUS_VALUES = ["pendiente", "aprobado", "fallo", "observado"];

  const CASE_TEMPLATES = {
    general: {
      key: "general",
      label: "General",
      objective: "Documentar la evidencia y el resultado del caso de prueba.",
      focus: "Validar que el comportamiento observado coincida con el criterio de aceptación.",
    },
    funcional: {
      key: "funcional",
      label: "Caso funcional",
      objective: "Validar el comportamiento funcional del flujo principal.",
      focus: "Verificar que la funcionalidad cumple con el esperado para el usuario y el proceso del negocio.",
    },
    regresion: {
      key: "regresion",
      label: "Prueba de regresión",
      objective: "Confirmar que el cambio no introdujo regresiones en áreas relacionadas.",
      focus: "Revisar impactos colaterales de la corrección y validar que los flujos afectados siguen operativos.",
    },
    soporte: {
      key: "soporte",
      label: "Soporte / incidencia",
      objective: "Registrar la incidencia, el comportamiento reportado y la evidencia revisada.",
      focus: "Determinar el alcance del problema, la severidad y la necesidad de una corrección o seguimiento.",
    },
  };

  function normalizeStepStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return STEP_STATUS_VALUES.includes(normalized) ? normalized : "pendiente";
  }

  function getStepStatusLabel(status) {
    switch (normalizeStepStatus(status)) {
      case "aprobado": return "✅ Aprobado";
      case "fallo": return "❌ Falló";
      case "observado": return "⚠️ Observado";
      default: return "⏳ Pendiente";
    }
  }

  function normalizeDocumentNotes(value) {
    return String(value || "").replace(/\r\n?/g, "\n").trim();
  }

  function buildDocumentNotesLines(value) {
    const normalized = normalizeDocumentNotes(value);
    if (!normalized) return [];
    return normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizePreviewText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/\n+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function extractCaseFieldsFromPreviewText(text = "") {
    const source = normalizePreviewText(text);
    const orderedLabels = [
      "Caso de Prueba",
      "Descripción",
      "Plantilla",
      "Área / equipo",
      "Requisito / historia",
      "Ambiente",
      "Versión",
      "Precondiciones",
      "Fecha",
      "Documentado por",
      "Resultado esperado",
      "Resultado actual",
      "Resumen ejecutivo",
      "Resumen del caso",
      "Total de pasos",
    ];

    function capture(label, nextLabels = orderedLabels) {
      const patternLabel = escapeRegExp(label);
      const nextPattern = nextLabels
        .filter((item) => item !== label)
        .map((item) => escapeRegExp(item))
        .join("|");

      const regex = new RegExp(
        `${patternLabel}\\s*[:\-]?\\s*([\\s\\S]*?)(?=\\s*(?:${nextPattern})\\s*[:\-]|\\s*(?:${nextPattern})\\s*$|$)`,
        "i"
      );

      const match = source.match(regex);
      if (!match) return undefined;
      return match[1].replace(/\s+/g, " ").trim();
    }

    const caseId = capture("Caso de Prueba");
    const description = capture("Descripción");
    const team = capture("Área / equipo");
    const requirement = capture("Requisito / historia");
    const environment = capture("Ambiente");
    const buildVersion = capture("Versión");
    const preconditions = capture("Precondiciones");
    const tester = capture("Documentado por");
    const expectedResult = capture("Resultado esperado");
    const actualResult = capture("Resultado actual");

    return {
      caseId,
      description,
      team,
      requirement,
      environment,
      buildVersion,
      preconditions,
      tester,
      expectedResult,
      actualResult,
    };
  }

  function buildCaseSummary(steps, severityLabels = {}) {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const statusCounts = { pendiente: 0, aprobado: 0, fallo: 0, observado: 0 };

    const stepSummaries = safeSteps.map((step, index) => {
      const normalizedStatus = normalizeStepStatus(step && (step.stepStatus || step.status));
      statusCounts[normalizedStatus] += 1;
      const severity = step && step.severity ? step.severity : null;
      const severityLabel = severity ? (severityLabels[severity] || severity.toUpperCase()) : "Sin novedad";
      const comment = (step && step.comment ? String(step.comment).trim() : "").trim() || "Sin comentario";

      return {
        index: index + 1,
        status: normalizedStatus,
        statusLabel: getStepStatusLabel(normalizedStatus),
        severity,
        severityLabel,
        comment,
        novedad: !!severity,
      };
    });

    return {
      totalSteps: safeSteps.length,
      novedadCount: stepSummaries.filter((item) => item.novedad).length,
      statusCounts,
      stepSummaries,
    };
  }

  function getCaseTemplate(templateKey) {
    const normalized = String(templateKey || "general").trim().toLowerCase();
    return CASE_TEMPLATES[normalized] || CASE_TEMPLATES.general;
  }

  function buildExecutiveSummary({
    templateKey,
    description,
    steps = [],
    includeStatusText = true,
  } = {}) {
    const template = getCaseTemplate(templateKey);
    const summary = buildCaseSummary(steps);
    const result = {
      template,
      description: String(description || "").trim(),
      totalSteps: summary.totalSteps,
      novedadCount: summary.novedadCount,
      statusCounts: summary.statusCounts,
    };

    const severities = summary.stepSummaries.filter((item) => item.novedad);
    const primaryIssue = severities[0] || summary.stepSummaries[0] || null;
    const statusText = primaryIssue
      ? `${getStepStatusLabel(primaryIssue.status)} · ${primaryIssue.severityLabel}`
      : "Sin bloqueos detectados";

    const lines = [
      `Plantilla: ${template.label}`,
      `Objetivo: ${template.objective}`,
      `Enfoque: ${template.focus}`,
      `Resultado: ${result.description || "Se documentó la evidencia y el resultado del caso."}`,
      `Estado general: ${statusText}`,
      `Novedad principal: ${primaryIssue ? primaryIssue.comment : "No se registraron elementos con novedad."}`,
      `Impacto: ${severities.length > 0 ? "Se requiere revisión de la funcionalidad afectada y validación del alcance." : "La evidencia no reporta impacto funcional crítico en este caso."}`,
      `Recomendación: ${severities.length > 0 ? "Validar la corrección y confirmar la solución con una prueba de verificación posterior." : "Confirmar que el escenario queda consistente con el criterio de aceptación."}`,
    ];

    result.text = lines.join("\n");

    if (includeStatusText) {
      const statusSummary = [
        `${summary.totalSteps} pasos revisados`,
        `${summary.novedadCount} con novedad`,
        `pendientes ${summary.statusCounts.pendiente}, aprobados ${summary.statusCounts.aprobado}, fallos ${summary.statusCounts.fallo}, observados ${summary.statusCounts.observado}`,
      ].join(" · ");
      result.text = [
        `Resumen ejecutivo de ${template.label}`,
        ``,
        `${result.description || "Caso sin descripción."}`,
        ``,
        `Objetivo: ${template.objective}`,
        `Impacto: ${severities.length > 0 ? "Se requiere revisión prioritaria del alcance funcional afectado." : "La evidencia no reporta impacto funcional crítico."}`,
        `Novedad principal: ${primaryIssue ? primaryIssue.comment : "No se registraron elementos con novedad."}`,
        `Estado del caso: ${statusSummary}`,
        `Siguiente paso: ${severities.length > 0 ? "validar la corrección y repetir la prueba del flujo afectado." : "confirmar cierre con la validación del criterio de aceptación."}`,
      ].join("\n");
    }

    return result;
  }

  function getClipboardFallbackMessage(targetName) {
    const name = String(targetName || "imagen").trim();
    const label = name && name !== "imagen" ? ` de “${name}”` : "";

    return `Este navegador no permite copiar imágenes al portapapeles${label}. Puedes abrirla y usar Ctrl+C para copiarla manualmente.`;
  }

  const api = {
    CASE_TEMPLATES,
    STEP_STATUS_VALUES,
    normalizeStepStatus,
    normalizeDocumentNotes,
    buildDocumentNotesLines,
    normalizePreviewText,
    extractCaseFieldsFromPreviewText,
    getStepStatusLabel,
    getCaseTemplate,
    buildCaseSummary,
    buildExecutiveSummary,
    getClipboardFallbackMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.caseUtils = api;
})(typeof window !== "undefined" ? window : globalThis);
