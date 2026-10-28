"""
Exception and audit helper functions shared across the application.
"""
from datetime import datetime, timezone


def record_exception(cur, order_id: str, exc_type: str, severity: str,
                     owner_team: str, description: str):
    """Insert a row into order_exceptions."""
    cur.execute(
        """INSERT INTO order_exceptions
           (order_id, exception_type, severity, owner_team, description)
           VALUES (%s, %s, %s, %s, %s)""",
        (order_id, exc_type, severity, owner_team, description)
    )


def record_audit(cur, actor: str, action: str, entity_type: str,
                 entity_id: str, summary: str):
    """Insert a row into audit_logs."""
    cur.execute(
        """INSERT INTO audit_logs
           (actor, action, entity_type, entity_id, summary)
           VALUES (%s, %s, %s, %s, %s)""",
        (actor, action, entity_type, entity_id, summary)
    )
