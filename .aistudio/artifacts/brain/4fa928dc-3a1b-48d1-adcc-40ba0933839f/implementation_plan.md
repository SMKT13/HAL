# HAL Desk — AI Intelligence & Strategy Copilot

Integrate real-time, server-side Gemini AI into HAL Desk via a dedicated **AI Copilot** tab and contextual intelligence workflows. The system provides multi-agent market deliberation (Technical, Bull, Bear, Risk, and Valuation agents), automated research and filing synthesis grounded with real-time Google Search, and conversational portfolio hedge stress testing.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following capabilities and UI placements have been confirmed based on your requirements:
> - **Primary Capabilities (1, 2, and 4)**: 
>   1. **Strategy Copilot**: Interactive stress test explanations, risk diagnosis, and tailored protective put suggestions for open long futures.
>   2. **Automated Research Analyst**: Generates sourced thesis notes, corporate filing explanations, and catalyst/order-book summaries.
>   4. **Gemini Multi-Agent Deliberation**: Upgrades the research panels from static rules into live Gemini agent analysis with Bull, Bear, Technical, Risk, and Fundamental viewpoints that cite live evidence.
> - **UI Placement**: A dedicated **AI Copilot** tab in the main navigation, with cross-links from Position Desk ("Ask AI Copilot about Hedge") and Research Desk ("Run Live Agent Deliberation").
> - **Real-time Search Grounding**: Enabled via Gemini's native Google Search grounding (`tools: [{ googleSearch: {} }]`) to pull verified real-world HAL developments, Ministry of Defence orders, and GE Aerospace engine delivery updates.

---

### 1. Overview & Core Concept

- **What It Does**: Enhances the personal HAL derivatives and equity desk with an institutional-grade intelligence copilot. Users can conduct multi-agent deliberation on current HAL market structure, test hypothetical price shocks with conversational narrative insights, and generate sourced corporate research notes grounded in live web search data.
- **Target Audience**: An active HAL equity and derivatives trader/investor managing long futures and protective put positions who values verified evidence over generic AI speculation.
- **Key Value**: Replaces isolated manual calculations with unified intelligence: combining live price feeds, Black–Scholes scenario outputs, open book Greeks, and real-time exchange announcements in one cohesive view.

---

### 2. User Experience & Visual Design

- **Navigation & Layout**:
  - A new **AI Copilot** navigation item added to the desktop header and mobile bottom tab bar with an active AI badge.
  - Three specialized sub-modes within the AI Copilot tab:
    1. **Multi-Agent Deliberation**: Live debate and consensus score between 5 specialized analyst personas (Technical, Bull, Bear, Risk Manager, Valuation Specialist).
    2. **Hedge & Risk Copilot**: Interactive chat and scenario analyzer pre-loaded with current open positions (300 futures units, 4500/4300 puts, net delta, and days to expiry).
    3. **Research Synthesis (Search-Grounded)**: One-click research generator that queries Google Search for latest HAL orders, Tejas Mk1A delivery milestones, and earnings dates, outputting verified sourced notes that can be directly saved to the Business Journal.
- **Visual Identity & Theme**:
  - Matches HAL Desk's dark graphite aesthetic (`#0c111b` background, `#141d2b` cards, `#83caff` electric blue accents, `#80dfb0` positive green, and `#ff9f9c` risk red).
  - Clear agent badges with colored borders and thinking/grounding chips indicating retrieved Google Search citations.
  - Transparent prompt templates (e.g. *"Stress test position against -5% drop"*, *"Analyze 4500 PE vs 4300 PE roll"*, *"Search latest Tejas Mk1A deliveries"*).
- **Interactive Feedback**:
  - Progressive streaming response or smooth loading states with real-time status pills (*"Querying Google Search..."*, *"Calculating Greeks..."*, *"Deliberating..."*).
  - Clean error boundaries and fallback to offline snapshot if network/API is temporarily unavailable.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Gemini API via Express (`server.ts`)**
  - *Chosen Approach*: Call `@google/genai` exclusively from Express endpoints (`/api/ai/deliberate`, `/api/ai/copilot`, `/api/ai/research`).
  - *Why*: Complies with AI Studio security guidelines, prevents client-side key leakage, and allows injecting verified portfolio state and market context securely into model prompts.
  - *Alternative Considered*: Client-side SDK calls (rejected: violates security constraints and leaks API tokens).

- **Decision 2: Google Search Grounding for News & Corporate Announcements**
  - *Chosen Approach*: Enable `{ googleSearch: {} }` on the Gemini model configuration.
  - *Why*: Eliminates hallucination on market-sensitive dates, contract award numbers, and Q2 FY27 earnings board meeting notices.
  - *Alternative Considered*: Static knowledge base (rejected: trader needs current October 2026 events and news).

- **Decision 3: Retaining Deterministic Models as the Factual Anchor**
  - *Chosen Approach*: The AI Copilot receives the actual Black–Scholes marks, current portfolio Greeks, and calculated pivot levels as factual JSON system context.
  - *Why*: Ensures the LLM cannot hallucinate option prices, delta numbers, or P&L amounts—it interprets and stress-tests verified calculations.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Frontend (Port 3000)                      │
│                                                                        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────┐  │
│  │ OverviewView │   │PositionsView │   │ MarketsView  │   │ AICopilot│ │
│  └──────┬───────┘   └──────┬───────┘   └──────────────┘   └────┬────┘  │
│         │                  │                                   │       │
│         └──────────────────┼───────────────────────────────────┘       │
│                            ▼                                           │
│               Portfolio State & Context Hook                           │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ HTTP POST (/api/ai/...)
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend (server.ts)                     │
│                                                                        │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │ Market Data & Greeks │───►│ Context Enrichment:                  │  │
│  │ Yahoo / Snapshot Cache│   │ (Spot, Delta, P&L, Hedges, Levels)   │  │
│  └──────────────────────┘    └──────────────────┬───────────────────┘  │
│                                                 │                      │
│                                                 ▼                      │
│                           ┌─────────────────────────────────────────┐  │
│                           │ @google/genai SDK (gemini-3.8-flash)    │  │
│                           │ Config: tools: [{ googleSearch: {} }]   │  │
│                           │ User-Agent: 'aistudio-build'            │  │
│                           └─────────────────────┬───────────────────┘  │
└─────────────────────────────────────────────────┼──────────────────────┘
                                                  │
                                                  ▼
                                      Google Gemini API Server
```

#### Endpoints to Implement in `server.ts`:
1. `POST /api/ai/deliberate`: Runs multi-agent debate (Technical, Bull, Bear, Risk, Valuation) analyzing live market structure and sentiment.
2. `POST /api/ai/copilot`: Conversational portfolio reasoning and stress-test recommendations given the user's active futures and put basket.
3. `POST /api/ai/research`: Grounded Google Search synthesis for recent HAL news, disclosures, and order book pipeline updates, with direct "Save to Journal" capability.

#### Dependencies:
- `@google/genai` SDK added to `package.json` dependencies.
