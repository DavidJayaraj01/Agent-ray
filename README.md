# 🚀 AgentReady — Agent Commerce Readiness Platform

**Make any merchant AI-agent-ready** — normalize catalogs, compute trust scores, and enable AI agents to discover, negotiate, and purchase with full audit trails and Razorpay test-mode payments.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + TS + Tailwind)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Landing  │ │ AI Shop  │ │ Merchant │ │ Audit Log        │   │
│  │ Page     │ │ (Search) │ │ Dashboard│ │ (Decision Trail) │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
│       │             │            │                 │             │
│       └─────────────┴──────┬─────┴─────────────────┘             │
│                     React Query + Zustand                        │
│                            │                                     │
│                     ┌──────┴──────┐                               │
│                     │ Razorpay    │                               │
│                     │ Checkout    │                               │
│                     │ Widget      │                               │
│                     └──────┬──────┘                               │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTP (Vite Proxy)
┌────────────────────────────┼─────────────────────────────────────┐
│                     BACKEND (FastAPI + SQLite)                    │
│                            │                                     │
│  ┌─────────────────────────┴──────────────────────────┐          │
│  │              API ROUTERS (10 endpoints)             │          │
│  │  merchants · manifest · trust · intent · match      │          │
│  │  negotiate · policy · orders · audit · dashboard    │          │
│  └──────┬──────────┬──────────┬──────────┬────────────┘          │
│         │          │          │          │                        │
│  ┌──────┴───┐ ┌────┴────┐ ┌──┴──────┐ ┌┴──────────┐             │
│  │ Ollama   │ │ Policy  │ │Razorpay │ │ Audit     │             │
│  │ Local LLM│ │ Engine  │ │ Service │ │ Logger    │             │
│  │ (intent, │ │ (PURE   │ │ (test   │ │ (append   │             │
│  │  catalog,│ │ PYTHON, │ │  mode   │ │  only,    │             │
│  │  negoti- │ │ NO LLM) │ │  only)  │ │  before   │             │
│  │  ation)  │ │         │ │         │ │  response)│             │
│  └──────────┘ └────┬────┘ └────┬────┘ └───────────┘             │
│                    │          │                                   │
│              ┌─────┴──────────┴──────┐                           │
│              │   SAFETY GATE FLOW    │                           │
│              │                       │                           │
│              │  LLM proposes offer   │                           │
│              │        ↓              │                           │
│              │  Policy Engine checks │                           │
│              │        ↓              │                           │
│              │  ✓ approved → Razorpay│                           │
│              │  ✕ blocked → NO PAY   │                           │
│              │        ↓              │                           │
│              │  Audit Log records    │                           │
│              └───────────────────────┘                           │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐           │
│  │ SQLite   │  │ Trust        │  │ Catalog          │           │
│  │ Database │  │ Scorer       │  │ Normalizer       │           │
│  └──────────┘  └──────────────┘  └──────────────────┘           │
└──────────────────────────────────────────────────────────────────┘

                     EXTERNAL SERVICES
┌──────────────┐  ┌──────────────────┐
│ Ollama       │  │ Razorpay         │
│ (localhost)  │  │ (Test Mode API)  │
│ llama3.2     │  │ rzp_test_*       │
└──────────────┘  └──────────────────┘
```

### Safety Flow (Critical Path)

```
Buyer Request → LLM Proposes Offer → Policy Engine Validates
                                          │
                                    ┌─────┴─────┐
                                    │           │
                                 APPROVED    BLOCKED
                                    │           │
                              Create Order   Red Card
                              (Razorpay)     (No Pay)
                                    │           │
                                    └─────┬─────┘
                                          │
                                    Audit Log
                                  (BEFORE response)
```

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | UI framework |
| **Styling** | Tailwind CSS v4 | Razorpay Docs aesthetic |
| **Server State** | React Query | API data caching |
| **UI State** | Zustand | Client-side state |
| **Backend** | FastAPI (Python) | REST API |
| **Database** | SQLite + SQLAlchemy | Relational data |
| **LLM** | Ollama (local) | Intent parsing, negotiation, catalog normalization |
| **Payments** | Razorpay Orders API | Test-mode checkout |

---

## ⚡ Quick Start

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Ollama** (optional, for AI features): [ollama.com/download](https://ollama.com/download)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Razorpay test keys

python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Start Backend

```bash
# From project root
uvicorn backend.main:app --reload --port 8000
```

The backend auto-seeds **3 demo merchants** on first startup.

### 3. (Optional) Start Ollama

```bash
# Install Ollama, then:
ollama pull llama3.2
ollama serve
```

Without Ollama, the app uses intelligent rule-based fallbacks.

### 4. Frontend Setup & Start

```bash
# Navigate to frontend directory
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** 🎉

---

## 🎯 Demo Script

### Step 1: Browse the Marketplace
Open `http://localhost:5173` — 3 pre-seeded merchants with trust scores:
- **SportGear Pro** (Score: 93 🟢) — clean catalog
- **Ananya's Fashion Hub** (Score: 78 🟡) — deliberately messy data
- **TechBazaar** (Score: 90+ 🟢) — moderate quality

### Step 2: Onboard a New Merchant
Click **"+ Add Merchant"** → enter details → paste messy CSV → watch AI normalize it in real-time with progress indicators.

### Step 3: Review the Manifest
View normalized products — yellow-flagged fields show low confidence. Click to edit inline, or hit "Approve" to verify.

### Step 4: AI-Powered Shopping
Go to **"AI Shop"** → type natural language:
```
black running shoes under ₹5000, arrive tomorrow
```
See ranked results with match percentages and "why this one" checklists.

### Step 5: Negotiate & Buy
- Click **"Negotiate & Buy"** on any product
- **Reasonable offer** (5% off) → ✅ accepted → proceed to Razorpay checkout
- **Excessive offer** (25% off) → 🚫 **BLOCKED** by policy engine → red card, no payment attempt

### Step 6: Audit Everything
Visit **"Audit"** → see every LLM decision and policy check with timestamps, filterable by merchant or status.

---

## 🛡️ Safety Rules

1. **LLM NEVER directly creates orders** — all money flows through the policy engine
2. **Policy engine is pure Python** — deterministic, no LLM, 22 unit tests
3. **Audit log is append-only** — writes BEFORE any user-facing response
4. **Live Razorpay keys are REJECTED** at startup (only `rzp_test_*` accepted)
5. **Explicit failure test** — discounts exceeding `max_discount` are blocked before reaching Razorpay

### Run Safety Tests
```bash
python -m pytest backend/tests/test_policy_engine.py -v
# 22 tests, all passing ✅
```

---

## 📄 Additional Documentation

- [**Backend README**](backend/README.md) — API reference, data models, service architecture
- [**Frontend README**](docs/FRONTEND.md) — Component guide, page structure, design system

---

## 📁 Project Structure

```
Agent-Ray/
├── backend/
│   ├── main.py              # FastAPI app + startup safety checks
│   ├── database.py          # SQLite + SQLAlchemy setup
│   ├── models.py            # 7 ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── seed_data.py         # 3 synthetic merchants + products
│   ├── .env.example         # Environment variables template
│   ├── requirements.txt     # Python dependencies
│   ├── routers/             # 10 API route files
│   └── services/            # Business logic (LLM, policy, trust, etc.)
├── src/                     # React frontend
│   ├── App.tsx              # Routing + navbar
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind design tokens
│   ├── api/client.ts        # Axios API client
│   ├── stores/uiStore.ts    # Zustand store
│   ├── components/          # Shared UI components
│   └── pages/               # 9 page components
├── README.md                # ← you are here
└── .gitignore
```

---

## 📜 License

Built for the Razorpay hackathon. MIT License.
