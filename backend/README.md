# Backend — FastAPI API Reference

## Quick Start
```bash
cd backend
cp .env.example .env
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```

## API Endpoints

### Merchants
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/merchants` | Create merchant + upload raw catalog |
| `GET` | `/api/merchants` | List all merchants |
| `GET` | `/api/merchants/{id}` | Get single merchant |
| `PUT` | `/api/merchants/{id}` | Update merchant |

### Manifest (Catalog Normalization)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/manifest/generate/{merchant_id}` | LLM normalizes raw catalog into manifest |
| `GET` | `/api/manifest/{merchant_id}` | Get manifest + products |
| `PUT` | `/api/products/{product_id}` | Inline edit a product field |

### Trust Score
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/trust/score/{merchant_id}` | Compute trust score from order history |

### Intent & Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/intent` | Buyer NL text → structured constraints |
| `POST` | `/api/match` | Constraints → ranked product matches with % score |

### Negotiation & Policy
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/negotiate` | LLM proposes offer (does NOT touch money) |
| `POST` | `/api/policy/check` | **Deterministic** policy validation (pure Python) |
| `GET` | `/api/policy/{merchant_id}` | Get merchant policy rules |
| `PUT` | `/api/policy/{merchant_id}` | Update policy rules |

### Orders (Razorpay)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/order/create` | Create Razorpay test-mode order (AFTER policy check) |
| `POST` | `/api/order/verify` | Verify Razorpay payment signature |
| `GET` | `/api/orders/{order_id}` | Get order details with product/merchant/negotiation |

### Audit & Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | All audit logs (filterable by merchant/status) |
| `GET` | `/api/audit/{merchant_id}` | Merchant-specific audit logs |
| `GET` | `/api/dashboard/{merchant_id}` | Dashboard analytics + trust breakdown |

---

## Data Models

### Merchant
| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `name` | string | Store name |
| `category` | string | Business category |
| `raw_catalog_text` | text | Original messy catalog data |
| `trust_score` | float | 0-100 computed trust score |
| `status` | string | pending / processing / active |
| `policy_rules` | JSON | `{max_discount, min_price, max_auto_order, negotiation_enabled}` |

### Product
| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `merchant_id` | int | FK → merchants |
| `name` | string | Normalized product name |
| `price` | float | Price in INR |
| `stock` | int | Available quantity |
| `category` | string | Product category |
| `delivery_days` | int | Delivery time |
| `confidence_flags` | JSON | Per-field confidence scores (0.0-1.0) |
| `needs_verification` | bool | True if any field has confidence < 0.7 |

### AuditLog (append-only)
| Field | Type | Description |
|-------|------|-------------|
| `actor` | string | llm / policy / system / buyer |
| `action` | string | What happened (e.g. `negotiation_proposal`) |
| `decision` | string | approved / rejected / blocked / info |
| `reason` | text | Human-readable explanation |
| `input_data` | JSON | What went into the decision |
| `output_data` | JSON | What came out |

---

## Service Architecture

### Policy Engine (`services/policy_engine.py`)
**Pure Python, NO LLM** — the safety gate between proposals and payments.

Checks:
1. Discount within `max_discount` limit
2. Price above `min_price` threshold
3. Order below `max_auto_order` cap
4. Negotiation is enabled

### LLM Service (`services/llm_service.py`)
Uses **Ollama** (local LLM) for:
- Intent parsing (NL → structured constraints)
- Negotiation responses (counter-offers)
- Catalog normalization

Falls back to rule-based logic when Ollama is not running.

### Trust Scorer (`services/trust_scorer.py`)
Weighted score from 4 dimensions:
- Completeness (35%) — product field coverage
- Settlement Consistency (30%) — order success rate
- Dispute Rate (20%) — inverse of disputes
- Freshness (15%) — catalog update recency

---

## Testing

```bash
python -m pytest tests/test_policy_engine.py -v
# 22 tests covering:
#   - Discount limits (within, at, exceeds)
#   - Min price validation
#   - Max order amount
#   - Negotiation enabled/disabled
#   - Full offer validation
#   - Blocked offer never reaches order creation
```
