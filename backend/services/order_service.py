"""
Core order business logic.

Rules implemented:
  Rule A — PAID + insufficient stock → INSUFFICIENT_STOCK exception, severity HIGH, owner Inventory
  Rule B — Stock available + payment success → CONFIRMED, stock deducted atomically
  Rule C — COD → payment_status=PAY_ON_DELIVERY, stock deducted, status CONFIRMED
  Rule D — Payment failure → payment_status=FAILED, no stock deduction, no exception

The server calculates totals and validates every field; nothing from the browser is trusted.
"""
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from database import get_connection
from services.exception_service import record_audit, record_exception


def calculate_estimated_delivery(start_dt: Optional[datetime] = None) -> str:
    """
    Calculate dynamic estimated delivery: 2 business days from order placement.
    Skips weekends (Saturday & Sunday). Delivery window: by 6:00 PM.
    """
    if start_dt is None:
        start_dt = datetime.now()
    current = start_dt
    added_days = 0
    while added_days < 2:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday to Friday
            added_days += 1
    delivery_dt = current.replace(hour=18, minute=0, second=0, microsecond=0)
    return delivery_dt.strftime("%A, %b %d, %Y by %I:%M %p")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

REQUIRED_ORDER_FIELDS = [
    "customer_name", "customer_email", "customer_phone",
    "address_line", "city", "pincode",
    "items", "payment_method",
]


def validate_order_payload(data: dict) -> list[str]:
    errors = []

    for field in REQUIRED_ORDER_FIELDS:
        if not data.get(field):
            errors.append(f"'{field}' is required")

    if data.get("payment_method") not in ("ONLINE", "COD"):
        errors.append("payment_method must be 'ONLINE' or 'COD'")

    items = data.get("items")
    if not isinstance(items, list) or len(items) == 0:
        errors.append("'items' must be a non-empty list")
    else:
        for i, item in enumerate(items):
            pid = item.get("product_id")
            qty = item.get("quantity")
            if not isinstance(pid, int) or pid < 1:
                errors.append(f"items[{i}].product_id must be a positive integer")
            if not isinstance(qty, int) or isinstance(qty, bool) or not (1 <= qty <= 500):
                errors.append(f"items[{i}].quantity must be an integer 1–500")

    email = data.get("customer_email", "")
    if "@" not in email or "." not in email:
        errors.append("customer_email appears invalid")

    return errors


# ---------------------------------------------------------------------------
# Order processing
# ---------------------------------------------------------------------------

def process_order(data: dict) -> dict:
    """
    Create an order with full business rule enforcement.
    Uses a single transaction with SELECT … FOR UPDATE on products.
    """
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        payment_method = data["payment_method"].upper()
        customer = {k: data[k] for k in (
            "customer_name", "customer_email", "customer_phone",
            "address_line", "city", "pincode",
        )}
        notes = data.get("notes", "")

        # Lock product rows and validate stock
        item_data_list = data["items"]
        resolved_items = []
        total_amount   = 0.0

        product_ids = [item["product_id"] for item in item_data_list]
        # Build IN clause safely
        placeholders = ",".join(["%s"] * len(product_ids))
        cur.execute(
            f"SELECT product_id, name, price, stock_qty, is_active "
            f"FROM products WHERE product_id IN ({placeholders}) AND is_active=1 "
            f"FOR UPDATE",
            product_ids
        )
        products_map = {p["product_id"]: p for p in cur.fetchall()}

        stock_insufficient = False
        for item in item_data_list:
            pid = item["product_id"]
            qty = item["quantity"]
            if pid not in products_map:
                raise ValueError(f"Product {pid} not found or is inactive")
            product  = products_map[pid]
            unit_price = float(product["price"])
            subtotal   = unit_price * qty
            total_amount += subtotal

            if product["stock_qty"] < qty:
                stock_insufficient = True

            resolved_items.append({
                "product_id": pid,
                "name":       product["name"],
                "quantity":   qty,
                "unit_price": unit_price,
                "subtotal":   subtotal,
                "stock_qty":  product["stock_qty"],
            })

        # Determine payment status (server-side)
        if payment_method == "COD":
            payment_status = "PAY_ON_DELIVERY"
            payment_ok     = True    # COD is always "ok" — paid on delivery
        else:
            # Simulate online payment: always succeeds unless the special
            # test flag `simulate_payment_failure` is set
            if data.get("simulate_payment_failure"):
                payment_status = "FAILED"
                payment_ok     = False
            else:
                payment_status = "PAID"
                payment_ok     = True

        # Determine order status
        if payment_ok and stock_insufficient:
            # Rule A
            order_status = "EXCEPTION"
        elif payment_ok and not stock_insufficient:
            # Rule B / C
            order_status = "CONFIRMED"
        else:
            # Rule D
            order_status = "ORDER_PLACED"

        # Calculate estimated delivery time (2 business days)
        estimated_delivery_time = calculate_estimated_delivery()

        # Create order record
        order_id = "ORD-" + uuid.uuid4().hex[:8].upper()
        cur.execute(
            """INSERT INTO orders
               (order_id, customer_name, customer_email, customer_phone,
                address_line, city, pincode, total_amount,
                payment_method, payment_status, order_status, notes, estimated_delivery_time)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                order_id,
                customer["customer_name"], customer["customer_email"],
                customer["customer_phone"], customer["address_line"],
                customer["city"], customer["pincode"],
                total_amount, payment_method,
                payment_status, order_status, notes,
                estimated_delivery_time,
            )
        )

        # Insert order items and deduct stock only if appropriate
        for item in resolved_items:
            cur.execute(
                """INSERT INTO order_items
                   (order_id, product_id, quantity, unit_price, subtotal)
                   VALUES (%s,%s,%s,%s,%s)""",
                (order_id, item["product_id"], item["quantity"],
                 item["unit_price"], item["subtotal"])
            )

            if payment_ok and not stock_insufficient:
                # Rule B / C: deduct stock atomically with guard
                cur.execute(
                    """UPDATE products
                       SET stock_qty = stock_qty - %s
                       WHERE product_id = %s AND stock_qty >= %s""",
                    (item["quantity"], item["product_id"], item["quantity"])
                )
                if cur.rowcount == 0:
                    # Race condition guard
                    raise ValueError(
                        f"Stock became insufficient for product {item['product_id']} during checkout"
                    )

        # Rule A: record exception
        if order_status == "EXCEPTION":
            cur.execute(
                """INSERT INTO order_exceptions
                   (order_id, exception_type, severity, owner_team, description)
                   VALUES (%s,'INSUFFICIENT_STOCK','HIGH','Inventory',
                           'Payment processed but requested quantity exceeds available stock.')""",
                (order_id,)
            )

        # Audit log
        record_audit(
            cur, "customer", "ORDER_CREATED", "order", order_id,
            f"Order {order_id} created via API. status={order_status}, "
            f"payment={payment_status}, total={total_amount:.2f}, delivery={estimated_delivery_time}"
        )

        conn.commit()

        return {
            "order_id":               order_id,
            "order_status":           order_status,
            "payment_status":         payment_status,
            "payment_method":         payment_method,
            "total_amount":           total_amount,
            "items":                  resolved_items,
            "exception":              order_status == "EXCEPTION",
            "estimated_delivery_time": estimated_delivery_time,
            "customer_phone":         customer["customer_phone"],
            "customer_name":          customer["customer_name"],
            "note":                   "No real payment was processed. This is a demo application.",
        }

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Retrieval helpers
# ---------------------------------------------------------------------------

def get_all_orders() -> list:
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """SELECT o.order_id, o.customer_name, o.customer_email,
                      o.total_amount, o.payment_method, o.payment_status,
                      o.order_status, o.estimated_delivery_time, o.created_at, o.updated_at,
                      EXISTS(
                          SELECT 1 FROM order_exceptions e
                          WHERE e.order_id=o.order_id
                          AND e.exception_status IN ('OPEN','IN_PROGRESS')
                      ) AS has_exception
               FROM orders o
               ORDER BY o.created_at DESC
               LIMIT 200"""
        )
        rows = cur.fetchall()
        for row in rows:
            row["total_amount"]  = float(row["total_amount"])
            row["has_exception"] = bool(row["has_exception"])
            if not row.get("estimated_delivery_time"):
                row["estimated_delivery_time"] = calculate_estimated_delivery()
            for ts in ("created_at", "updated_at"):
                if row.get(ts):
                    row[ts] = row[ts].isoformat()
        return rows
    finally:
        cur.close()
        conn.close()


def get_order_by_id(order_id: str) -> Optional[dict]:
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """SELECT o.*, 
                      EXISTS(
                          SELECT 1 FROM order_exceptions e
                          WHERE e.order_id=o.order_id
                          AND e.exception_status IN ('OPEN','IN_PROGRESS')
                      ) AS has_exception
               FROM orders o WHERE o.order_id=%s""",
            (order_id,)
        )
        order = cur.fetchone()
        if order is None:
            return None

        order["total_amount"]  = float(order["total_amount"])
        order["has_exception"] = bool(order["has_exception"])
        if not order.get("estimated_delivery_time"):
            order["estimated_delivery_time"] = calculate_estimated_delivery()
        for ts in ("created_at", "updated_at"):
            if order.get(ts):
                order[ts] = order[ts].isoformat()

        # Fetch items
        cur.execute(
            """SELECT oi.*, p.name AS product_name
               FROM order_items oi
               JOIN products p ON p.product_id = oi.product_id
               WHERE oi.order_id=%s""",
            (order_id,)
        )
        items = cur.fetchall()
        for item in items:
            item["unit_price"] = float(item["unit_price"])
            item["subtotal"]   = float(item["subtotal"])
        order["items"] = items

        # Fetch exceptions
        cur.execute(
            """SELECT exception_id, exception_type, severity, owner_team,
                      description, exception_status, created_at
               FROM order_exceptions WHERE order_id=%s""",
            (order_id,)
        )
        excs = cur.fetchall()
        for ex in excs:
            if ex.get("created_at"):
                ex["created_at"] = ex["created_at"].isoformat()
        order["exceptions"] = excs

        return order
    finally:
        cur.close()
        conn.close()
