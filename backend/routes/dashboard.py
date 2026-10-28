"""Dashboard / Control Tower statistics endpoint."""
from flask import Blueprint, jsonify, current_app
from database import get_connection

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        # Order counts by status
        cur.execute(
            """SELECT order_status, COUNT(*) AS cnt
               FROM orders GROUP BY order_status"""
        )
        status_counts = {r["order_status"]: r["cnt"] for r in cur.fetchall()}

        # Exception counts by severity
        cur.execute(
            """SELECT severity, COUNT(*) AS cnt
               FROM order_exceptions
               WHERE exception_status IN ('OPEN','IN_PROGRESS')
               GROUP BY severity"""
        )
        exc_by_severity = {r["severity"]: r["cnt"] for r in cur.fetchall()}

        # Exception counts by team
        cur.execute(
            """SELECT owner_team, COUNT(*) AS cnt
               FROM order_exceptions
               WHERE exception_status IN ('OPEN','IN_PROGRESS')
               GROUP BY owner_team"""
        )
        exc_by_team = {r["owner_team"]: r["cnt"] for r in cur.fetchall()}

        # Recent events (last 10)
        cur.execute(
            """SELECT we.event_id, we.order_id, we.event_type,
                      we.processing_status, we.received_at
               FROM workflow_events we
               ORDER BY we.received_at DESC LIMIT 10"""
        )
        recent_events = cur.fetchall()
        for ev in recent_events:
            if ev.get("received_at"):
                ev["received_at"] = ev["received_at"].isoformat()

        # Recent exceptions (last 5)
        cur.execute(
            """SELECT e.exception_id, e.order_id, e.exception_type,
                      e.severity, e.owner_team, e.exception_status, e.created_at
               FROM order_exceptions e
               ORDER BY e.created_at DESC LIMIT 5"""
        )
        recent_exc = cur.fetchall()
        for ex in recent_exc:
            if ex.get("created_at"):
                ex["created_at"] = ex["created_at"].isoformat()

        # Total revenue (confirmed/delivered orders)
        cur.execute(
            """SELECT COALESCE(SUM(total_amount), 0) AS revenue
               FROM orders
               WHERE order_status IN ('CONFIRMED','READY_TO_SHIP','DISPATCHED','DELIVERED')
               AND payment_status = 'PAID'"""
        )
        revenue_row = cur.fetchone()
        revenue = float(revenue_row["revenue"]) if revenue_row else 0.0

        total_orders     = sum(status_counts.values())
        total_exceptions = sum(exc_by_severity.values())
        high_severity    = exc_by_severity.get("HIGH", 0) + exc_by_severity.get("CRITICAL", 0)

        return jsonify({
            "total_orders":        total_orders,
            "total_exceptions":    total_exceptions,
            "high_severity_count": high_severity,
            "revenue_paid":        revenue,
            "orders_by_status":    status_counts,
            "exceptions_by_severity": exc_by_severity,
            "exceptions_by_team":     exc_by_team,
            "recent_events":       recent_events,
            "recent_exceptions":   recent_exc,
        }), 200
    except Exception as e:
        current_app.logger.error("Dashboard query failed: %s", e)
        return jsonify({"error": "Dashboard data unavailable."}), 500
    finally:
        cur.close()
        conn.close()
