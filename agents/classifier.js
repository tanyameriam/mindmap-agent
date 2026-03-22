class ClassifierAgent {
  constructor(llmService) {
    this.llmService = llmService;
  }

  async classify(topic, detailLevel, context = "") {
    const prompt = `You are a CLASSIFIER Agent for a Mindmap Generator.
Your task is to analyze the user's topic and determine if you have a COMPLETE and CONFIDENT understanding of their specific needs.

Core Topic: "${topic}"
Detail Requirement: "${detailLevel}"
Conversational History: "${context}"

CRITICAL RULE: You MUST set isAmbiguous to true if the topic lacks specific constraints that would change the structure. For example:
- "Learning Python": Needs to know if for data science, web dev, or absolute beginners.
- "Business Plan": Needs to know the industry and scale.
- "Healthy Diet": Needs to know if for weight loss, muscle gain, or specific medical needs.

ONLY set isAmbiguous to false if the topic is specific enough that no further major clarifying questions would fundamentally alter the top-level nodes of the mindmap. If you are even slightly unsure, ask 2-3 deep, insightful questions instead of proceeding.

Please respond ONLY with a valid JSON object matching this schema:
{
  "isAmbiguous": boolean,
  "clarificationQuestions": string[], 
  "domain": "taxonomic" | "process" | "component" | "conceptual" | "skill" | "problem-solution" | "multi-dimensional",
  "purpose": "learn" | "decide" | "plan" | "explore",
  "confidence": number,
  "clarifiedTopic": string
}
`;

    try {
      return await this.llmService.generateJSON(prompt);
    } catch (e) {
      console.error("Classifier parse error:", e);
      return { isAmbiguous: false, confidence: 0, clarifiedTopic: topic };
    }
  }
}

module.exports = ClassifierAgent;
