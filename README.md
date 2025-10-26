# Backend Setup

The backend is a Node.js + Express server that interfaces with a local AI model (LocalAI/Ollama).

## Starting the Backend

```bash
cd backend
npm install    # First time only
npm start      # Production mode
npm run dev    # Development mode with auto-reload
```

The server will start on `http://localhost:5050`.

## API Architecture

The backend uses the following architecture pattern:

```
Request Flow:
Client → Frontend React App
      ↓
Frontend → Backend API (Express)
      ↓
Backend → LocalAI/Ollama (LLM)
      ↓
LLM Response → Backend
      ↓
Backend → Frontend JSON Response
      ↓
Frontend → Display to User
```

## Core Components

### 1. Conversation Management
- Maintains conversation history for context
- Tracks current question index
- Manages interview state

### 2. AI Integration
- Direct HTTP calls to LocalAI API
- Supports streaming and non-streaming responses
- Includes system prompts for consistent behavior

### 3. Summarization Engine
- Processes entire conversation
- Extracts business metrics
- Formats output with markdown
- Logs to server console

## Database Integration Points

The backend is ready for MySQL integration. Key areas to enhance:

### 1. Interview Storage
```javascript
// Add after calling summarizeConversation()
const interview = {
  userId: req.user.id,
  timestamp: new Date(),
  messages: conversationHistory,
  summary: summary,
  status: 'completed'
};
// await db.saveInterview(interview);
```

### 2. User Sessions
```javascript
// Add session tracking
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new MySQLStore(pool)
}));
```

### 3. Historical Data
```javascript
// Query previous interviews
// const history = await db.getUserInterviews(userId);
```

## Configuration

Edit `.env` to configure:

```env
# Server
PORT=5000

# AI Model
AI_API_URL=http://localhost:1234/v1/chat/completions
AI_MODEL=google/gemma-3-12b

# Environment
NODE_ENV=development

# Future: Database
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=password
# DB_NAME=business_agent
```

## API Response Format

All endpoints return JSON responses:

### Success Response
```json
{
  "response": "AI response text",
  "nextQuestion": "Next question or null",
  "questionIndex": 1,
  "totalQuestions": 5
}
```

### Error Response
```json
{
  "error": "Error message description"
}
```

## Logging

Server logs are printed to console and can be piped to a file:

```bash
npm start > logs/server.log 2>&1 &
```

Console includes:
- Server startup info
- API endpoint access
- Conversation summaries
- Error messages
