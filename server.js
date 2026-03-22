require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OrchestratorAgent = require('./agents/orchestrator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const orchestrator = new OrchestratorAgent(process.env.GEMINI_API_KEY);

// Store SSE connections per session
const sseConnections = new Map();

// SSE endpoint
app.get('/api/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send keepalive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 15000);

  sseConnections.set(sessionId, res);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseConnections.delete(sessionId);
  });

  // Send connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);
});

// Helper to send SSE events
function createSendEvent(sessionId) {
  return (type, data) => {
    const connection = sseConnections.get(sessionId);
    if (connection) {
      connection.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }
  };
}

// Start a new session
app.post('/api/start', async (req, res) => {
  const { topic, depth, detailLevel, apiKey, provider, modelName } = req.body;

  if (!topic || !depth || !detailLevel) {
    return res.status(400).json({ error: 'Missing required fields: topic, depth, detailLevel' });
  }

  const sessionId = uuidv4();
  orchestrator.createSession(sessionId, topic, depth, detailLevel, apiKey, provider, modelName);

  res.json({ sessionId });

  // Process after response is sent to allow SSE to connect
  setTimeout(async () => {
    const sendEvent = createSendEvent(sessionId);
    try {
      await orchestrator.processInitial(sessionId, sendEvent);
    } catch (error) {
      console.error('Error processing initial:', error);
      sendEvent('error', { message: error.message });
    }
  }, 1000);
});

// Handle user chat messages
app.post('/api/chat/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;

  const session = orchestrator.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({ status: 'processing' });

  const sendEvent = createSendEvent(sessionId);
  try {
    await orchestrator.processUserResponse(sessionId, message, sendEvent);
  } catch (error) {
    console.error('Error processing response:', error);
    sendEvent('error', { message: error.message });
  }
});

// Get session info
app.get('/api/session/:sessionId', (req, res) => {
  const session = orchestrator.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    state: session.state,
    topic: session.topic,
    depth: session.depth,
    detailLevel: session.detailLevel,
    hasMindmap: !!session.mindmapMarkdown
  });
});

app.listen(PORT, () => {
  console.log(`\n🧠 MindMap Agent Server running at http://localhost:${PORT}\n`);
});
