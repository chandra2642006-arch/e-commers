"""
Configuration for Order Exception Control Tower Flask backend.
All secrets are loaded from environment variables.
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env from root directory if it exists
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)


class Config:
    # Flask
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-in-production")
    DEBUG      = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    # MySQL connection
    DB_HOST     = os.environ.get("DB_HOST",     "127.0.0.1")
    DB_PORT     = int(os.environ.get("DB_PORT",  "3306"))
    DB_NAME     = os.environ.get("DB_NAME",     "order_exception_control_tower")
    DB_USER     = os.environ.get("DB_USER",     "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "root")

    # Webhook auth
    WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "webhook-secret-change-in-prod")

    # Admin API key (for privileged endpoints like admin simulation)
    ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "admin-key-change-in-prod")

    # n8n
    N8N_WEBHOOK_URL = os.environ.get(
        "N8N_WEBHOOK_URL",
        "http://localhost:5678/webhook/order-event"
    )

    # Request limits
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024  # 1 MB


class TestConfig(Config):
    TESTING    = True
    DEBUG      = True
    DB_NAME    = os.environ.get("TEST_DB_NAME", "order_exception_control_tower_test")
    DB_HOST    = os.environ.get("DB_HOST", "127.0.0.1")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "root")
