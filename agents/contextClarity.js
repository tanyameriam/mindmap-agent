const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are the Context Clarity Agent. Your job is to analyze a given topic for a mind map and identify any ambiguities, assumptions, or missing context that would affect the quality of the mind map.

When analyzing a topic, consider:
1. Is the scope clear? (e.g., "Machine Learning" is too broad without context)
2. Are there assumptions about the audience's knowledge level?
3. Is the purpose/goal of the mind map clear?
4. Are there specific sub-topics the user wants included or excluded?
5. Is the domain/industry context clear?

IMPORTANT RULES:
- Ask a MAXIMUM of 3-4 focused, specific questions
- If the topic is already very clear and specific, you may declare it clear immediately
- Be conversational and friendly
- Don't ask obvious questions

If status is "clear", questions array should be empty.`;

const FOLLOWUP_PROMPT = `You are the Context Clarity Agent. You previously asked clarifying questions about a mind map topic. The user has provided answers. 

Analyze their responses and determine if the context is now clear enough to generate a high-quality mind map.

Consider:
1. Did they address the key ambiguities?
2. Is there enough information to create a meaningful mind map at the requested depth?
3. Are there still critical unknowns?

Be reasonable - don't over-ask. If you have enough to work with, declare it clear. Maximum 1 more round of questions.`;

class ContextClarityAgent {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Schema for initial analysis
    this.initialSchema = {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: '"needs_clarification" or "clear"' },
        questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        summary: { type: SchemaType.STRING },
        assumptions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["status", "questions", "summary", "assumptions"]
    };

    // Schema for followup
    this.followupSchema = {
       type: SchemaType.OBJECT,
       properties: {
         status: { type: SchemaType.STRING, description: '"needs_clarification" or "clear"' },
         questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
         summary: { type: SchemaType.STRING },
         refinedTopic: { type: SchemaType.STRING }
       },
       required: ["status", "questions", "summary", "refinedTopic"]
    };
  }

  async analyzeInitial(topic, depth, detailLevel) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: this.initialSchema
      }
    });

    const prompt = `Please analyze this mind map request:
Topic: "${topic}"
Requested Depth (levels): ${depth}
Detail Level: ${detailLevel}

Analyze whether this is clear enough to create a high-quality mind map, or if clarifying questions are needed.`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  }

  async evaluateResponses(topic, depth, detailLevel, conversationHistory) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: FOLLOWUP_PROMPT,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: this.followupSchema
      }
    });

    const historyText = conversationHistory.map(h => `${Math.random() > 0.5 ? 'Agent' : 'User'}: ${h.content}`).join('\\n');

    const prompt = `Original request:
Topic: "${topic}"
Depth: ${depth}
Detail Level: ${detailLevel}

Conversation so far:
${historyText}

Based on all the information gathered, is the context now clear enough to generate the mind map?`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  }
}

module.exports = ContextClarityAgent;
