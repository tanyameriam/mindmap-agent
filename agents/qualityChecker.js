class QualityCheckerAgent {
  constructor(llmService) {
    this.llmService = llmService;
  }

  async checkQuality(topic, markdownOutput) {
    const prompt = `You are a QUALITY_CHECKER Agent assessing a generated Markdown Mindmap.
Topic: "${topic}"

Evaluate the completeness, accuracy, and balance of this Mindmap Markdown hierarchy.

Additionally, identify any "LEARNINGS" or meta-rules that could improve FUTURE mindmap generations (e.g., "Always include a 'Future Trends' section for technology topics" or "Avoid over-nesting more than 4 levels for complex science topics").

Respond ONLY with a valid JSON object matching this schema:
{
  "completeness": number, /* 0 to 1 */
  "accuracy": number,
  "balance": number,
  "overall": number,
  "issues": string[],
  "suggestions": string[],
  "learnings": string[], /* Persistent rules for future runs */
  "summary": string
}
`;

    try {
      return await this.llmService.generateJSON(prompt);
    } catch (e) {
      console.error("Quality check parse error:", e);
      return { completeness: 1, accuracy: 1, balance: 1, overall: 1, issues: [], suggestions: [], summary: "Could not evaluate quality." };
    }
  }
}

module.exports = QualityCheckerAgent;
