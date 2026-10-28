"""
Admin-only privileged endpoints.
All require X-Admin-Key header matching ADMIN_API_KEY from config.

Endpoints:
  POST /api/admin/simulate-paid-insufficient-stock
      Creates a test scenario: an "already paid" order with insufficient stock,
      WITHOUT processing a real payment or modifying real stock.
      This is the ONLY way to test Rule A safely.
"""
import json
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from database import get_connection
from services.exception_service import record_audit

admin_bp = Blueprint("admin", __name__)


def _check_admin() -> bool:
    key = current_app.config.get("ADMIN_API_KEY", "")
    return request.headers.get("X-Admin-Key") == key


@admin_bp.route("/api/admin/simulate-paid-insufficient-stock", methods=["POST"])
def simulate_paid_insufficient_stock():
    """
    Admin simulation: create a synthetic paid-order/insufficient-stock scenario.
    Does NOT charge anyone, does NOT reduce real stock.
    Only creates database records for testing Rule A.
    """
    if not _check_admin():
        return jsonify({"error": "Unauthorized — X-Admin-Key required"}), 401

    data       = request.get_json(silent=True) or {}
    product_id = data.get("product_id", 1)
    quantity   = data.get("quantity", 999)   # deliberately huge

    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        # Fetch product
        cur.execute(
            "SELECT * FROM products WHERE product_id=%s AND is_active=1",
            (product_id,)
        )
        product = cur.fetchone()
        if not product:
            return jsonify({"error": "Product not found"}), 404

        # Create a synthetic order
        order_id   = "SIM-" + uuid.uuid4().hex[:8].upper()
        unit_price = float(product["price"])
        total      = unit_price * quantity

        cur.execute(
            """INSERT INTO orders
               (order_id, customer_name, customer_email, customer_phone,
                address_line, city, pincode, total_amount,
                payment_method, payment_status, order_status, notes)
               VALUES (%s,'Test Simulation','sim@example.com','0000000000',
                       'Simulation Street','Test City','000000',
                       %s,'ONLINE','PAID','EXCEPTION',
                       'ADMIN SIMULATION — synthetic paid-order, stock not deducted')""",
            (order_id, total)
        )

        # Insert order item
        cur.execute(
            """INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
               VALUES (%s, %s, %s, %s, %s)""",
            (order_id, product_id, quantity, unit_price, total)
        )

        # Create INSUFFICIENT_STOCK exception
        cur.execute(
            """INSERT INTO order_exceptions
               (order_id, exception_type, severity, owner_team, description)
               VALUES (%s,'INSUFFICIENT_STOCK','HIGH','Inventory',
                       'ADMIN SIMULATION: paid order quantity exceeds available stock.')""",
            (order_id,)
        )

        record_audit(cur, "admin-simulation", "SIMULATE_EXCEPTION", "order", order_id,
                     f"Simulated INSUFFICIENT_STOCK exception for product_id={product_id}, qty={quantity}")

        conn.commit()
        return jsonify({
            "message":    "Simulation created — INSUFFICIENT_STOCK exception (Rule A test)",
            "order_id":   order_id,
            "product":    product["name"],
            "quantity":   quantity,
            "stock_available": product["stock_qty"],
            "severity":   "HIGH",
            "owner_team": "Inventory",
            "note":       "No real payment was processed. No stock was deducted.",
        }), 201
    except Exception as e:
        conn.rollback()
        current_app.logger.error("Admin simulation failed: %s", e)
        return jsonify({"error": "Simulation failed"}), 500
    finally:
        cur.close()
        conn.close()


@admin_bp.route("/api/admin/audit-logs", methods=["GET"])
def get_audit_logs():
    if not _check_admin():
        return jsonify({"error": "Unauthorized — X-Admin-Key required"}), 401

    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """SELECT audit_id, actor, action, entity_type, entity_id, summary, created_at
               FROM audit_logs ORDER BY created_at DESC LIMIT 100"""
        )
        rows = cur.fetchall()
        for row in rows:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
        return jsonify(rows), 200
    finally:
        cur.close()
        conn.close()
