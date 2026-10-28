"""Products API endpoint."""
from flask import Blueprint, jsonify
from database import get_connection

products_bp = Blueprint("products", __name__)


@products_bp.route("/api/products", methods=["GET"])
def get_products():
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """SELECT product_id, name, description, price, stock_qty, is_active
               FROM products
               WHERE is_active = 1
               ORDER BY product_id"""
        )
        rows = cur.fetchall()
        # Convert Decimal → float for JSON serialisation
        for row in rows:
            row["price"] = float(row["price"])
        return jsonify(rows), 200
    finally:
        cur.close()
        conn.close()
