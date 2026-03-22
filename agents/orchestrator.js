const fs = require('fs');
const path = require('path');
const ClassifierAgent = require('./classifier');
const KnowledgeValidatorAgent = require('./knowledgeValidator');
const StructureBuilderAgent = require('./structureBuilder');
const QualityCheckerAgent = require('./qualityChecker');
const LLMService = require('./llmService');
const { readLearnings, saveLearning } = require('./storage');

class OrchestratorAgent {
  constructor(defaultApiKey) {
    this.defaultApiKey = defaultApiKey;
    this.sessions = new Map();
    this.MAX_GENERATION_TIME = 45000; 
    this.REFINE_BUFFER = 12000; 
    this.usageFile = path.join(__dirname, 'usage.json');
    this.usageLimit = 20;
    this.loadUsage();
  }

  loadUsage() {
    try {
      const data = fs.readFileSync(this.usageFile, 'utf8');
      this.usage = JSON.parse(data);
    } catch (e) {
      this.usage = { count: 0 };
    }
  }

  saveUsage() {
    try {
      fs.writeFileSync(this.usageFile, JSON.stringify(this.usage, null, 2));
    } catch (e) {
      console.error('Failed to save usage data');
    }
  }

  createSession(id, topic, depth, detailLevel, apiKey, provider = 'google', modelName = 'gemini-2.5-flash') {
    const usingSystemKey = !apiKey;
    const sessionApiKey = apiKey || this.defaultApiKey;
    const llmService = new LLMService(provider, modelName, sessionApiKey);

    this.sessions.set(id, { 
      id, topic, originalTopic: topic, depth, detailLevel, state: 'CLASSIFYING',
      domain: null, purpose: null, uncertainAreas: [], metrics: {}, context: "",
      usingSystemKey,
      qualityResult: { completeness: 0, accuracy: 0, balance: 0, summary: "Not yet evaluated." },
      agents: {
        classifier: new ClassifierAgent(llmService),
        validator: new KnowledgeValidatorAgent(llmService),
        builder: new StructureBuilderAgent(llmService),
        checker: new QualityCheckerAgent(llmService)
      }
    });
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  async processInitial(sessionId, sendEvent) {
    const session = this.getSession(sessionId);
    if (!session) return;

    // Check usage limit for system key
    if (session.usingSystemKey) {
      if (this.usage.count >= this.usageLimit) {
        sendEvent('agent_message', { 
          agent: 'System', 
          message: '❌ System API key limit reached (20/20 runs consumed). Please provide your own API key in the configuration to continue.',
          icon: '🛑'
        });
        return;
      }
      this.usage.count++;
      this.saveUsage();
      sendEvent('agent_status', { 
        agent: 'Workflow Monitor', 
        message: `System usage: ${this.usage.count}/${this.usageLimit} runs used.` 
      });
    }

    session.startTime = Date.now();
    await this.runClassifier(session, sendEvent);
  }

  async processUserResponse(sessionId, message, sendEvent) {
    const session = this.getSession(sessionId);
    if (!session) return;

    if (session.state === 'WAITING_CLARIFICATION') {
      sendEvent('agent_message', { agent: 'Orchestrator', message: `Updating context with: "${message}"` });
      session.context += `\nUser answered: ${message}`;
      await this.runClassifier(session, sendEvent);
    } else if (session.state === 'WAITING_VALIDATION') {
      if (message.toLowerCase().includes('cancel') || message.toLowerCase().includes('no')) {
         sendEvent('agent_message', { agent: 'Orchestrator', message: 'Workflow cancelled.' });
         sendEvent('workflow_complete', { progress: {totalElapsedFormatted: "0s"}, feedback: { summary: "Cancelled by user due to knowledge limitations.", suggestions: [] }});
      } else {
         sendEvent('agent_message', { agent: 'Orchestrator', message: "No worries! I'll do my best with the info I have. Let's get to work!" });
         await this.runBuilder(session, sendEvent);
      }
    }
  }

  async runClassifier(session, sendEvent) {
    session.state = 'CLASSIFYING';
    const start = Date.now();
    sendEvent('agent_status', { agent: 'Context Clarity', message: 'Analyzing topic & context...' });
    
    const result = await session.agents.classifier.classify(session.topic, session.detailLevel, session.context);
    session.metrics.classifyTime = (Date.now() - start)/1000;

    if (result.isAmbiguous) {
      session.state = 'WAITING_CLARIFICATION';
      sendEvent('agent_message', { agent: 'Context Clarity', message: 'Your topic is quite broad or ambiguous. Please provide more clarity:' });
      sendEvent('clarification_questions', { questions: result.clarificationQuestions || ["Please specify what exactly you want mapped."] });
      return; 
    }

    session.domain = result.domain || 'general';
    session.topic = result.clarifiedTopic || session.topic;
    
    sendEvent('agent_message', { agent: 'Context Clarity', message: `Classified successfully! Focusing precisely on: "${session.topic}" (Domain: ${session.domain})`, icon: '✔️' });
    await new Promise(r => setTimeout(r, 1000)); // Optimized delay
    await this.runValidator(session, sendEvent);
  }

  async runValidator(session, sendEvent) {
    session.state = 'VALIDATING';
    const start = Date.now();
    sendEvent('agent_status', { agent: 'Workflow Monitor', message: 'Validating knowledge coverage (cutoff Jan 2025)...' });
    
    const result = await session.agents.validator.validate(session.topic);
    session.metrics.validateTime = (Date.now() - start)/1000;
    session.uncertainAreas = result.uncertainAreas || [];
    
    if (result.confidence < 0.6) {
      session.state = 'WAITING_VALIDATION';
      const warningText = `Hey! Just a heads-up: I don't have a ton of context for events after Jan 2025. I can definitely still build this for you based on what I already know, but some super recent details might be missing. \n\nDoes that work for you, or should we try a different angle?`;
      sendEvent('agent_message', { agent: 'Workflow Monitor', message: warningText, icon: '👋' });
      sendEvent('clarification_questions', { questions: ["Sounds good, keep going!", "Let's try something else"] });
      return; 
    }

    sendEvent('agent_message', { agent: 'Workflow Monitor', message: `All set! My knowledge base looks solid for this (Confidence: ${Math.round(result.confidence * 100)}%).`, icon: '✅' });
    await new Promise(r => setTimeout(r, 5000)); // Delay to prevent 429
    await this.runBuilder(session, sendEvent);
  }

  async forceGenerate(sessionId, sendEvent) {
    const session = this.getSession(sessionId);
    if (!session) return;

    sendEvent('agent_message', { 
        agent: 'Workflow Monitor', 
        message: 'Bypassing clarification. Starting mind map generation now! 🚀', 
        icon: '⚡' 
    });

    // Start building immediately
    session.generationStartTime = Date.now();
    await this.runBuilder(session, sendEvent, 1, []);
  }

  async runBuilder(session, sendEvent, iteration = 1, previousSuggestions = []) {
    session.state = 'BUILDING';
    
    // Start tracking the "Best Output" window from the first builder run after user input
    if (iteration === 1) {
      session.generationStartTime = Date.now();
    }

    const iterationText = iteration > 1 ? ` (Refining - Attempt ${iteration}/3)` : '';
    sendEvent('agent_status', { agent: 'Mind Map Generator', message: `Constructing hierarchical structure${iterationText}...` });
    
    const start = Date.now();
    const learnings = readLearnings();
    
    // Combine persistent learnings with iteration-specific suggestions
    const effectiveLearnings = [...learnings, ...previousSuggestions];
    
    if (effectiveLearnings.length > 0 && iteration === 1) {
      sendEvent('agent_message', { agent: 'Orchestrator', message: `Applying ${effectiveLearnings.length} previous learnings...` });
    } else if (iteration > 1) {
      sendEvent('agent_message', { agent: 'Orchestrator', message: `Applying ${previousSuggestions.length} refinements for better quality...` });
    }

    const markdown = await session.agents.builder.buildStructure(
      session.originalTopic, 
      session.topic, 
      session.domain, 
      session.depth, 
      session.detailLevel, 
      session.uncertainAreas, 
      effectiveLearnings
    );
    
    session.metrics.buildTime = (session.metrics.buildTime || 0) + (Date.now() - start)/1000;
    session.markdown = markdown;
    
    // Guard: Skip quality check if generation failed
    if (markdown.includes("API Error") || markdown.trim().length < 20) {
      this.finishWorkflow(session, sendEvent, 'Mind map generation failed. Skipping quality evaluation.');
      return;
    }
    
    await this.runChecker(session, sendEvent, iteration);
  }

  async runChecker(session, sendEvent, iteration) {
    session.state = 'CHECKING';
    sendEvent('agent_status', { agent: 'Workflow Monitor', message: 'Evaluating quality metrics...' });
    
    const start = Date.now();
    let result;
    try {
      result = await session.agents.checker.checkQuality(session.topic, session.markdown);
    } catch (e) {
      console.error("Checker failed:", e);
      result = { completeness: 0, accuracy: 0, balance: 0, overall: 0, summary: "Evaluation failed." };
    }
    
    session.metrics.checkTime = (session.metrics.checkTime || 0) + (Date.now() - start)/1000;
    session.qualityResult = result;

    const completeness = result.completeness || 0;
    const accuracy = result.accuracy || 0;
    const balance = result.balance || 0;
    const overallScore = (completeness + accuracy + balance) / 3;
    
    const elapsedSinceStart = Date.now() - (session.generationStartTime || Date.now());
    const timeLeft = this.MAX_GENERATION_TIME - elapsedSinceStart;

    // QUALITY LOOP
    if (overallScore < 0.9 && iteration < 3 && timeLeft > this.REFINE_BUFFER) {
      sendEvent('agent_message', { 
        agent: 'Workflow Monitor', 
        message: `Quality score is ${Math.round(overallScore * 100)}%. Refining further... (${Math.round(timeLeft/1000)}s remaining)`, 
        icon: '♻️' 
      });
      return await this.runBuilder(session, sendEvent, iteration + 1, result.suggestions || []);
    }

    this.finishWorkflow(session, sendEvent);
  }

  finishWorkflow(session, sendEvent, errorMessage = null) {
    const totalTime = ((Date.now() - session.startTime)/1000).toFixed(1);
    const result = session.qualityResult || { completeness: 0, accuracy: 0, balance: 0, overall: 0, summary: errorMessage || "Not evaluated." };
    
    const completeness = result.completeness || 0;
    const accuracy = result.accuracy || 0;
    const balance = result.balance || 0;
    const overallScore = (completeness + accuracy + balance) / 3;

    // Save final learnings
    if (result.learnings && Array.isArray(result.learnings)) {
      result.learnings.forEach(l => saveLearning(l));
    }
    
    if (session.markdown) {
        sendEvent('mindmap_ready', { markdown: session.markdown });
    }

    let summaryString = result.summary || '';
    if (overallScore > 0) {
        summaryString += `\nCompleteness: ${(completeness*100).toFixed(0)}%, Accuracy: ${(accuracy*100).toFixed(0)}%, Balance: ${(balance*100).toFixed(0)}%`;
    }

    sendEvent('workflow_complete', {
      progress: { totalElapsedFormatted: totalTime + "s" },
      feedback: {
        totalTime: totalTime + "s",
        rating: overallScore > 0 ? (Math.round(overallScore * 100) + "% Quality Score") : "N/A",
        summary: summaryString,
        suggestions: result.suggestions || (errorMessage ? ["Try a different provider or check your key."] : ["Review uncertain nodes."])
      }
    });

    session.state = 'COMPLETED';
  }
}

module.exports = OrchestratorAgent;
