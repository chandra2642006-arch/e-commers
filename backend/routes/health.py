"""Health check endpoint."""
from flask import Blueprint, jsonify
from database import get_connection

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health():
    db_ok = False
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        conn.close()
        db_ok = True
    except Exception as e:
        pass

    return jsonify({
        "status":   "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "service":  "Order Exception Control Tower",
    }), 200 if db_ok else 503
