(function (global) {
  const STEP_STATUS_VALUES = ["pendiente", "aprobado", "fallo", "observado"];

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

  const api = {
    STEP_STATUS_VALUES,
    normalizeStepStatus,
    getStepStatusLabel,
    buildCaseSummary,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.caseUtils = api;
})(typeof window !== "undefined" ? window : globalThis);
