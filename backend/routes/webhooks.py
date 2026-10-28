"""
Webhook endpoint — receives validated order events from n8n.
Authentication: shared secret in X-Webhook-Secret header.
Idempotency:    event_uid field checked against workflow_events table.
"""
import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from database import get_connection
from services.exception_service import record_exception, record_audit

webhooks_bp = Blueprint("webhooks", __name__)


def _check_auth() -> bool:
    secret = current_app.config.get("WEBHOOK_SECRET", "")
    return request.headers.get("X-Webhook-Secret") == secret


@webhooks_bp.route("/api/webhooks/order-event", methods=["POST"])
def receive_order_event():
    if not _check_auth():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}

    # Required fields
    event_uid  = data.get("event_uid")
    event_type = data.get("event_type")
    order_id   = data.get("order_id")

    if not event_uid or not event_type or not order_id:
        return jsonify({"error": "Missing required fields: event_uid, event_type, order_id"}), 400

    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        # Idempotency check
        cur.execute(
            "SELECT event_id, processing_status FROM workflow_events WHERE event_uid = %s",
            (event_uid,)
        )
        existing = cur.fetchone()
        if existing:
            return jsonify({
                "message":           "Duplicate event — already processed",
                "event_uid":         event_uid,
                "processing_status": existing["processing_status"],
            }), 200

        # Record event as RECEIVED
        payload_summary = json.dumps(data)[:1000]
        cur.execute(
            """INSERT INTO workflow_events
               (order_id, event_uid, event_type, processing_status, payload_summary, received_at)
               VALUES (%s, %s, %s, 'RECEIVED', %s, NOW())""",
            (order_id, event_uid, event_type, payload_summary)
        )
        conn.commit()

        # Dispatch to handler
        result = _handle_event(conn, cur, event_type, order_id, data, event_uid)

        # Mark event PROCESSED
        cur.execute(
            """UPDATE workflow_events
               SET processing_status='PROCESSED', processed_at=NOW()
               WHERE event_uid=%s""",
            (event_uid,)
        )
        conn.commit()

        return jsonify(result), 200

    except Exception as e:
        conn.rollback()
        current_app.logger.error("Webhook processing error: %s", e)
        try:
            cur.execute(
                """UPDATE workflow_events SET processing_status='FAILED'
                   WHERE event_uid=%s""", (event_uid,)
            )
            conn.commit()
        except Exception:
            pass
        return jsonify({"error": "Event processing failed"}), 500
    finally:
        cur.close()
        conn.close()


def _handle_event(conn, cur, event_type: str, order_id: str, data: dict, event_uid: str) -> dict:
    """Route event to the appropriate handler."""
    if event_type == "PAID_INSUFFICIENT_STOCK":
        return _handle_paid_insufficient_stock(conn, cur, order_id, data, event_uid)
    elif event_type == "ORDER_CONFIRMED":
        return _handle_order_confirmed(conn, cur, order_id, data, event_uid)
    elif event_type == "WHATSAPP_NOTIFICATION_SENT":
        return _handle_whatsapp_sent(conn, cur, order_id, data, event_uid)
    elif event_type == "PAYMENT_FAILED":
        return _handle_payment_failed(conn, cur, order_id, data, event_uid)
    else:
        # Generic — just acknowledge
        record_audit(cur, "n8n", event_type, "order", order_id,
                     f"Received webhook event: {event_type}")
        conn.commit()
        return {"message": f"Event {event_type} acknowledged", "order_id": order_id}


def _handle_paid_insufficient_stock(conn, cur, order_id, data, event_uid):
    """Rule A simulation: paid order but insufficient stock."""
    # Verify order exists
    cur.execute("SELECT * FROM orders WHERE order_id=%s", (order_id,))
    order = cur.fetchone()
    if not order:
        raise ValueError(f"Order {order_id} not found")

    # Create exception
    cur.execute(
        """INSERT INTO order_exceptions
           (order_id, exception_type, severity, owner_team, description, exception_status)
           VALUES (%s, 'INSUFFICIENT_STOCK', 'HIGH', 'Inventory',
                   'Payment processed but stock is insufficient to fulfil this order.',
                   'OPEN')""",
        (order_id,)
    )

    # Update order status
    cur.execute(
        """UPDATE orders SET order_status='EXCEPTION' WHERE order_id=%s""",
        (order_id,)
    )

    record_audit(cur, "n8n", "EXCEPTION_CREATED", "order", order_id,
                 "INSUFFICIENT_STOCK exception raised by n8n workflow (Rule A)")
    conn.commit()

    return {
        "message":    "INSUFFICIENT_STOCK exception recorded",
        "order_id":   order_id,
        "severity":   "HIGH",
        "owner_team": "Inventory",
    }


def _handle_order_confirmed(conn, cur, order_id, data, event_uid):
    delivery = data.get("estimated_delivery_time") or "2 business days"
    record_audit(cur, "n8n", "ORDER_CONFIRMED_EVENT", "order", order_id,
                 f"n8n confirmed order confirmation event. Delivery: {delivery}")
    conn.commit()
    return {"message": "ORDER_CONFIRMED event recorded", "order_id": order_id}


def _handle_whatsapp_sent(conn, cur, order_id, data, event_uid):
    recipient = data.get("recipient", "Customer")
    delivery = data.get("estimated_delivery_time", "2 business days")
    phone = data.get("phone", "")
    record_audit(cur, "n8n", "WHATSAPP_SENT", "order", order_id,
                 f"WhatsApp message dispatched to {recipient} ({phone}). Delivery time: {delivery}")
    conn.commit()
    return {"message": "WHATSAPP_NOTIFICATION_SENT event recorded", "order_id": order_id}


def _handle_payment_failed(conn, cur, order_id, data, event_uid):
    cur.execute(
        "UPDATE orders SET payment_status='FAILED' WHERE order_id=%s", (order_id,)
    )
    record_audit(cur, "n8n", "PAYMENT_FAILED_EVENT", "order", order_id,
                 "Payment failure notified by n8n")
    conn.commit()
    return {"message": "PAYMENT_FAILED event recorded", "order_id": order_id}
