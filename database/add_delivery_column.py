import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

databases = [
    os.getenv("DB_NAME", "order_exception_control_tower"),
    os.getenv("TEST_DB_NAME", "order_exception_control_tower_test"),
]

for db in databases:
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "127.0.0.1"),
            port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "sunny boppana"),
            database=db,
        )
        cur = conn.cursor()
        cur.execute("SHOW COLUMNS FROM orders LIKE 'estimated_delivery_time'")
        res = cur.fetchone()
        if not res:
            cur.execute("ALTER TABLE orders ADD COLUMN estimated_delivery_time VARCHAR(100) NULL AFTER notes")
            conn.commit()
            print(f"Added column estimated_delivery_time to `{db}`.orders table.")
        else:
            print(f"Column estimated_delivery_time already exists in `{db}`.orders.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error checking {db}: {e}")
