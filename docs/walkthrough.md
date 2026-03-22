# Mindmap Agent: Manual Execution & History

I have started the `mindmap-agent` server for you. It is currently running at **http://localhost:3001**.

## How to Run it Manually (Without AI)

If you want to run the project yourself in the future, follow these steps:

1.  **Open a Terminal** (Command Prompt or PowerShell).
2.  **Navigate to the project directory**:
    ```bash
    cd c:\Users\TanyaSunny\.gemini\antigravity\scratch\mindmap-agent
    ```
3.  **Start the server**:
    ```bash
    node server.js
    ```
    *Note: If you have `npm` working, you can also use `npm start`.*
4.  **Access the application**:
    Open your browser and go to `http://localhost:3001`.

---

## How to Find Your Conversation History

Your past conversations and the artifacts created (like the ones I'm showing you now) are stored in the following location on your system:

**`C:\Users\TanyaSunny\.gemini\antigravity\brain\`**

Each subfolder in that directory corresponds to a unique conversation ID. You can find:
- **`task.md`**: The task list for that session.
- **`implementation_plan.md`**: The technical plan discussed.
- **`walkthrough.md`**: The final summary of what was done.

You can also see your recent conversation history in the AI assistant UI by clicking on the conversation history icon (usually in the sidebar or top bar).
