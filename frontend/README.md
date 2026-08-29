# Frontend — React + TypeScript + Tailwind CSS

## Quick Start
```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

> Backend must be running on port 8000. Vite proxies `/api` requests automatically.

---

## Design System

Matches the **Razorpay Docs** aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#2563EB` | CTAs, links, active states |
| `--color-primary-light` | `#3395FF` | Hover states, accents |
| `--color-hero-start` | `#EAF2FF` | Hero gradient start |
| `--color-surface` | `#FFFFFF` | Card backgrounds |
| `--color-surface-alt` | `#F7F9FC` | Section backgrounds |
| `--color-border` | `#E5E9F0` | Card borders, dividers |
| `--color-success` | `#22C55E` | Trust ≥80, approved states |
| `--color-warning` | `#F59E0B` | Trust 50-80, needs review |
| `--color-danger` | `#EF4444` | Trust <50, blocked states |

**Typography**: Inter (Google Fonts), large bold headlines (text-5xl hero), generous spacing.

**Cards**: `rounded-2xl`, `shadow-sm`, `border border-border`, white background.

**Buttons**: `rounded-lg`, primary blue fill, secondary white with border.

---

## Pages (12 total)

### 1. Landing / Marketplace (`/`)
- Gradient hero with search bar (rounded-full)
- Merchant grid with trust score badges
- "How It Works" section

### 2. Merchant Onboarding (`/merchant/new`)
- 3-step wizard: Details → Catalog Upload → Live Processing
- File upload or paste raw CSV/text
- Animated progress indicators

### 3. Manifest Review (`/merchant/:id/manifest`)
- Expandable product table
- Yellow-flagged fields (confidence < 0.7)
- Inline edit + approve buttons

### 4. Merchant Dashboard (`/merchant/:id/dashboard`)
- Trust score breakdown (4 mini progress bars)
- Before/after bar chart (Recharts)
- Quick links to **AI Growth Engine**, **Agent-Ready Certificate**, **ACP/schema.org exports**
- Recent AI activity feed

### 5. Policy Settings (`/merchant/:id/policy`)
- Max discount slider
- Min price input
- Max auto-order input
- Negotiation enabled toggle
- Safety notice card

### 6. Buyer Search (`/shop`)
- Chat-style NL input
- Parsed intent chips
- Ranked product cards with match % and reason checklists

### 7. Negotiation + Checkout (`/shop/negotiate/:productId`)
- **Real-Time WebSocket Streaming**: Delivers live frames of proposal, AI deliberation, and policy checks
- **Second Negotiation Round**: Interactive counter-offer decision panel (accept counter, propose Round 2 revised offer, or decline)
- **AI Growth Upsell & Cross-sell**: 1-click bundle expansion before payment
- **Policy Engine Gate**: Deterministic pass/blocked status
- **Razorpay Payment Widget**: Test mode payment execution
- **Blocked State**: Exact policy violation reason, no payment attempt

### 8. Receipt (`/shop/receipt/:orderId`)
- AI Commerce Receipt layout
- Buyer intent → product → negotiation delta → cross-sell bundle badge → authorization → payment

### 9. Audit Log (`/admin/audit`)
- Filterable by merchant and decision status
- Expandable rows with input/output JSON
- Color-coded decisions

### 10. Sarvam AI Voice Assistant (`/voice`)
- Multi-lingual speech input across 11 Indian languages (Hindi, Tamil, Telugu, etc.)
- Live microphone recording with audio waveform visualization
- STT via Sarvam **Saaras v3** & TTS spoken summaries via Sarvam **Bulbul v3**
- Immediate matched product cards

### 11. AI Growth Dashboard (`/merchant/:id/growth`)
- Proactive cross-sell opportunities with category attach rates
- Category pricing outlier analysis ($z$-score deviations)
- Policy-gated abandoned-cart recovery nudges
- 90-day GMV simulation: baseline organic vs. agent-assisted revenue comparison bar chart

### 12. Agent-Ready Certificate (`/merchant/:id/certificate`)
- Shareable public certification badge page
- Animated SVG trust score ring gauge (0–100)
- Tier certifications: Platinum, Gold, Silver, Bronze
- Deterministic SHA-256 verification hash and capability checklist
- "Copy Certificate URL" for merchant embed / sharing

---

## Components (`src/components/index.tsx`)

| Component | Props | Description |
|-----------|-------|-------------|
| `TrustBadge` | `score: number` | Color-coded badge (green/yellow/red) |
| `MerchantCard` | `merchant, onClick` | Card with avatar, trust badge, status |
| `ProductCard` | `product, matchScore, matchReasons, onNegotiate` | Product with match checklist |
| `SearchBar` | `value, onChange, onSubmit, placeholder` | Razorpay-style rounded search |
| `TrustBreakdownBar` | `label, value` | Mini progress bar with percentage |
| `Spinner` | — | Loading spinner |
| `EmptyState` | `icon, title, description` | Empty state placeholder |

---

## State Management

### Server State (React Query)
All API data fetched via `src/api/client.ts` with automatic caching and refetching.

### UI State (Zustand)
`src/stores/uiStore.ts` manages:
- Search query
- Active tab
- Sidebar toggle
- Toast notifications (auto-dismiss after 4s)

---

## Build
```bash
npm run build
# Output: dist/ (730KB JS + 29KB CSS gzipped to ~220KB)
```
