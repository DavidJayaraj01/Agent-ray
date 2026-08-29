# 🚀 AgentReady — Autonomous Commerce Readiness & Growth Platform

**Make any merchant AI-agent-ready** — normalize unstructured catalogs, compute verifiable trust scores, configure deterministic policy guardrails, and enable AI buyer agents to discover, negotiate, and purchase with real-time audit trails and Razorpay test-mode payments.

> **Built for Razorpay Buildathon — Track 01: "AI Growth & Agentic Commerce"**

---

## 🌟 Highlights & Key Innovations

- **🛡️ Pure-Python Deterministic Policy Engine**: Immutable guardrails that ensure LLMs NEVER touch money or order execution directly.
- **⚡ Direct 1-Click Buy Now & Dynamic Price Floors**: Instant checkout at list price, with dynamic sub-₹500 catalog price protection (`effective_min_price = min(policy_min_price, catalog_price)`).
- **🎙️ Multilingual Voice AI Commerce (Sarvam AI)**: End-to-end voice shopping across 11 Indian languages (Hindi, Tamil, Telugu, Kannada, etc.) powered by Saaras v3 STT & Bulbul v3 TTS.
- **📈 Proactive AI Growth Agent & 90-Day GMV Simulator**: Automated category-aware cross-sell bundling, statistical pricing outlier detection (z-scores), and abandoned cart recovery nudges.
- **🤝 Multi-Round Negotiation & WebSocket Streaming**: Real-time proposal streaming with Round 2 counter-offer decision cards (Accept, Counter, Decline).
- **🌐 Protocol Interoperability & Open Manifest Exports**: Native export into **ACP v0.1** (Agent Commerce Protocol) and **schema.org/Product JSON-LD** for open agent ecosystems (UAP, ACP, x402).
- **📜 Tamper-Evident Autonomous Audit Trail**: Every LLM proposal, policy gate check, and settlement is recorded with actor attribution and local 12-hour IST timestamps before responding to clients.
- **🏬 Unified Role Architecture & 1-Click Mode Toggle**: Seamless role switching between **Buyer Mode** and **Merchant Mode** with persistent state across page reloads.
- **🖥️ Full-Width Expansive Responsive UI**: Designed with high-density grids (up to 5-column product catalogs) and expansive layouts (`max-w-[1720px]`).

---

## 📐 System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 18 + TypeScript + Tailwind CSS v4)                 │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ AI Shop    │ │ Negotiation  │ │ Merchant      │ │ AI Growth    │ │ Audit Trail  │ │
│  │ & Discovery│ │ & Buy Now    │ │ Operations    │ │ & Simulator  │ │ & Receipts   │ │
│  └─────┬──────┘ └──────┬───────┘ └───────┬───────┘ └──────┬───────┘ └──────┬───────┘ │
│        │               │                 │                │                │         │
│        └───────────────┴─────────┬───────┴────────────────┴────────────────┘         │
│                      React Query + Zustand (Synchronous Local Hydration)              │
│                                  │                                                   │
│                      ┌───────────┴───────────┐                                       │
│                      │ Razorpay Checkout SDK │                                       │
│                      │ (Test Mode API)       │                                       │
│                      └───────────┬───────────┘                                       │
└──────────────────────────────────┼───────────────────────────────────────────────────┘
                                   │ HTTP / WebSocket Proxy
┌──────────────────────────────────┼───────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + SQLAlchemy + SQLite)                          │
│                                  │                                                   │
│  ┌───────────────────────────────┴────────────────────────────────────────┐          │
│  │                   API ROUTERS & WEBSOCKET ENGINE (14 Modules)          │          │
│  │  merchants · manifest · trust · intent · match · negotiate · ws        │          │
│  │  policy · growth · voice · export · orders · audit · auth · firebase   │          │
│  └───────┬────────────┬────────────┬─────────────┬────────────┬───────────┘          │
│          │            │            │             │            │                      │
│  ┌───────┴────┐ ┌─────┴─────┐ ┌────┴─────┐ ┌─────┴─────┐ ┌────┴─────────┐            │
│  │ Ollama /   │ │ Pure      │ │ Sarvam AI│ │ Razorpay  │ │ Audit Logger │            │
│  │ Gemini LLM │ │ Policy    │ │ Voice STT│ │ Service   │ │ (Pre-Response│            │
│  │ (Intent &  │ │ Engine    │ │ & TTS v3 │ │ (Test     │ │  Attribution,│            │
│  │  Catalog)  │ │ (NO LLM)  │ │ Engine   │ │  Enforced)│ │  IST Time)   │            │
│  └────────────┘ └─────┬─────┘ └──────────┘ └─────┬─────┘ └──────────────┘            │
│                       │                          │                                   │
│                 ┌─────┴──────────────────────────┴─────┐                             │
│                 │          SAFETY GATE PIPELINE        │                             │
│                 │                                      │                             │
│                 │  Buyer Request / Instant Buy Now     │                             │
│                 │                   ↓                  │                             │
│                 │  Policy Engine validates constraints │                             │
│                 │                   ↓                  │                             │
│                 │  ✓ Approved → Razorpay Order ID      │                             │
│                 │  ✕ Blocked  → Red Card (Zero Pay)    │                             │
│                 │                   ↓                  │                             │
│                 │  Audit Log committed to SQLite & RTDB│                             │
│                 └──────────────────────────────────────┘                             │
│                                                                                      │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ SQLite DB      │  │ Trust Scorer     │  │ AI Growth Agent  │  │ Realtime Sync  │  │
│  │ (12 Merchants) │  │ (0–100 Rating)   │  │ (Attach & GMV)   │  │ (Firebase RTDB)│  │
│  └────────────────┘  └──────────────────┘  └──────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Technology Stack

| Layer | Technology | Key Capabilities & Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Type-safe, ultra-fast compilation, zero client-side latency |
| **Styling & Layout** | Tailwind CSS v4 + Vanilla CSS | Modern glassmorphism, 3D buttons, full-width responsive grids |
| **State Management** | Zustand + React Query | Synchronous token hydration on line 1, automated caching |
| **Backend** | FastAPI (Python 3.10+) | High-throughput async REST endpoints & native WebSockets |
| **Database** | SQLite + SQLAlchemy ORM | Local relational storage with `flag_modified` live persistence |
| **Cloud Sync & Auth** | Firebase Auth & Realtime Database | Real-time cross-device sync, Google OAuth token verification |
| **Voice AI Engine** | Sarvam AI (Saaras & Bulbul v3) | Native speech-to-text & text-to-speech across 11 Indian languages |
| **Payments** | Razorpay Test Mode API | HMAC-SHA256 signature verification, strict live-key guardrails |
| **Local LLM** | Ollama (`llama3.2`) / Rule Fallbacks | Zero-cost semantic matching, intent parsing & negotiation |

---

## ⚡ Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Ollama** (optional, for local AI parsing): [ollama.com/download](https://ollama.com/download)

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/DavidJayaraj01/Agent-ray.git
cd Agent-ray

# Create and activate Python virtual environment
python -m venv backend/venv
# Windows:
backend\venv\Scripts\activate
# macOS / Linux:
source backend/venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Configure environment variables
cp backend/.env.example backend/.env
```

### 3. Start Backend Server
```bash
# Launch FastAPI backend on port 8000
uvicorn backend.main:app --reload --port 8000
```
*Note: On first startup, the server automatically initializes SQLite and seeds **12 real-world enterprise merchants** with 161 verified products, manifests, and audit records.*

### 4. Frontend Setup & Launch
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 📱 Application Pages & Routes

### 🛍️ Buyer Experience
1. **Marketplace & Landing (`/`)**: Hero section, enterprise merchant network, category filters, and quick storefront launcher.
2. **AI Autonomous Shop (`/shop`)**: Natural language discovery, parsed intent diagnostic chips, 5-column product grid with agent compatibility scores.
3. **Voice AI Assistant (`/voice`)**: Sarvam AI voice studio with 11 language toggles, real-time waveform recording, and audio playback.
4. **Negotiation & 1-Click Buy (`/shop/negotiate/:productId`)**:
   - `⚡ Buy Now (₹{price})`: Instant direct checkout at list price.
   - `💬 AI Negotiation`: Real-time WebSocket offer stream, Round 2 counter-offer card, and AI Growth cross-sell bundle addons.
5. **My Orders (`/shop/orders`)**: Purchase history with order timestamps (IST), Razorpay payment IDs, and verification statuses.
6. **Payment Receipt (`/shop/receipt/:orderId`)**: Tamper-evident receipt with buyer intent, bundle badges, and Razorpay HMAC verification.

### 🏬 Merchant Experience
7. **Merchant Dashboard (`/merchant/:id/dashboard`)**: Trust score breakdown, catalog metrics, match efficiency chart, and protocol export buttons.
8. **Catalog Manifest Review (`/merchant/:id/manifest`)**: Normalized product inventory, confidence scores, and inline catalog editors.
9. **Policy Guardrail Settings (`/merchant/:id/policy`)**: Maximum discount slider, minimum price floor, max auto-order cap, and instant SQLite persistence.
10. **AI Growth Engine (`/merchant/:id/growth`)**: Cross-sell attach rates, pricing outlier z-scores, cart recovery nudges, and 90-day GMV uplift simulations.
11. **Manual Order Approvals (`/merchant/:id/approvals`)**: Policy queue for reviewing and approving high-value orders exceeding `max_auto_order`.
12. **Autonomous Audit Trail (`/merchant/:id/audit`)**: Full tamper-evident ledger of every LLM proposal, policy gate decision, and local IST timestamp.
13. **Agent-Ready Certificate (`/merchant/:id/certificate`)**: Public badge with animated SVG trust gauge and deterministic SHA-256 verification hash.
14. **Merchant Application (`/merchant/apply`)**: Onboarding portal for new stores to apply for AgentReady certification.

---

## 🛡️ Safety Invariants & Guardrails

1. **Deterministic Execution**: The Policy Engine is written in pure Python. LLMs never make financial decisions or execute payments.
2. **Dynamic Price Floor**: Catalog items listed under ₹500 (e.g. ₹418, ₹449) or purchases at list price are automatically protected and never blocked.
3. **Abuse Rate Limiting**: Max 5 negotiation attempts per product within a 10-minute window. Demands with >50% discount are blocked as anomalies.
4. **Pre-Response Audit Logging**: All actions and policy decisions are written to the append-only ledger before any response is dispatched.
5. **Fail-Closed Payment Safety**: Live Razorpay keys (`rzp_live_*`) are blocked at startup to prevent accidental real-money transactions.

---

## 🧪 Verification & Testing

```bash
# Run backend pytest suite (43 tests)
pytest backend/tests -v

# Run frontend linting & production build
cd frontend
npm run lint
npm run build
```

- **Backend Pytest Suite**: **43 / 43 passed (100%)**
- **Frontend Oxlint**: **0 errors, 0 warnings**
- **TypeScript & Vite Build**: **Production bundle compiled successfully**

---

## 📄 License & Attribution
Built by **David Jayaraj** for the **Razorpay Buildathon — Track 01: AI Growth & Agentic Commerce**.
Licensed under the MIT License.
