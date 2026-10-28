# n8n Workflow Import Instructions
# ===================================
# File: order_event_workflow.json
# ===================================

## Current Status

> **The workflow is already imported and activated inside your `N8N` container!**  
> Workflow Name: **`Order Exception Control Tower - Event Processor`**  
> Endpoint: `http://localhost:5678/webhook/order-event`

---

## How to access or re-import the workflow

### Method 1: View in n8n Web UI (Already Imported)
1. Open http://localhost:5678 in your browser.
2. Click **Workflows** in the left navigation sidebar.
3. You will see **"Order Exception Control Tower - Event Processor"**.
4. Click on it to view the full visual automation pipeline (Webhook, Auth, Routing, Flask Dispatch, Response).

### Method 2: Manual Import via UI (if needed)
1. In n8n, click **Workflows** → **+ (Add workflow)**.
2. Click the three dots menu (**⋮**) in the top right corner → select **Import from File...**.
3. Select [order_event_workflow.json](file:///c:/Users/chand/OneDrive/Desktop/intenship(projects)/Project_1_Order_Exception_Control_Tower/n8n/order_event_workflow.json).

### Method 3: Instant CLI Import into Docker Container
```powershell
docker cp n8n/order_event_workflow.json N8N:/tmp/order_event_workflow.json
docker exec N8N n8n import:workflow --input=/tmp/order_event_workflow.json
```

### 3. Set environment variables in n8n
The workflow uses two environment variables. Set them in your n8n container:

| Variable                 | Value                                          |
|--------------------------|------------------------------------------------|
| `WEBHOOK_SECRET`         | Same value as in your `.env` file              |
| `FLASK_API_URL`          | `http://host.docker.internal:5000` (Docker)    |
|                          | OR `http://127.0.0.1:5000` (if n8n on host)   |
| `TWILIO_ACCOUNT_SID`     | Your Twilio Account SID (starts with AC...)    |
| `TWILIO_AUTH_TOKEN`      | Your Twilio Auth Token                         |
| `TWILIO_WHATSAPP_NUMBER` | `+14155238886` (Twilio Sandbox Number)         |

> 💡 **Twilio WhatsApp Sandbox Setup (Free)**:
> 1. In your Twilio Console, go to **Messaging** → **Try it out** → **Send a WhatsApp message**.
> 2. Follow instructions on screen to join the sandbox by sending a code (e.g. `join <your-code>`) to `+1 415 523 8886` from your WhatsApp phone number.
> 3. Enter your `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in n8n or `.env`.
> 4. Whenever an order is placed, a WhatsApp message with order details and dynamic 2-day delivery time will be sent directly to your WhatsApp!

To set env vars for the existing N8N container:
```
docker stop N8N
docker rm N8N
docker run -d --name N8N -p 5678:5678 \
  -e WEBHOOK_SECRET=webhook-secret-change-in-prod \
  -e FLASK_API_URL=http://host.docker.internal:5000 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n:latest
```

> ⚠️ On Windows with Docker Desktop, `host.docker.internal` resolves to the host machine.
> If Flask is running on the host (not in Docker), use `host.docker.internal:5000`.

### 4. Activate the workflow
1. Open the imported workflow.
2. Toggle the **Active** switch at the top right to ON.
3. The webhook will be available at: `http://localhost:5678/webhook/order-event`

### 5. Test the webhook manually
```powershell
Invoke-WebRequest -Uri "http://localhost:5678/webhook/order-event" `
  -Method POST `
  -Headers @{ "Content-Type"="application/json"; "X-Webhook-Secret"="webhook-secret-change-in-prod" } `
  -Body '{"event_uid":"test-001","event_type":"ORDER_CONFIRMED","order_id":"ORD-XXXXXXXX"}'
```

### Workflow overview
```
[Webhook] → [Validate & Auth] → [Is Valid?]
                                      ├── NO  → [Respond: Invalid (400)]
                                      └── YES → [Fetch Order from Flask]
                                                       ↓
                                               [Route by Event Type]
                                               ├── PAID_INSUFFICIENT_STOCK → [Set Exception Fields]
                                               ├── ORDER_CONFIRMED          → [Set Confirmed Fields]
                                               └── PAYMENT_FAILED          → [Set Failed Fields]
                                                       ↓ (all branches)
                                               [POST Result to Flask /api/webhooks/order-event]
                                                       ↓
                                               [Respond: Success (200)]
```

### Node descriptions
- **Webhook: Receive Order Event** — listens at `/webhook/order-event`
- **Validate & Auth** — Code node: checks `X-Webhook-Secret` header, validates required fields
- **Is Valid?** — IF node: routes valid vs invalid requests
- **Fetch Order from Flask** — HTTP GET to confirm the order exists
- **Route by Event Type** — Switch node on `event_type`
- **Set * Fields** — Set nodes that prepare the payload for each scenario
- **POST Result to Flask** — HTTP POST back to `/api/webhooks/order-event` with auth header
- **Respond: Success / Invalid / Error** — structured JSON responses

### Security notes
- The webhook secret is checked in the Code node before any processing.
- The Flask backend also validates the secret independently.
- Event UIDs are checked for duplicates in the Flask `workflow_events` table.
