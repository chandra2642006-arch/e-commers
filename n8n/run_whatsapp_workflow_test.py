"""
Test and execution script for n8n WhatsApp Order Delivery Notification.
Can be run directly via: python n8n/run_whatsapp_workflow_test.py [ORDER_ID]
"""
import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Load environment
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(root_dir, ".env"))

FLASK_API_URL = os.environ.get("FLASK_API_URL", "http://127.0.0.1:5000")
N8N_WEBHOOK_URL = os.environ.get("N8N_WEBHOOK_URL", "http://localhost:5678/webhook/order-event")
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "+14155238886")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "webhook-secret-change-in-prod")


def calculate_two_business_days(start_dt=None):
    if start_dt is None:
        start_dt = datetime.now()
    cur = start_dt
    added = 0
    while added < 2:
        cur += timedelta(days=1)
        if cur.weekday() < 5:  # Monday to Friday
            added += 1
    target = cur.replace(hour=18, minute=0, second=0, microsecond=0)
    return target.strftime("%A, %b %d, %Y by 06:00 PM")


def get_latest_or_specified_order(order_id=None):
    if not order_id:
        req = urllib.request.Request(f"{FLASK_API_URL}/api/orders")
        with urllib.request.urlopen(req) as resp:
            orders = json.loads(resp.read().decode())
            if not orders:
                raise ValueError("No orders found in database.")
            order_id = orders[0]["order_id"]

    req = urllib.request.Request(f"{FLASK_API_URL}/api/orders/{order_id}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def send_twilio_whatsapp(to_phone, message_body):
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("\n⚠️ TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set in .env")
        print("💡 Simulation Mode: The WhatsApp message below is ready for Twilio Sandbox:")
        print("----------------------------------------------------------------------")
        print(message_body)
        print("----------------------------------------------------------------------")
        return {"simulated": True, "status": "ready"}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    data = urllib.parse.urlencode({
        "From": f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
        "To": f"whatsapp:{to_phone}",
        "Body": message_body,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, method="POST")
    import base64
    auth_header = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()).decode()
    req.add_header("Authorization", f"Basic {auth_header}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode())
            print(f"✅ Twilio WhatsApp message sent successfully! SID: {res.get('sid')}")
            return res
    except Exception as e:
        print(f"❌ Twilio WhatsApp error: {e}")
        return {"error": str(e)}


def notify_flask_audit(order_id, recipient, phone, delivery_time):
    url = f"{FLASK_API_URL}/api/webhooks/order-event"
    payload = json.dumps({
        "event_uid": f"WA-{order_id}-{int(datetime.now().timestamp())}",
        "event_type": "WHATSAPP_NOTIFICATION_SENT",
        "order_id": order_id,
        "recipient": recipient,
        "phone": phone,
        "estimated_delivery_time": delivery_time,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Webhook-Secret", WEBHOOK_SECRET)
    try:
        with urllib.request.urlopen(req) as resp:
            print("✅ Logged WhatsApp delivery notification into Flask Control Tower audit log.")
    except Exception as e:
        print(f"⚠️ Flask audit notification skipped: {e}")


def main():
    order_id = sys.argv[1] if len(sys.argv) > 1 else None
    print("🔍 Fetching order details...")
    order = get_latest_or_specified_order(order_id)
    order_id = order["order_id"]
    customer_name = order.get("customer_name", "Valued Customer")
    raw_phone = order.get("customer_phone", "9999999999").strip()
    
    # E.164 phone formatting
    digits = "".join([c for c in raw_phone if c.isdigit()])
    if len(digits) == 10 and not digits.startswith("91"):
        phone = "+91" + digits
    else:
        phone = "+" + digits if not raw_phone.startswith("+") else raw_phone

    delivery_time = order.get("estimated_delivery_time") or calculate_two_business_days()
    total_amount = f"{order.get('total_amount', 0):,.2f}"
    address = f"{order.get('address_line', '')}, {order.get('city', '')} - {order.get('pincode', '')}"

    items_list = order.get("items", [])
    items_text = ""
    if items_list:
        items_text = "\n📦 *Items:* " + ", ".join([f"{it.get('product_name', 'Item')} (x{it.get('quantity', 1)})" for it in items_list])

    message_body = (
        f"🛍️ *Order Confirmed!*\n\n"
        f"Hello *{customer_name}*, your order *#{order_id}* has been received successfully!\n\n"
        f"🚚 *Estimated Delivery Time:*\n"
        f"👉 *{delivery_time}*\n\n"
        f"📍 *Delivery Address:* {address}{items_text}\n"
        f"💰 *Total Amount:* ₹{total_amount}\n\n"
        f"Thank you for shopping with us! You will receive another update when your package is out for delivery."
    )

    print(f"\n📦 Order ID: {order_id}")
    print(f"👤 Customer: {customer_name}")
    print(f"📞 WhatsApp Recipient: {phone}")
    print(f"🚚 Estimated Delivery: {delivery_time}")

    # Dispatch WhatsApp
    send_twilio_whatsapp(phone, message_body)

    # Log to Flask
    notify_flask_audit(order_id, customer_name, phone, delivery_time)


if __name__ == "__main__":
    main()
