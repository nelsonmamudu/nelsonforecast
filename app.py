import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "nelson_predicts_2025_secret_key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///nelson_predicts.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize the app with the extension
db.init_app(app)

# Import routes and models
from routes import *
from admin_panel import admin_bp

# Register blueprints
app.register_blueprint(admin_bp, url_prefix='/admin')

with app.app_context():
    # Import models to ensure tables are created
    import models
    db.create_all()
    
    # Initialize admin settings if not exists
    from models import AdminSettings
    if not AdminSettings.query.first():
        default_settings = AdminSettings(
            home_win_threshold=65,
            draw_threshold_min=40,
            draw_threshold_max=64,
            away_win_threshold=39,
            form_weight=25,
            home_away_weight=10,
            player_availability_weight=15,
            match_stats_weight=20,
            h2h_weight=10,
            ai_predictions_weight=5,
            odds_agreement_weight=10,
            intangibles_weight=5,
            max_matches_weekday=100,
            max_matches_weekend=300,
            scaling_start_date='2025-07-13'
        )
        db.session.add(default_settings)
        db.session.commit()
