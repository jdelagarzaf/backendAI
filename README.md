# Billy AI API (LocalAI/Ollama)

> Part of the **Billy** ecosystem.
>
> **Project Links:** [CRM for Billy App (Frontend)](https://github.com/danielara071/billy) • [API for Billy Web](https://github.com/German-coder07/HackMTYAPIwebapp) • **[API for Billy AI (this repo)](https://github.com/jdelagarzaf/backendAI)**

---

## Overview

This backend powers the **AI assistant** for the [CRM for Billy App](https://github.com/danielara071/billy), handling natural language interactions, business conversation summarization, and insight extraction using **LocalAI/Ollama** models.

It complements the [Billy Web API](https://github.com/German-coder07/HackMTYAPIwebapp), which provides core CRUD operations and analytics. Together, both backends form the data and intelligence layers that serve the Billy ecosystem.

---

## Starting the Backend

```bash
cd backend
npm install    # First time only
npm start      # Production mode
npm run dev    # Development mode with auto-reload
```

The AI server runs by default at `http://localhost:5050` and communicates with the [CRM frontend](https://github.com/danielara071/billy) and [Billy Web API](https://github.com/German-coder07/HackMTYAPIwebapp) to process user requests.

> 💡 Make sure both the **Web API** and **AI API** are running simultaneously for full app functionality.

---

## Architecture

The system follows this architecture pattern:

```
Request Flow:
Client → Frontend React App (CRM for Billy)
      ↓
Frontend → Billy Web API (data & CRUD)
      ↓
Web API → Billy AI API (LocalAI/Ollama)
      ↓
LLM Response → Billy AI API
      ↓
Billy AI API → Frontend JSON Response
      ↓
Frontend → Display to User
```

---

## Core Components

### 1. Conversation Management

* Maintains conversation history for context.
* Tracks current question index and state.
* Supports structured interviews for business data collection.

### 2. AI Integration

* Uses **HTTP requests** to communicate with the **LocalAI API** (Ollama-compatible endpoint).
* Supports both streaming and non-streaming responses.
* Applies system prompts for consistent and contextual AI behavior.

### 3. Summarization Engine

* Processes full conversation histories.
* Extracts business metrics such as income, inventory status, and transactions.
* Produces clean, markdown-formatted summaries.
* Logs results to the server console.

---

## Integration Points with Web API

This backend enhances the [Billy Web API](https://github.com/German-coder07/HackMTYAPIwebapp) through:

* **AI-Powered Analytics:** Summaries generated here can be stored or analyzed via the Web API.
* **Shared Data Models:** Future versions will allow unified storage of conversation logs and interview summaries in MySQL.
* **Collaborative Endpoints:** The `/chat` and `/summarize` routes in this service correspond to features consumed by the frontend’s “Billy IA Assistant.”

---

## Database Integration (Planned)

Although primarily AI-focused, this backend is structured for MySQL integration with the same database as the Web API.

### Example Implementation Points

```javascript
// Store interview after summarization
const interview = {
  userId: req.user.id,
  timestamp: new Date(),
  messages: conversationHistory,
  summary: summary,
  status: 'completed'
};
// await db.saveInterview(interview);
```

### User Sessions

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new MySQLStore(pool)
}));
```

### Historical Queries

```javascript
// const history = await db.getUserInterviews(userId);
```

---

## Configuration

Example `.env` file:

```env
# Server
PORT=5050

# AI Model (LocalAI / Ollama)
AI_API_URL=http://localhost:1234/v1/chat/completions
AI_MODEL=google/gemma-3-12b

# Environment
NODE_ENV=development

# Future Database Config (shared with Billy Web API)
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=password
# DB_NAME=business_agent
```

---

## API Response Format

### Success

```json
{
  "response": "AI response text",
  "nextQuestion": "Next question or null",
  "questionIndex": 1,
  "totalQuestions": 5
}
```

### Error

```json
{
  "error": "Error message description"
}
```

---

## Logging

Logs provide insight into server operations, including startup, endpoint calls, and AI conversation summaries.

```bash
npm start > logs/server.log 2>&1 &
```

Typical console output includes:

* Server startup info
* Incoming API requests
* LLM responses and summaries
* Error traces

---

## Relation to Other Repositories

| Layer               | Repository                                                          | Purpose                                                        |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Frontend**        | [CRM for Billy App](https://github.com/danielara071/billy)          | React interface where users interact with Billy.               |
| **Business Logic**  | [Billy Web API](https://github.com/German-coder07/HackMTYAPIwebapp) | Manages database, analytics, and reporting.                    |
| **AI Intelligence** | [Billy AI API](https://github.com/jdelagarzaf/backendAI)            | Handles conversational AI, summarization, and recommendations. |

---

## Future Enhancements

* Full MySQL integration shared with the Web API.
* User-level interview history storage.
* AI model switching and fine-tuning through configuration.
* REST + WebSocket streaming hybrid for live responses.

---

README updated for integration with the **Billy ecosystem** (Frontend + Web API + AI API) — *October 26, 2025*.
