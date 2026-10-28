"""
Orders API — create and list orders.
All business logic is server-side; no amounts or statuses from the browser are trusted.
"""
import json
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from database import get_connection
from services.order_service import (
    validate_order_payload,
    process_order,
    get_all_orders,
    get_order_by_id,
)

orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/api/orders", methods=["POST"])
def create_order():
    data = request.get_json(silent=True) or {}

    errors = validate_order_payload(data)
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    try:
        result = process_order(data)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        current_app.logger.error("Order creation failed: %s", e)
        return jsonify({"error": "Order could not be created. Please try again."}), 500


@orders_bp.route("/api/orders", methods=["GET"])
def list_orders():
    try:
        orders = get_all_orders()
        return jsonify(orders), 200
    except Exception as e:
        current_app.logger.error("Order listing failed: %s", e)
        return jsonify({"error": "Could not retrieve orders."}), 500


@orders_bp.route("/api/orders/<order_id>", methods=["GET"])
def get_order(order_id: str):
    try:
        order = get_order_by_id(order_id)
        if order is None:
            return jsonify({"error": "Order not found"}), 404
        return jsonify(order), 200
    except Exception as e:
        current_app.logger.error("Order lookup failed: %s", e)
        return jsonify({"error": "Could not retrieve order."}), 500
