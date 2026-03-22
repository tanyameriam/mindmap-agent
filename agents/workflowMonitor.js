const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

class WorkflowMonitorAgent {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.phases = [];
    this.startTime = null;
    
    this.feedbackSchema = {
       type: SchemaType.OBJECT,
       properties: {
         summary: { type: SchemaType.STRING, description: "Brief workflow summary" },
         totalTime: { type: SchemaType.STRING, description: "Total time taken" },
         suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "1-2 brief improvement suggestions" },
         rating: { type: SchemaType.STRING, description: "efficiency rating 1-5 stars" },
       },
       required: ["summary", "totalTime", "suggestions", "rating"]
    };
  }

  startTracking() {
    this.startTime = Date.now();
    this.phases = [];
    this.addPhase('session_start', 'Session initialized');
  }

  addPhase(name, description) {
    this.phases.push({
      name,
      description,
      timestamp: Date.now(),
      elapsed: this.startTime ? Date.now() - this.startTime : 0
    });
  }

  getProgress() {
    if (!this.startTime) return null;
    const totalElapsed = Date.now() - this.startTime;
    return {
      totalElapsedMs: totalElapsed,
      totalElapsedFormatted: this.formatTime(totalElapsed),
      phases: this.phases.map(p => ({
        ...p,
        elapsedFormatted: this.formatTime(p.elapsed)
      }))
    };
  }

  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
    return `${remainingSeconds}s`;
  }

  async generateFeedback(topic, progress) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "You are a Workflow Monitor Agent. Analyze the mind mapping session and provide brief, helpful feedback about the process. Provide valid JSON.",
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: this.feedbackSchema
      }
    });

    const prompt = `Session for topic: "${topic}"
Phases completed: ${JSON.stringify(progress.phases, null, 2)}
Total time: ${progress.totalElapsedFormatted}

Provide workflow feedback.`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  }
}

module.exports = WorkflowMonitorAgent;
