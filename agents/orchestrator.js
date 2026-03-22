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
    this.MAX_GENERATION_TIME = 45000; // 45 seconds target for "Best Output"
    this.REFINE_BUFFER = 12000; // Minimum time needed for another refinement (Build + Check)
  }

  createSession(id, topic, depth, detailLevel, apiKey, provider = 'google', modelName = 'gemini-1.5-flash') {
    const sessionApiKey = apiKey || this.defaultApiKey;
    const llmService = new LLMService(provider, modelName, sessionApiKey);

    this.sessions.set(id, { 
      id, topic, originalTopic: topic, depth, detailLevel, state: 'CLASSIFYING',
      domain: null, purpose: null, uncertainAreas: [], metrics: {}, context: "",
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
    
    await this.runChecker(session, sendEvent, iteration);
  }

  async runChecker(session, sendEvent, iteration) {
    session.state = 'CHECKING';
    sendEvent('agent_status', { agent: 'Workflow Monitor', message: 'Evaluating quality metrics...' });
    
    const start = Date.now();
    const result = await session.agents.checker.checkQuality(session.topic, session.markdown);
    session.metrics.checkTime = (session.metrics.checkTime || 0) + (Date.now() - start)/1000;
    
    const completeness = result.completeness || 0.7;
    const accuracy = result.accuracy || 0.8;
    const balance = result.balance || 0.6;
    const overallScore = (completeness + accuracy + balance) / 3;
    const elapsedSinceStart = Date.now() - session.generationStartTime;
    const timeLeft = this.MAX_GENERATION_TIME - elapsedSinceStart;

    // QUALITY LOOP: If score < 0.9 and we have iterations left AND time budget!
    if (overallScore < 0.9 && iteration < 3 && timeLeft > this.REFINE_BUFFER) {
      sendEvent('agent_message', { 
        agent: 'Workflow Monitor', 
        message: `Quality score is ${Math.round(overallScore * 100)}%. Refining further... (${Math.round(timeLeft/1000)}s remaining in budget)`, 
        icon: '♻️' 
      });
      await new Promise(r => setTimeout(r, 500)); // Optimized delay
      return await this.runBuilder(session, sendEvent, iteration + 1, result.suggestions || []);
    } else if (overallScore < 0.9 && timeLeft <= this.REFINE_BUFFER) {
      sendEvent('agent_message', { 
        agent: 'Workflow Monitor', 
        message: `Quality score is ${Math.round(overallScore * 100)}%. Delivering best version now to meet 45s window.`, 
        icon: '⏱️' 
      });
    }

    // Save final learnings
    if (result.learnings && Array.isArray(result.learnings)) {
      result.learnings.forEach(l => saveLearning(l));
    }
    
    const totalTime = ((Date.now() - session.startTime)/1000).toFixed(1);

    // Provide the final markdown output
    sendEvent('mindmap_ready', { markdown: session.markdown });

    let summaryString = result.summary || '';
    summaryString += `\nCompleteness: ${(completeness*100).toFixed(0)}%, Accuracy: ${(accuracy*100).toFixed(0)}%, Balance: ${(balance*100).toFixed(0)}%`;

    sendEvent('workflow_complete', {
      progress: {
         totalElapsedFormatted: totalTime + "s"
      },
      feedback: {
        totalTime: totalTime + "s",
        rating: Math.round(overallScore * 100) + "% Quality Score",
        summary: summaryString,
        suggestions: result.suggestions || ["Review uncertain nodes."]
      }
    });

    session.state = 'COMPLETED';
  }
}

module.exports = OrchestratorAgent;
