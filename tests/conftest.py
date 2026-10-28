"""
Pytest configuration for Order Exception Control Tower tests.
Uses an isolated test database.  Never touches the production database.
"""
import os
import sys
import pytest

# ── IMPORTANT: load .env and set env vars BEFORE any backend imports ──────────
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

os.environ["DB_NAME"]          = "order_exception_control_tower_test"
os.environ["DB_HOST"]          = os.environ.get("DB_HOST",     "127.0.0.1")
os.environ["DB_USER"]          = os.environ.get("DB_USER",     "root")
os.environ["DB_PASSWORD"]      = os.environ.get("DB_PASSWORD", "root")
os.environ["WEBHOOK_SECRET"]   = "test-webhook-secret"
os.environ["ADMIN_API_KEY"]    = "test-admin-key"
os.environ["FLASK_SECRET_KEY"] = "test-secret"
os.environ["FLASK_DEBUG"]      = "false"

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


@pytest.fixture(scope="session")
def app():
    """Create Flask test app with isolated test DB (session-scoped)."""
    from database import init_db, reset_pool
    from app import create_app
    from config import Config

    reset_pool()  # discard any pool built with prod DB name

    flask_app = create_app(Config)
    flask_app.config["TESTING"]  = True
    flask_app.config["DEBUG"]    = False

    with flask_app.app_context():
        try:
            init_db()
        except Exception as e:
            pytest.skip(f"MySQL not available for testing: {e}")

    yield flask_app


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_tables(app):
    """
    Truncate test tables before each test so tests are fully independent.
    Table order respects foreign key constraints.
    """
    from database import get_connection, reset_pool
    try:
        reset_pool()  # ensure we're using the test DB pool
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for tbl in ("audit_logs", "workflow_events", "order_exceptions",
                    "order_items", "orders", "products"):
            cur.execute(f"TRUNCATE TABLE {tbl}")
        # Seed fresh test products
        cur.execute(
            """INSERT INTO products
               (name, description, price, stock_qty, is_active) VALUES
               ('Test Headphones', 'Test product A', 2499.00, 10, 1),
               ('Test Keyboard',   'Test product B', 3999.00,  5, 1),
               ('Test Mouse',      'Test product C', 1299.00,  0, 1)"""
        )
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        # If DB unavailable, individual tests will fail with clear messages
        pass
    yield
