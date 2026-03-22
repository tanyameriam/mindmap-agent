# MindMap Agent 🧠✨

An advanced, multi-agent AI system for generating high-quality mind maps. Featuring a provider-agnostic architecture that supports Google Gemini, OpenAI, and Anthropic Claude.

## 🚀 Features

- **Multi-Agent Intelligence**: 5 specialized agents (Context Clarity, Knowledge Validator, Structure Builder, Quality Checker, and Orchestrator) work together to refine every map.
- **Multi-Provider Support**: Switch between **Google Gemini**, **OpenAI**, and **Anthropic** directly from the UI.
- **Quality Iteration Loop**: Automatic refinement targeting "Enterprise Grade" quality (Completeness, Accuracy, Balance).
- **Performance Optimized**: Guaranteed "Best Version" delivery within a **45-second** window.
- **Persistent Learnings**: The system learns from every generation to improve future results.
- **Interactive UI**: Real-time agent timeline, editable chat context, and dynamic Markmap visualization.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Server-Sent Events (SSE).
- **Frontend**: Vanilla JS, Markmap.js (Mermaid-style visualization), Glassmorphism CSS.
- **AI SDKs**: `@google/generative-ai`, `openai`, `@anthropic-ai/sdk`.

## 📥 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tanyameriam/mindmap-agent.git
   cd mindmap-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
   PORT=3001
   ```

## 🏁 How to Run

1. **Start the server**:
   ```bash
   npm start
   ```
2. **Open your browser**:
   Navigate to `http://localhost:3001`

## 🧩 Usage

1. **Topic Input**: Enter a broad or specific topic.
2. **Optional Config**: You can optionally provide your own API key and select a specific model (e.g., `gpt-4o` or `claude-3-5-sonnet`) to bypass system limits.
3. **Refinement**: Interaction with the **Context Clarity Agent** allows you to sharpen the focus before generation begins.
4. **Timeline**: Watch the agents work in real-time in the right-hand sidebar.

## 📄 Documentation

Highly detailed documentation is available in the `docs/` folder:
- **[Architecture & Agent Logic](docs/agent_logic.md)**: Explains the scoring system, diagrams, and agent prompts.
- **[System Walkthrough](docs/walkthrough.md)**: A step-by-step guide with visual demonstrations of the workflow.

---
Built with ❤️ by Tanya Sunny
