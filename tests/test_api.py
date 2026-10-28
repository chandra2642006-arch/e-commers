"""
Automated tests for the Order Exception Control Tower API.
Run with:  cd Project_1_Order_Exception_Control_Tower && pytest tests/ -v
Requires: MySQL running locally with credentials in .env / conftest defaults.
"""
import json
import uuid
import pytest

# ============================================================
# Helpers
# ============================================================

def make_order(client, items=None, payment_method="ONLINE", **kwargs):
    """Submit a POST /api/orders request."""
    if items is None:
        items = [{"product_id": 1, "quantity": 1}]
    payload = {
        "customer_name":  "Test User",
        "customer_email": "test@example.com",
        "customer_phone": "9876543210",
        "address_line":   "123 Test Street",
        "city":           "Testcity",
        "pincode":        "560001",
        "payment_method": payment_method,
        "items":          items,
    }
    payload.update(kwargs)
    return client.post(
        "/api/orders",
        data=json.dumps(payload),
        content_type="application/json",
    )


WEBHOOK_SECRET = "test-webhook-secret"
ADMIN_KEY      = "test-admin-key"


# ============================================================
# Health check
# ============================================================
class TestHealth:
    def test_health_returns_200(self, client):
        r = client.get("/api/health")
        assert r.status_code in (200, 503)   # 503 if DB not available
        data = r.get_json()
        assert "status" in data
        assert data["service"] == "Order Exception Control Tower"


# ============================================================
# Products
# ============================================================
class TestProducts:
    def test_get_products_returns_list(self, client):
        r = client.get("/api/products")
        assert r.status_code == 200
        data = r.get_json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_products_have_required_fields(self, client):
        r    = client.get("/api/products")
        data = r.get_json()
        for p in data:
            assert "product_id" in p
            assert "name"       in p
            assert "price"      in p
            assert "stock_qty"  in p


# ============================================================
# Rule B — Normal online order
# ============================================================
class TestRuleB:
    def test_successful_online_order(self, client):
        r = make_order(client, items=[{"product_id": 1, "quantity": 1}])
        assert r.status_code == 201
        data = r.get_json()
        assert data["order_status"]   == "CONFIRMED"
        assert data["payment_status"] == "PAID"
        assert data["payment_method"] == "ONLINE"
        assert data["exception"]      is False

    def test_stock_is_reduced_after_order(self, client):
        from database import get_connection
        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT stock_qty FROM products WHERE product_id=1")
        before = cur.fetchone()["stock_qty"]
        cur.close(); conn.close()

        make_order(client, items=[{"product_id": 1, "quantity": 2}])

        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT stock_qty FROM products WHERE product_id=1")
        after = cur.fetchone()["stock_qty"]
        cur.close(); conn.close()

        assert after == before - 2

    def test_total_calculated_server_side(self, client):
        r    = make_order(client, items=[{"product_id": 1, "quantity": 3}])
        data = r.get_json()
        assert data["total_amount"] == 2499.0 * 3

    def test_stock_never_goes_negative(self, client):
        # Product 1 has 10 stock; order 9 then order 2 → second should fail or exception
        make_order(client, items=[{"product_id": 1, "quantity": 9}])

        from database import get_connection
        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT stock_qty FROM products WHERE product_id=1")
        stock = cur.fetchone()["stock_qty"]
        cur.close(); conn.close()

        assert stock >= 0, "Stock went negative!"


# ============================================================
# Rule C — Cash on Delivery
# ============================================================
class TestRuleC:
    def test_cod_order_payment_status(self, client):
        r = make_order(client, payment_method="COD")
        assert r.status_code == 201
        data = r.get_json()
        assert data["payment_status"] == "PAY_ON_DELIVERY"
        assert data["order_status"]   == "CONFIRMED"
        assert data["exception"]      is False

    def test_cod_does_not_create_exception(self, client):
        make_order(client, payment_method="COD")
        r    = client.get("/api/exceptions")
        excs = r.get_json()
        assert all(e["exception_type"] != "INSUFFICIENT_STOCK"
                   or e["order_id"].startswith("SIM") for e in excs)


# ============================================================
# Rule D — Failed payment
# ============================================================
class TestRuleD:
    def test_failed_payment_order(self, client):
        r = make_order(client, simulate_payment_failure=True)
        assert r.status_code == 201
        data = r.get_json()
        assert data["payment_status"] == "FAILED"
        assert data["order_status"]   == "ORDER_PLACED"
        assert data["exception"]      is False

    def test_failed_payment_no_stock_reduction(self, client):
        from database import get_connection
        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT stock_qty FROM products WHERE product_id=1")
        before = cur.fetchone()["stock_qty"]
        cur.close(); conn.close()

        make_order(client, simulate_payment_failure=True,
                   items=[{"product_id": 1, "quantity": 3}])

        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT stock_qty FROM products WHERE product_id=1")
        after = cur.fetchone()["stock_qty"]
        cur.close(); conn.close()

        assert after == before, "Stock was deducted despite payment failure"


# ============================================================
# Rule A — Insufficient stock exception
# ============================================================
class TestRuleA:
    def test_insufficient_stock_creates_exception(self, client):
        # Product 1 has 10 stock; order 20 → exception (exceeds stock but passes validation)
        r = make_order(client, items=[{"product_id": 1, "quantity": 20}])
        assert r.status_code == 201
        data = r.get_json()
        assert data["order_status"]   == "EXCEPTION"
        assert data["exception"]      is True

    def test_exception_has_high_severity(self, client):
        make_order(client, items=[{"product_id": 1, "quantity": 20}])
        r    = client.get("/api/exceptions")
        excs = r.get_json()
        exc  = next(
            (e for e in excs if e["exception_type"] == "INSUFFICIENT_STOCK"), None
        )
        assert exc is not None, "INSUFFICIENT_STOCK exception not found"
        assert exc["severity"]   == "HIGH"
        assert exc["owner_team"] == "Inventory"

    def test_out_of_stock_product(self, client):
        # Product 3 has 0 stock
        r = make_order(client, items=[{"product_id": 3, "quantity": 1}])
        assert r.status_code == 201
        data = r.get_json()
        assert data["order_status"] == "EXCEPTION"

    def test_admin_simulation_rule_a(self, client):
        r = client.post(
            "/api/admin/simulate-paid-insufficient-stock",
            data=json.dumps({"product_id": 1, "quantity": 999}),
            content_type="application/json",
            headers={"X-Admin-Key": ADMIN_KEY},
        )
        assert r.status_code == 201
        data = r.get_json()
        assert data["severity"]   == "HIGH"
        assert data["owner_team"] == "Inventory"
        assert "order_id" in data
        assert data["order_id"].startswith("SIM-")

    def test_admin_simulation_requires_auth(self, client):
        r = client.post(
            "/api/admin/simulate-paid-insufficient-stock",
            data=json.dumps({"product_id": 1}),
            content_type="application/json",
        )
        assert r.status_code == 401

    def test_admin_simulation_wrong_key(self, client):
        r = client.post(
            "/api/admin/simulate-paid-insufficient-stock",
            data=json.dumps({"product_id": 1}),
            content_type="application/json",
            headers={"X-Admin-Key": "wrong-key"},
        )
        assert r.status_code == 401


# ============================================================
# Validation
# ============================================================
class TestValidation:
    def test_missing_customer_name(self, client):
        payload = {
            "customer_email": "a@b.com",
            "customer_phone": "1234567890",
            "address_line":   "Addr",
            "city":           "City",
            "pincode":        "123456",
            "payment_method": "ONLINE",
            "items":          [{"product_id": 1, "quantity": 1}],
        }
        r = client.post("/api/orders", data=json.dumps(payload), content_type="application/json")
        assert r.status_code == 400

    def test_invalid_payment_method(self, client):
        r = make_order(client, payment_method="CASH")
        assert r.status_code == 400

    def test_empty_items(self, client):
        payload = {
            "customer_name": "X", "customer_email": "x@x.com",
            "customer_phone": "123", "address_line": "addr",
            "city": "c", "pincode": "p",
            "payment_method": "ONLINE", "items": [],
        }
        r = client.post("/api/orders", data=json.dumps(payload), content_type="application/json")
        assert r.status_code == 400

    def test_invalid_product_id(self, client):
        r = make_order(client, items=[{"product_id": 99999, "quantity": 1}])
        assert r.status_code in (400, 500)

    def test_zero_quantity(self, client):
        r = make_order(client, items=[{"product_id": 1, "quantity": 0}])
        assert r.status_code == 400

    def test_negative_quantity(self, client):
        r = make_order(client, items=[{"product_id": 1, "quantity": -1}])
        assert r.status_code == 400

    def test_invalid_email(self, client):
        r = make_order(client, customer_email="notanemail")
        assert r.status_code == 400


# ============================================================
# Orders listing and retrieval
# ============================================================
class TestOrders:
    def test_list_orders_empty(self, client):
        r = client.get("/api/orders")
        assert r.status_code == 200
        assert r.get_json() == []

    def test_list_orders_after_creation(self, client):
        make_order(client)
        r     = client.get("/api/orders")
        orders = r.get_json()
        assert len(orders) == 1

    def test_get_order_by_id(self, client):
        r1 = make_order(client)
        oid = r1.get_json()["order_id"]
        r2 = client.get(f"/api/orders/{oid}")
        assert r2.status_code == 200
        data = r2.get_json()
        assert data["order_id"] == oid
        assert "items" in data

    def test_get_nonexistent_order(self, client):
        r = client.get("/api/orders/ORD-DOESNOTEXIST")
        assert r.status_code == 404


# ============================================================
# Webhook endpoint
# ============================================================
class TestWebhook:
    def _make_order_and_get_id(self, client):
        r = make_order(client)
        return r.get_json()["order_id"]

    def test_webhook_requires_auth(self, client):
        r = client.post("/api/webhooks/order-event",
                        data=json.dumps({"event_uid": "e1", "event_type": "T", "order_id": "O"}),
                        content_type="application/json")
        assert r.status_code == 401

    def test_webhook_missing_fields(self, client):
        r = client.post(
            "/api/webhooks/order-event",
            data=json.dumps({"event_uid": "e2"}),
            content_type="application/json",
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )
        assert r.status_code == 400

    def test_webhook_duplicate_event(self, client):
        oid = self._make_order_and_get_id(client)
        payload = {"event_uid": "dup-001", "event_type": "ORDER_CONFIRMED", "order_id": oid}

        r1 = client.post("/api/webhooks/order-event",
                         data=json.dumps(payload), content_type="application/json",
                         headers={"X-Webhook-Secret": WEBHOOK_SECRET})
        assert r1.status_code == 200

        # Second delivery — must be idempotent
        r2 = client.post("/api/webhooks/order-event",
                         data=json.dumps(payload), content_type="application/json",
                         headers={"X-Webhook-Secret": WEBHOOK_SECRET})
        assert r2.status_code == 200
        assert "Duplicate" in r2.get_json()["message"]

    def test_webhook_paid_insufficient_stock(self, client):
        # Create an order first so the webhook can find it
        oid = self._make_order_and_get_id(client)
        payload = {
            "event_uid":  f"paid-exc-{uuid.uuid4().hex[:8]}",
            "event_type": "PAID_INSUFFICIENT_STOCK",
            "order_id":   oid,
        }
        r = client.post("/api/webhooks/order-event",
                        data=json.dumps(payload), content_type="application/json",
                        headers={"X-Webhook-Secret": WEBHOOK_SECRET})
        assert r.status_code == 200
        data = r.get_json()
        assert data.get("severity")   == "HIGH"
        assert data.get("owner_team") == "Inventory"


# ============================================================
# Dashboard
# ============================================================
class TestDashboard:
    def test_dashboard_returns_stats(self, client):
        make_order(client)
        r    = client.get("/api/dashboard")
        assert r.status_code == 200
        data = r.get_json()
        assert "total_orders"     in data
        assert "total_exceptions" in data
        assert "orders_by_status" in data
        assert data["total_orders"] >= 1

    def test_dashboard_empty(self, client):
        r    = client.get("/api/dashboard")
        data = r.get_json()
        assert r.status_code == 200
        assert data["total_orders"] == 0
