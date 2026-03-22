class QualityCheckerAgent {
  constructor(llmService) {
    this.llmService = llmService;
  }

  async checkQuality(topic, markdownOutput) {
    // Basic validation
    if (!markdownOutput || markdownOutput.trim().length < 20 || markdownOutput.includes("API Error")) {
      return { 
        completeness: 0, accuracy: 0, balance: 0, overall: 0, 
        issues: ["Generation failed or output too short"], 
        suggestions: ["Check API configuration and try again"], 
        summary: "No valid content to evaluate." 
      };
    }

    const prompt = `You are a QUALITY_CHECKER Agent assessing a generated Markdown Mindmap.
Topic: "${topic}"

CONTENT TO EVALUATE:
${markdownOutput}

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
  "learnings": string[],
  "summary": string
}
`;

    try {
      return await this.llmService.generateJSON(prompt);
    } catch (e) {
      console.error("Quality check parse error:", e);
      return { completeness: 0, accuracy: 0, balance: 0, overall: 0, issues: ["Check failed"], suggestions: [], summary: "Failed to evaluate quality." };
    }
  }
}

module.exports = QualityCheckerAgent;
