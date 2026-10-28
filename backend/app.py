"""
Order Exception Control Tower — Flask Application
Entry point: run `python app.py` or via gunicorn/Docker.
"""
import os
from flask import Flask
from flask_cors import CORS

from config import Config
from database import init_db
from routes.products  import products_bp
from routes.orders    import orders_bp
from routes.exceptions import exceptions_bp
from routes.dashboard import dashboard_bp
from routes.webhooks  import webhooks_bp
from routes.admin     import admin_bp
from routes.health    import health_bp


def create_app(config_class=Config):
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
    app.config.from_object(config_class)

    # Allow all origins for local dev; restrict in production
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Serve index.html at root
    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(exceptions_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(webhooks_bp)
    app.register_blueprint(admin_bp)

    @app.errorhandler(404)
    def not_found(e):
        from flask import jsonify
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        from flask import jsonify
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        from flask import jsonify
        return jsonify({"error": "Internal server error"}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    init_db()
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", False))
