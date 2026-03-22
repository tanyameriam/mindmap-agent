# Persistent Learning Mechanism for Mindmap Agent

This plan outlines the addition of a "learning" system that saves improvements from the Quality Checker and uses them to refine future mindmap generations.

## Proposed Changes

### Core Storage
#### [NEW] [storage.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/storage.js)
- A utility to manage reading and writing to `learnings.json`.
- Safely handles JSON parsing and file writing.

---

### API Configuration
#### [MODIFY] [index.html](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/public/index.html)
- Add an optional "Gemini API Key" input field to the start form.
- Use a password-type input for security.

#### [MODIFY] [app.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/public/js/app.js)
- Capture the API key from the frontend and send it in the `/api/start` request.

#### [MODIFY] [server.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/server.js)
- Update session creation to store the user-provided API key.
- Ensure the orchestrator uses this key if it's available.

---

### Quality Iteration Loop
#### [MODIFY] [orchestrator.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/orchestrator.js)
- Add a loop in `runBuilder`/`runChecker` to retry generation if the quality score is < 0.9.
- Limit to 3 iterations.
- Each iteration uses the "suggestions" from the previous run as additional context.

### Agent Style & Context
#### [MODIFY] [classifier.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/classifier.js)
- Refine prompt to ensure "Complete Context" before setting `isAmbiguous` to false.

#### [MODIFY] [orchestrator.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/orchestrator.js)
- Update Knowledge Validator messages to be casual ("Hey, I don't have enough context... but I can try based on what I know!").

### UI Timeline Sidebar
#### [MODIFY] [chat.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/public/js/chat.js)
- New `addTimelineEvent` function to populate the right sidebar.
- Style the right sidebar to look like a vertical timeline.

#### [MODIFY] [app.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/public/js/app.js)
- Redirect `agent_status` and `agent_message` (from Workflow/Orchestrator) to the timeline instead of chat.

### 45-Second High-Quality Optimization
#### [MODIFY] [orchestrator.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/orchestrator.js)
- Implement `MAX_GENERATION_TIME = 45000` (ms) limit starting from `runBuilder`.
- Track `generationStartTime` specifically when entering the creation phase.
- Ensure at least one refinement is attempted if score < 90% and time is under 30s.
- Force delivery of "Best Version" if elapsed time exceeds 42s to ensure the 45s limit is met.

### Multi-Provider AI Support
#### [NEW] [llmService.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/llmService.js)
- Create a unified class to handle requests to Gemini, OpenAI, and Anthropic.
- Map generic `generateJSON` and `generateText` methods to provider-specific SDKs.

#### [MODIFY] [orchestrator.js](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/agents/orchestrator.js)
- Instantiate one `LLMService` per session.
- Pass `provider` and `model` configuration from the UI.

#### [MODIFY] [index.html](file:///c:/Users/TanyaSunny/.gemini/antigravity/scratch/mindmap-agent/public/index.html)
- Add a dropdown for Model Provider (Gemini, OpenAI, Anthropic).
- Add a text input for Model Name (prefilled with defaults like `gemini-1.5-flash`, `gpt-4o`, `claude-3-5-sonnet`).

### Documentation & UI Polish
- Mark Custom AI Configuration as "Optional" in the UI with a section header.
- Expand `agent_logic.md` with detailed agent instructions and a breakdown of the Scoring System purpose.
- Update the Architecture Diagram to include the LLM Service adapter layer.

## Verification Plan

### Automated Tests
1. Generate a mindmap for "Artificial Intelligence".
2. Verify that `learnings.json` is created and populated.
3. Generate a second mindmap for "Quantum Computing" and verify (via logs) that the previous learnings are included in the prompt.

### Manual Verification
- Check the `learnings.json` file manually to ensure it contains meaningful improvements.
