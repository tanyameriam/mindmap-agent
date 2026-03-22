const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are the Mind Map Generator Agent. Your job is to create a structured mind map in markdown format that can be rendered by the markmap library.

RULES FOR GENERATING MIND MAPS:
1. Use markdown headings (#, ##, ###, etc.) to represent hierarchy levels
2. The root topic uses # (h1)
3. Each subsequent level uses one more # 
4. Use bullet points (- ) for leaf items within a level
5. Make the content informative, insightful, and well-organized
6. Follow the exact depth (number of heading levels) requested
7. Follow the detail level: 
   - "concise": Brief labels, minimal descriptions
   - "moderate": Clear labels with short descriptions  
   - "detailed": Comprehensive labels with explanations and examples

IMPORTANT: Return ONLY the markdown mind map content. No explanations, no markdown code fences (\`\`\`markdown), just the raw markdown starting with a single # for the root topic.`;

class MindMapGeneratorAgent {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generate(topic, depth, detailLevel, clarifiedContext) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.8
      }
    });

    const prompt = `Generate a mind map with the following specifications:

Topic: "${topic}"
Number of levels (depth): ${depth}
Detail level: ${detailLevel}

Additional context and clarifications:
${clarifiedContext}

Create a comprehensive, well-structured mind map in markdown format. Use exactly ${depth} levels of depth (heading levels). Return ONLY the raw markdown content. Do not include markdown ticks.`;

    const result = await model.generateContent(prompt);
    let out = result.response.text();
    // Clean up potential markdown code fences just in case
    out = out.replace(/^```markdown\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
    return out;
  }
}

module.exports = MindMapGeneratorAgent;
