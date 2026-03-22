class KnowledgeValidatorAgent {
  constructor(llmService) {
    this.llmService = llmService;
  }

  async validate(topic) {
    const prompt = `You are a KNOWLEDGE_VALIDATOR Agent for a Mindmap Generator.
Your task is to assess your knowledge coverage for the given topic. Your knowledge cutoff is January 2025.

Topic: "${topic}"

Evaluate if this is:
- KNOWN: High-confidence, well-established areas.
- UNCERTAIN: Rapidly evolving, contested, or partially covered areas (post-Jan 2025).
- UNKNOWN: Fully proprietary, non-public, or missing knowledge.

Respond ONLY with a valid JSON object matching this schema:
{
  "confidence": number, /* 0.0 to 1.0 */
  "knownAreas": string[],
  "uncertainAreas": string[],
  "unknownAreas": string[],
  "limitationNote": string | null
}

If confidence is < 0.6, the limitationNote should clearly state what is missing and what you recommend doing instead.`;

    try {
      return await this.llmService.generateJSON(prompt);
    } catch (e) {
      console.error("Validator parse error:", e);
      return { confidence: 1, knownAreas: [], uncertainAreas: [], unknownAreas: [] };
    }
  }
}

module.exports = KnowledgeValidatorAgent;
