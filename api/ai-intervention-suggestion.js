module.exports = async function aiInterventionSuggestion(request, response) {
  const { handleAiInterventionRequest } = await import("../lib/ai-intervention.mjs");
  return handleAiInterventionRequest(request, response);
};
