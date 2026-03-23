/**
 * Chat module — handles message rendering, typing indicators, and chat interactions
 */
const Chat = (() => {
  const messagesContainer = () => document.getElementById('chatMessages');
  const metricsContainer = () => document.getElementById('metricsContent') || document.getElementById('chatMessages');
  const typingIndicator = () => document.getElementById('typingIndicator');
  const chatInput = () => document.getElementById('chatInput');
  const sendBtn = () => document.getElementById('sendBtn');

  function getTimeString() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getAgentStyles(agent) {
    if (!agent) return { avatarClass: 'user-avatar', nameClass: '', icon: '👤' };
    const lower = agent.toLowerCase();
    if (lower.includes('clarity')) return { avatarClass: 'clarity', nameClass: 'clarity-name', icon: '🔍' };
    if (lower.includes('generator') || lower.includes('mind map')) return { avatarClass: 'generator', nameClass: 'generator-name', icon: '🧠' };
    if (lower.includes('monitor') || lower.includes('workflow')) return { avatarClass: 'monitor', nameClass: 'monitor-name', icon: '⏱️' };
    return { avatarClass: 'clarity', nameClass: 'clarity-name', icon: '🤖' };
  }

  function addAgentMessage(agent, message, icon) {
    const styles = getAgentStyles(agent);
    const el = document.createElement('div');
    el.className = 'message agent';
    el.innerHTML = `
      <div class="message-avatar ${styles.avatarClass}">${icon || styles.icon}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-agent-name ${styles.nameClass}">${agent}</span>
          <span class="message-time">${getTimeString()}</span>
        </div>
        <div class="message-content">${escapeHtml(message)}</div>
      </div>
    `;
    messagesContainer().appendChild(el);
    scrollToBottom();
  }

  function addUserMessage(message) {
    const el = document.createElement('div');
    el.className = 'message user';
    el.innerHTML = `
      <div class="message-avatar user-avatar">👤</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-agent-name">You</span>
          <span class="message-time">${getTimeString()}</span>
        </div>
        <div class="message-content">${escapeHtml(message)}</div>
      </div>
    `;
    messagesContainer().appendChild(el);
    scrollToBottom();
  }

  function addClarificationWizard(question, index, total) {
    const styles = getAgentStyles('clarity');
    const el = document.createElement('div');
    el.className = 'message agent wizard-message';
    el.innerHTML = `
      <div class="message-avatar ${styles.avatarClass}">${styles.icon}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-agent-name ${styles.nameClass}">Context Clarity Agent</span>
          <span class="message-time">${getTimeString()}</span>
        </div>
        <div class="message-content">
          <span class="wizard-counter">Question ${index + 1} of ${total}</span>
          <div class="wizard-question-text">${escapeHtml(question)}</div>
        </div>
      </div>
    `;
    messagesContainer().appendChild(el);
    scrollToBottom();
    enableInput();
  }

  function addClarificationChoice(data) {
    const styles = getAgentStyles('clarity');
    const el = document.createElement('div');
    el.className = 'message agent';
    el.innerHTML = `
      <div class="message-avatar ${styles.avatarClass}">${styles.icon}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-agent-name ${styles.nameClass}">Context Clarity Agent</span>
          <span class="message-time">${getTimeString()}</span>
        </div>
        <div class="message-content">
          ${escapeHtml(data.message)}
          <div class="chat-shortcuts" style="margin-top: 12px; display: flex; gap: 8px;">
            ${data.options.map(opt => `
              <button class="shortcut-btn" onclick="window.App.handleChoice('${escapeHtml(opt).replace(/'/g, "\\'")}')">
                ${escapeHtml(opt)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    messagesContainer().appendChild(el);
    scrollToBottom();
  }

  function addTimelineItem(agent, message, status = 'active', icon = '') {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    // Deactivate previous active items
    if (status === 'active') {
      container.querySelectorAll('.timeline-item.active').forEach(el => {
        el.classList.remove('active');
        el.classList.add('completed');
      });
    }

    const el = document.createElement('div');
    el.className = `timeline-item ${status}`;
    const time = getTimeString();
    el.innerHTML = `
      <div class="timeline-dot-wrapper">
        <div class="timeline-dot"></div>
      </div>
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-agent">${icon ? icon + ' ' : ''}${escapeHtml(agent)}</div>
          <div class="timeline-time">${time}</div>
        </div>
        <div class="timeline-message">${escapeHtml(message)}</div>
      </div>
    `;
    container.appendChild(el);
    scrollToMetricsBottom();
    return el;
  }

  function addStatusMessage(message) {
    return addTimelineItem('System', message, 'active');
  }

  function addWorkflowUpdate(data) {
    return addTimelineItem('Workflow Monitor', data.message, 'active');
  }

  function addWorkflowComplete(data) {
    const { feedback, progress } = data;
    const el = document.createElement('div');
    el.className = 'workflow-complete';

    const suggestionsHtml = (feedback.suggestions || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
    const rating = feedback.rating.includes('0%') ? 'N/A' : feedback.rating;

    el.innerHTML = `
      <div class="workflow-complete-header">
        <span>📊</span>
        <span>Workflow Summary</span>
      </div>
      <div class="workflow-stats">
        <div class="workflow-stat">
          <div class="workflow-stat-label">Total Time</div>
          <div class="workflow-stat-value">${feedback.totalTime || progress.totalElapsedFormatted}</div>
        </div>
        <div class="workflow-stat">
          <div class="workflow-stat-label">Rating</div>
          <div class="workflow-stat-value">${rating}</div>
        </div>
      </div>
      <div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${rating !== 'N/A' ? escapeHtml(feedback.summary) : 'Could not evaluate quality metrics.'}</div>
      ${suggestionsHtml ? `
        <ul class="workflow-suggestions">${suggestionsHtml}</ul>
      ` : ''}
    `;
    clearMetricsPlaceholder();
    metricsContainer().appendChild(el);
    scrollToMetricsBottom();
  }

  function clearMetricsPlaceholder() {
    const c = metricsContainer();
    if (c && c.innerHTML.includes('Workflow status and final metrics')) {
      c.innerHTML = '';
    }
  }

  function showTyping(text) {
    const ti = typingIndicator();
    ti.classList.remove('hidden');
    ti.querySelector('.typing-text').textContent = text || 'Agent is thinking...';
  }

  function hideTyping() {
    typingIndicator().classList.add('hidden');
  }

  function enableInput() {
    chatInput().disabled = false;
    sendBtn().disabled = false;
    chatInput().focus();
  }

  function disableInput() {
    chatInput().disabled = true;
    sendBtn().disabled = true;
  }

  function scrollToBottom() {
    const container = messagesContainer();
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  function scrollToMetricsBottom() {
    const container = metricsContainer();
    requestAnimationFrame(() => {
      if(container) container.scrollTop = container.scrollHeight;
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function clearMessages() {
    messagesContainer().innerHTML = '';
    const m = metricsContainer();
    if(m && m.id === 'metricsContent') {
      m.innerHTML = '<div style="font-size:13px; color:var(--text-muted); text-align:center; margin-top:40px;">Workflow status and final metrics will appear here.</div>';
    }
  }

  // Auto-resize textarea
  function initInputAutoResize() {
    const input = chatInput();
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }

  return {
    addAgentMessage,
    addUserMessage,
    addClarificationWizard,
    addClarificationChoice,
    addStatusMessage,
    addWorkflowUpdate,
    addWorkflowComplete,
    addTimelineItem,
    showTyping,
    hideTyping,
    enableInput,
    disableInput,
    clearMessages,
    initInputAutoResize
  };
})();
