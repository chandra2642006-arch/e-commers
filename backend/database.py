"""
Database connection pool and initialization for Order Exception Control Tower.
Uses mysql-connector-python with a simple connection-per-request pattern.
"""
import mysql.connector
from mysql.connector import pooling, Error
import os
import logging
from dotenv import load_dotenv

dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

logger = logging.getLogger(__name__)

_pool: pooling.MySQLConnectionPool | None = None
_pool_db: str | None = None  # tracks which DB the pool was built for


def get_pool() -> pooling.MySQLConnectionPool:
    global _pool, _pool_db
    current_db = os.environ.get("DB_NAME", "order_exception_control_tower")
    if _pool is None or _pool_db != current_db:
        # Use a unique pool name per DB to avoid mysql-connector pool-name conflicts
        _pool = pooling.MySQLConnectionPool(
            pool_name=f"oect_{current_db.replace('-','_')}",
            pool_size=10,
            host     = os.environ.get("DB_HOST",     "127.0.0.1"),
            port     = int(os.environ.get("DB_PORT",  "3306")),
            database = current_db,
            user     = os.environ.get("DB_USER",     "root"),
            password = os.environ.get("DB_PASSWORD", "root"),
            charset  = "utf8mb4",
            autocommit = False,
            connection_timeout = 10,
        )
        _pool_db = current_db
    return _pool


def reset_pool():
    """Force pool recreation on next get_connection call — used in tests."""
    global _pool, _pool_db
    _pool    = None
    _pool_db = None


def get_connection():
    """Return a connection from the pool. Caller must close() it."""
    return get_pool().get_connection()


def init_db():
    """
    Run schema.sql against the server (idempotent).
    The DB_NAME env var determines which database is created/updated.
    """
    schema_path = os.path.join(
        os.path.dirname(__file__), "..", "database", "schema.sql"
    )
    schema_path = os.path.normpath(schema_path)

    db_name = os.environ.get("DB_NAME", "order_exception_control_tower")

    # Connect WITHOUT a database so we can CREATE it if needed
    conn = mysql.connector.connect(
        host     = os.environ.get("DB_HOST",     "127.0.0.1"),
        port     = int(os.environ.get("DB_PORT",  "3306")),
        user     = os.environ.get("DB_USER",     "root"),
        password = os.environ.get("DB_PASSWORD", "root"),
        charset  = "utf8mb4",
        autocommit = True,
    )
    cursor = conn.cursor()
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()

        # Replace the canonical DB name in the schema with the configured DB name
        sql = sql.replace("order_exception_control_tower", db_name)

        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for stmt in statements:
            cursor.execute(stmt)

        logger.info("Database '%s' schema initialised successfully.", db_name)
        reset_pool()  # ensure next connection uses the correct DB
    except Error as e:
        logger.error("Failed to initialise database '%s': %s", db_name, e)
        raise
    finally:
        cursor.close()
        conn.close()
