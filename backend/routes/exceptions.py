"""Exceptions listing endpoint."""
from flask import Blueprint, jsonify, request, current_app
from database import get_connection

exceptions_bp = Blueprint("exceptions", __name__)


@exceptions_bp.route("/api/exceptions", methods=["GET"])
def list_exceptions():
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """SELECT e.exception_id, e.order_id, e.exception_type,
                      e.severity, e.owner_team, e.description,
                      e.exception_status, e.created_at, e.resolved_at,
                      o.customer_name, o.total_amount
               FROM order_exceptions e
               JOIN orders o ON o.order_id = e.order_id
               ORDER BY e.created_at DESC
               LIMIT 200"""
        )
        rows = cur.fetchall()
        for row in rows:
            if row.get("total_amount") is not None:
                row["total_amount"] = float(row["total_amount"])
            for ts in ("created_at", "resolved_at"):
                if row.get(ts):
                    row[ts] = row[ts].isoformat()
        return jsonify(rows), 200
    except Exception as e:
        current_app.logger.error("Exception listing failed: %s", e)
        return jsonify({"error": "Could not retrieve exceptions."}), 500
    finally:
        cur.close()
        conn.close()
