/**
 * Main App module — orchestrates the session, SSE, and user interactions
 */
const App = (() => {
  let sessionId = null;
  let eventSource = null;
  let statusMessageId = null;

  function init() {
    Chat.initInputAutoResize();
    bindEvents();
    initModelSelector();
  }

  function bindEvents() {
    // Start form
    document.getElementById('startForm').addEventListener('submit', handleStart);

    // Chat input
    document.getElementById('sendBtn').addEventListener('click', handleSend);
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Download PDF
    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
      MindMap.downloadPDF();
    });

    // New session
    document.getElementById('newSessionBtn').addEventListener('click', resetSession);
  }

  async function handleStart(e) {
    e.preventDefault();

    const topic = document.getElementById('topicInput').value.trim();
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const provider = document.getElementById('providerInput').value;
    const modelName = document.getElementById('modelInput').value.trim();
    const depth = document.getElementById('depthInput').value;
    const detailLevel = document.getElementById('detailInput').value;

    if (!topic) return;

    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Initializing agents...';

    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic, 
          depth: parseInt(depth), 
          detailLevel, 
          apiKey, 
          provider, 
          modelName 
        })
      });

      const data = await res.json();
      sessionId = data.sessionId;

      // Switch to main app
      document.getElementById('startScreen').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      document.getElementById('sessionTopic').textContent = `Topic: ${topic}`;

      // Connect SSE
      connectSSE(sessionId, provider, modelName);

      // Add welcome message
      Chat.addAgentMessage(
        'Orchestrator',
        `Starting analysis of "${topic}" with ${depth} levels of depth (${detailLevel} detail). Our agents are now working...`,
        '🎯'
      );

      // Show typing
      Chat.showTyping('Context Clarity Agent is analyzing...');
      setAgentActive('clarity');

    } catch (err) {
      console.error('Start error:', err);
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Generate Mind Map';
      alert('Failed to start session. Please check if the server is running.');
    }
  }

  function connectSSE(sid, provider, modelName) {
    if (eventSource) eventSource.close();

    // Add initial session info to timeline
    const displayModel = modelName || (provider === 'google' ? 'gemini-1.5-flash' : 'default');
    Chat.addTimelineItem('System', `Session started using ${provider} (${displayModel})`, 'completed', '🚀');

    eventSource = new EventSource(`/api/stream/${sid}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleSSEEvent(data);
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };
  }

  function handleSSEEvent(data) {
    switch (data.type) {
      case 'connected':
        console.log('SSE connected:', data.sessionId);
        break;

      case 'agent_status':
        Chat.addTimelineItem(data.agent, data.message, 'active');
        Chat.showTyping(`${data.agent} is working...`);

        // Update agent indicators
        if (data.agent.includes('Clarity')) setAgentActive('clarity');
        else if (data.agent.includes('Generator') || data.agent.includes('Mind Map')) setAgentActive('generator');
        else if (data.agent.includes('Monitor')) setAgentActive('monitor');
        break;

      case 'agent_message':
        Chat.hideTyping();
        // If it's a system agent (Orchestrator or Workflow Monitor), show in timeline
        if (data.agent === 'Orchestrator' || data.agent === 'Workflow Monitor') {
            Chat.addTimelineItem(data.agent, data.message, 'active');
        } else {
            Chat.addAgentMessage(data.agent, data.message, data.icon);
        }
        break;

      case 'clarification_questions':
        Chat.hideTyping();
        if (statusMessageId) {
          Chat.removeStatus(statusMessageId);
          statusMessageId = null;
        }
        Chat.addClarificationQuestions(data.questions);
        clearAllAgentActive();
        break;

      case 'workflow_update':
        Chat.addWorkflowUpdate(data);
        setAgentActive('monitor');
        break;

      case 'mindmap_ready':
        Chat.hideTyping();
        if (statusMessageId) {
          Chat.removeStatus(statusMessageId);
          statusMessageId = null;
        }
        MindMap.render(data.markdown);
        setAgentActive('generator');
        break;

      case 'workflow_complete':
        Chat.addWorkflowComplete(data);
        clearAllAgentActive();
        Chat.disableInput();
        break;

      case 'error':
        Chat.hideTyping();
        if (statusMessageId) {
          Chat.removeStatus(statusMessageId);
          statusMessageId = null;
        }
        Chat.addAgentMessage('System', `Error: ${data.message}`, '❌');
        Chat.enableInput();
        clearAllAgentActive();
        break;
    }
  }

  async function handleSend() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !sessionId) return;

    Chat.addUserMessage(message);
    input.value = '';
    input.style.height = 'auto';
    Chat.disableInput();
    Chat.showTyping('Context Clarity Agent is evaluating...');
    setAgentActive('clarity');

    try {
      await fetch(`/api/chat/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
    } catch (err) {
      console.error('Send error:', err);
      Chat.hideTyping();
      Chat.addAgentMessage('System', 'Failed to send message. Please try again.', '❌');
      Chat.enableInput();
    }
  }

  function setAgentActive(agent) {
    clearAllAgentActive();
    const id = `ind-${agent}`;
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function clearAllAgentActive() {
    document.querySelectorAll('.indicator').forEach(el => el.classList.remove('active'));
  }

  function resetSession() {
    if (eventSource) eventSource.close();
    sessionId = null;
    statusMessageId = null;

    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');

    const btn = document.getElementById('startBtn');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Generate Mind Map';
    document.getElementById('topicInput').value = '';

    Chat.clearMessages();
    Chat.hideTyping();
    Chat.disableInput();
    MindMap.reset();
    clearAllAgentActive();
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function initModelSelector() {
    const providerSelect = document.getElementById('providerInput');
    const modelSelect = document.getElementById('modelInput');

    const models = {
      google: [
        { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash (Default)' },
        { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro', text: 'Gemini 1.5 Pro' },
        { value: 'gemini-2.0-flash-exp', text: 'Gemini 2.0 Flash Exp' }
      ],
      openai: [
        { value: 'gpt-4o', text: 'GPT-4o (Recommended)' },
        { value: 'gpt-4o-mini', text: 'GPT-4o Mini' },
        { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
        { value: 'o1-preview', text: 'o1 Preview' }
      ],
      anthropic: [
        { value: 'claude-3-5-sonnet-latest', text: 'Claude 3.5 Sonnet (Recommended)' },
        { value: 'claude-3-5-haiku-latest', text: 'Claude 3.5 Haiku' },
        { value: 'claude-3-opus-latest', text: 'Claude 3 Opus' }
      ]
    };

    providerSelect.addEventListener('change', () => {
      const selectedProvider = providerSelect.value;
      const options = models[selectedProvider] || [];

      modelSelect.value = options[0]?.value || '';
      document.getElementById('modelOptions').innerHTML = options
        .map(opt => `<option value="${opt.value}">${opt.text}</option>`)
        .join('');
    });
  }

  return { init, resetSession };
})();

console.log('🚀 MindMap App Module Loaded');
