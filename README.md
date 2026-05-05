# Atlas Wellness Assistant

A lightweight Node + Express + OpenAI web app. Atlas is a wellness-only assistant for everyday habits, sleep, stress, energy, focus, and routines. It does not provide medical diagnoses or treatments.

## Setup

1. Copy `.env.example` to `.env` (create if missing):
   - `OPENAI_API_KEY=your-openai-key`
   - `OPENAI_MODEL=gpt-4` (optional)
   - `PORT=3000` (optional)
   - `SUPABASE_URL=your-supabase-url`
   - `SUPABASE_KEY=your-supabase-key`

2. Install deps:
   - `npm install`

3. Run:
   - `npm start`

4. Open http://localhost:3000

## API
- `POST /api/chat` with `{ message: string, userId?: string }`.
- `GET /api/history?userId=...`.
- `POST /api/reset` with `{ userId?: string }`.

## Current behavior
- Atlas responds as a wellness assistant only.
- Responses are delivered in English even if the user types in another language.
- Medical diagnosis and treatment requests are redirected to licensed healthcare professionals.
- Messages are stored in Supabase per browser user id, and the frontend restores recent conversation history.

## Next steps
1. Add user auth with Sign in / Sign up.
2. Add explicit crisis and urgent-symptom safety flows.
3. Add analytics and monitoring in production.
4. Add configurable prompt chips and personalized wellness plans.

## System analysis and decomposition
### Use case diagram
```mermaid
flowchart TB
  user([User]):::actor
  UC1([Send wellness question])
  UC2([Receive Atlas guidance])
  UC3([Reset session])
  UC4([View conversation history])
  user --> UC1
  user --> UC2
  user --> UC3
  user --> UC4
  classDef actor fill:#0ea5e9,stroke:#0369a1,color:#fff;
```

### Class diagram (logical)
```mermaid
classDiagram
  class Server {
    +POST /api/chat()
    +GET /api/history()
    +POST /api/reset()
  }
  class ChatController {
    +handleChat()
    -normalizeContent()
    -isGreeting()
    -isMedicalRequest()
  }
  class OpenAIClient {
    +createCompletion()
  }
  class SupabaseClient {
    +ensureUser()
    +getOrCreateSession()
    +getMessages()
    +insertMessage()
    +resetSession()
  }
  class FrontendApp {
    +renderMessages()
    +sendMessage()
    +loadHistory()
    +resetChat()
  }

  Server --> ChatController
  ChatController --> OpenAIClient
  ChatController --> SupabaseClient
  FrontendApp --> Server
```

### Sequence diagram (chat flow)
```mermaid
sequenceDiagram
  participant U as User
  participant F as Frontend (browser)
  participant S as Server (Express)
  participant DB as Supabase
  participant AI as OpenAI

  U->>F: Type message
  F->>S: POST /api/chat {message, userId}
  S->>DB: ensureUser / getOrCreateSession / insertMessage(user)
  S->>AI: chat.completions with system+history
  AI-->>S: assistant message
  S->>DB: insertMessage(assistant)
  S-->>F: {message}
  F-->>U: Render response
```

## Architecture and algorithms
### System architecture
```mermaid
flowchart LR
  subgraph Client
    UI[Frontend SPA\nHTML/CSS/JS]
  end
  subgraph Backend
    API[Express API\n/server.js]
    OpenAI[OpenAI SDK]
    SB[Supabase JS Client]
  end
  subgraph Data
    SupaDB[(Supabase\nPostgres)]
  end
  UI --> API
  API --> OpenAI
  API --> SB
  SB --> SupaDB
```

### Chat handling flow (algorithm)
```mermaid
flowchart TD
  A[Receive POST /api/chat] --> B{message valid?}
  B -- no --> X[400 error]
  B -- yes --> C[ensureUser + session]
  C --> D{greeting?}
  D -- yes --> E[return canned greeting]
  D -- no --> F{medical request?}
  F -- yes --> G[return boundary message]
  F -- no --> H[load recent messages]
  H --> I[call OpenAI with system prompt]
  I --> J[store assistant reply]
  J --> K[return assistant message]
```

## Implementation plan
- **Programming language/runtime**: Node.js 18+, frontend vanilla JS/CSS/HTML.
- **APIs/SDKs**: OpenAI `chat.completions`; Supabase JS client for Postgres persistence.
- **Tools**: npm scripts (`npm start`), node CLI for quick prompts (`npm run cli`), mermaid-ready Markdown for diagrams.
- **Testbed**: local machine with `.env` configured; Supabase project with schema from `supabase/init.sql`; optional mock OpenAI key for dry runs.
- **Verification steps**: start server, send sample chat and reset, confirm history restore; ensure medical requests return boundary message; confirm responses stay in English.
