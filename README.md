# Order Exception Control Tower

**Internship Project** — Full-stack e-commerce order management with exception detection and n8n automation.

---

## Architecture

```
Browser (HTML/CSS/JS)
       │  fetch() requests
       ▼
Flask Backend (Python 3.13)  ◄──── n8n Workflow (localhost:5678)
       │  mysql-connector                │  Webhook POST
       ▼                                │
MySQL 8.0 Database                      │
  order_exception_control_tower         │
       │                                │
       └──────────────────────────────► ┘
         /api/webhooks/order-event
```

### Services
| Service  | Local URL               | Docker URL             |
|----------|-------------------------|------------------------|
| Frontend | `file://frontend/index.html` | `http://localhost:8080` |
| Flask API| `http://localhost:5000` | `http://localhost:5000` |
| MySQL    | `localhost:3306`        | `localhost:3307`       |
| n8n      | `http://localhost:5678` | existing N8N container |

---

## Quick Start (Local Development — Recommended for Internship)

### Prerequisites
- Python 3.13
- MySQL 8.0 running locally (root/root or edit `.env`)
- n8n Docker container (existing `N8N`)

### 1. Install dependencies
```powershell
cd backend
pip install -r requirements.txt
```

### 2. Configure environment
```powershell
cd ..   # project root
copy .env.example .env
# Edit .env with your MySQL password
```

Default `.env` assumes: `root` / `root` on `127.0.0.1:3306`

### 3. Initialize the database
```powershell
cd backend
python -c "from database import init_db; init_db()"
```

### 4. Start Flask
```powershell
python app.py
```
Backend runs at: **http://localhost:5000**

### 5. Open the frontend
Open `frontend/index.html` directly in your browser, **or** use a simple server:
```powershell
cd frontend
python -m http.server 8000
```
Then visit: **http://localhost:8000**

### 6. Start n8n
```powershell
docker start N8N
```
n8n UI: **http://localhost:5678**

Import the workflow: `n8n/order_event_workflow.json`  
See: [`n8n/IMPORT_INSTRUCTIONS.md`](n8n/IMPORT_INSTRUCTIONS.md)

---

## Docker Compose (Full Stack)

> Only starts `db`, `backend`, and `frontend`. Does NOT touch your existing N8N container.

```powershell
# From project root
docker compose up -d --build

# Stop (does NOT delete data)
docker compose down

# View logs
docker compose logs -f backend
```

URLs when using Docker:
- Frontend: http://localhost:8080
- API: http://localhost:5000
- MySQL: localhost:3307 (external)

---

## Business Rules

| Rule | Scenario | Order Status | Payment Status | Exception |
|------|----------|-------------|----------------|-----------|
| **A** | Online paid + insufficient stock | `EXCEPTION` | `PAID` | `INSUFFICIENT_STOCK`, HIGH, Inventory |
| **B** | Online + sufficient stock | `CONFIRMED` | `PAID` | None |
| **C** | Cash on Delivery | `CONFIRMED` | `PAY_ON_DELIVERY` | None |
| **D** | Payment failure (demo flag) | `ORDER_PLACED` | `FAILED` | None |

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check + DB ping | None |
| GET | `/api/products` | List active products | None |
| POST | `/api/orders` | Create order | None |
| GET | `/api/orders` | List all orders | None |
| GET | `/api/orders/<id>` | Get single order | None |
| GET | `/api/exceptions` | List exceptions | None |
| GET | `/api/dashboard` | Control Tower stats | None |
| POST | `/api/webhooks/order-event` | Receive n8n events | `X-Webhook-Secret` |
| POST | `/api/admin/simulate-paid-insufficient-stock` | Test Rule A | `X-Admin-Key` |
| GET | `/api/admin/audit-logs` | View audit trail | `X-Admin-Key` |

---

## Running Tests

```powershell
# From project root
cd tests
pytest ../tests/ -v

# Or from backend dir
cd backend
pytest ../tests/ -v --tb=short
```

**Requirements for tests:**
- MySQL running locally
- Test database will be created automatically: `order_exception_control_tower_test`
- Tests use isolated test DB — never touch the production database.

If MySQL is not available, tests are automatically skipped with a clear message.

---

## n8n Workflow

The workflow (`n8n/order_event_workflow.json`) implements:

1. **Webhook** receives order events at `/webhook/order-event`
2. **Code node** validates the `X-Webhook-Secret` header and required fields
3. **IF node** rejects invalid/unauthorized requests with 400/401
4. **HTTP GET** fetches the authoritative order from Flask
5. **Switch node** routes by `event_type`:
   - `PAID_INSUFFICIENT_STOCK` → HIGH severity, Inventory team
   - `ORDER_CONFIRMED` → acknowledgement
   - `PAYMENT_FAILED` → updates payment status
6. **HTTP POST** sends result back to Flask `/api/webhooks/order-event`
7. **Respond** returns structured JSON

See: [`n8n/IMPORT_INSTRUCTIONS.md`](n8n/IMPORT_INSTRUCTIONS.md)

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `products` | Catalogue, price, stock |
| `orders` | Customer orders, status, payment |
| `order_items` | Line items per order |
| `order_exceptions` | Detected exceptions, severity, team |
| `workflow_events` | Idempotency, automation event log |
| `audit_logs` | Full audit trail |

---

## Security Notes

- All totals calculated server-side. Browser amounts are ignored.
- Stock deduction is atomic (SELECT … FOR UPDATE + row count guard).
- Webhook endpoint requires `X-Webhook-Secret` header.
- Admin endpoints require `X-Admin-Key` header.
- No real payment credentials are stored or processed.
- Parameterized SQL queries throughout.
- Secrets in environment variables only — never in code.

---

## Demonstration Checklist (Internship Review)

1. ☐ Open frontend → Home page shows live stats from Flask
2. ☐ Browse Products page → products load from MySQL
3. ☐ Add items to cart → checkout form appears
4. ☐ Place a normal order (ONLINE) → Status: CONFIRMED, PAID
5. ☐ Place a COD order → Status: CONFIRMED, PAY_ON_DELIVERY
6. ☐ Place an order for qty > stock (e.g., 999) → Status: EXCEPTION
7. ☐ Open Control Tower → KPIs, exceptions table, event log all update
8. ☐ Run admin simulation → Exception appears in Control Tower
9. ☐ Import and activate n8n workflow → test webhook manually
10. ☐ Run `pytest tests/ -v` → all tests pass
11. ☐ Show `docker compose up` → all services start
12. ☐ Show `audit_logs` table → every action is recorded

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Flask: `ModuleNotFoundError` | `pip install -r backend/requirements.txt` |
| MySQL connection refused | Start MySQL, check `.env` credentials |
| Frontend: "Could not connect to backend" | Start Flask on port 5000 |
| n8n workflow not triggering | Activate workflow in n8n UI, check env vars |
| Tests skip | MySQL not running or credentials wrong |
| Port 5678 in use | `docker start N8N` (use existing container) |
| Port 3306 in use | Docker Compose maps to 3307 instead |

---

## Project Structure

```
Project_1_Order_Exception_Control_Tower/
├── frontend/
│   ├── index.html        # Multi-section SPA
│   ├── style.css         # Professional responsive CSS
│   ├── app.js            # All frontend logic
│   ├── Dockerfile        # Nginx container
│   └── nginx.conf        # Nginx proxy config
├── backend/
│   ├── app.py            # Flask app factory
│   ├── config.py         # Environment-based config
│   ├── database.py       # MySQL connection pool + init_db
│   ├── routes/           # Blueprint modules
│   │   ├── health.py
│   │   ├── products.py
│   │   ├── orders.py
│   │   ├── exceptions.py
│   │   ├── dashboard.py
│   │   ├── webhooks.py
│   │   └── admin.py
│   ├── services/
│   │   ├── order_service.py      # Business rules A–D
│   │   └── exception_service.py  # Audit + exception helpers
│   ├── requirements.txt
│   └── Dockerfile
├── database/
│   └── schema.sql        # Idempotent schema + seed data
├── n8n/
│   ├── order_event_workflow.json  # Importable workflow
│   └── IMPORT_INSTRUCTIONS.md
├── tests/
│   ├── conftest.py       # Pytest fixtures, isolated test DB
│   └── test_api.py       # 30+ automated tests
├── docker-compose.yml
├── .env.example
├── .env                  # Local dev (not committed)
├── .gitignore
└── README.md
```
