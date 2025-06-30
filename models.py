from app import db
from datetime import datetime
import json

class League(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    country = db.Column(db.String(50), nullable=False)
    logo_url = db.Column(db.String(255))
    flag_url = db.Column(db.String(255))
    season = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    country = db.Column(db.String(50))
    logo_url = db.Column(db.String(255))
    founded = db.Column(db.Integer)
    venue_name = db.Column(db.String(100))
    venue_capacity = db.Column(db.Integer)
    league_id = db.Column(db.Integer, db.ForeignKey('league.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer)
    position = db.Column(db.String(50))
    nationality = db.Column(db.String(50))
    height = db.Column(db.String(10))
    weight = db.Column(db.String(10))
    jersey_number = db.Column(db.Integer)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'))
    photo_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Fixture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    home_team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    away_team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    league_id = db.Column(db.Integer, db.ForeignKey('league.id'), nullable=False)
    kickoff_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='Not Started')
    home_score = db.Column(db.Integer, default=0)
    away_score = db.Column(db.Integer, default=0)
    venue = db.Column(db.String(100))
    referee = db.Column(db.String(100))
    round_info = db.Column(db.String(50))
    importance_level = db.Column(db.String(20))  # Derby, Relegation, Final, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    home_team = db.relationship('Team', foreign_keys=[home_team_id], backref='home_fixtures')
    away_team = db.relationship('Team', foreign_keys=[away_team_id], backref='away_fixtures')
    league = db.relationship('League', backref='fixtures')

class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fixture_id = db.Column(db.Integer, db.ForeignKey('fixture.id'), nullable=False)
    prediction = db.Column(db.String(20), nullable=False)  # Home, Draw, Away
    confidence = db.Column(db.Float, nullable=False)
    reasoning = db.Column(db.Text)
    criteria_scores = db.Column(db.Text)  # JSON string of individual criteria scores
    data_warnings = db.Column(db.Text)  # JSON string of missing data warnings
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    fixture = db.relationship('Fixture', backref='predictions')

class PredictionAggregation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fixture_id = db.Column(db.Integer, db.ForeignKey('fixture.id'), nullable=False)
    source_name = db.Column(db.String(50), nullable=False)
    prediction = db.Column(db.String(20), nullable=False)
    confidence = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    fixture = db.relationship('Fixture', backref='aggregated_predictions')

class BettingOdds(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fixture_id = db.Column(db.Integer, db.ForeignKey('fixture.id'), nullable=False)
    bookmaker = db.Column(db.String(50), nullable=False)
    home_odds = db.Column(db.Float)
    draw_odds = db.Column(db.Float)
    away_odds = db.Column(db.Float)
    over_under_odds = db.Column(db.Text)  # JSON for various over/under markets
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    fixture = db.relationship('Fixture', backref='betting_odds')

class Standings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    league_id = db.Column(db.Integer, db.ForeignKey('league.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    points = db.Column(db.Integer, default=0)
    wins = db.Column(db.Integer, default=0)
    draws = db.Column(db.Integer, default=0)
    losses = db.Column(db.Integer, default=0)
    goals_for = db.Column(db.Integer, default=0)
    goals_against = db.Column(db.Integer, default=0)
    goal_difference = db.Column(db.Integer, default=0)
    home_wins = db.Column(db.Integer, default=0)
    home_draws = db.Column(db.Integer, default=0)
    home_losses = db.Column(db.Integer, default=0)
    away_wins = db.Column(db.Integer, default=0)
    away_draws = db.Column(db.Integer, default=0)
    away_losses = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    league = db.relationship('League', backref='standings')
    team = db.relationship('Team', backref='standings')

class PlayerStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    season = db.Column(db.String(20), nullable=False)
    appearances = db.Column(db.Integer, default=0)
    goals = db.Column(db.Integer, default=0)
    assists = db.Column(db.Integer, default=0)
    yellow_cards = db.Column(db.Integer, default=0)
    red_cards = db.Column(db.Integer, default=0)
    minutes_played = db.Column(db.Integer, default=0)
    pass_accuracy = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    player = db.relationship('Player', backref='stats')

class MatchStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fixture_id = db.Column(db.Integer, db.ForeignKey('fixture.id'), nullable=False)
    home_possession = db.Column(db.Float)
    away_possession = db.Column(db.Float)
    home_shots = db.Column(db.Integer)
    away_shots = db.Column(db.Integer)
    home_shots_on_target = db.Column(db.Integer)
    away_shots_on_target = db.Column(db.Integer)
    home_corners = db.Column(db.Integer)
    away_corners = db.Column(db.Integer)
    home_fouls = db.Column(db.Integer)
    away_fouls = db.Column(db.Integer)
    home_yellow_cards = db.Column(db.Integer)
    away_yellow_cards = db.Column(db.Integer)
    home_red_cards = db.Column(db.Integer)
    away_red_cards = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    fixture = db.relationship('Fixture', backref='match_stats')

class InjurySuspension(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # Injury or Suspension
    reason = db.Column(db.String(100))
    status = db.Column(db.String(20))  # Out, Doubtful, Back
    estimated_return = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    player = db.relationship('Player', backref='injuries_suspensions')

class BookmarkedMatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fixture_id = db.Column(db.Integer, db.ForeignKey('fixture.id'), nullable=False)
    user_session = db.Column(db.String(100), nullable=False)  # Session-based storage
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    fixture = db.relationship('Fixture', backref='bookmarks')

class PerformanceTracker(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    total_predictions = db.Column(db.Integer, default=0)
    correct_predictions = db.Column(db.Integer, default=0)
    home_win_predictions = db.Column(db.Integer, default=0)
    home_win_correct = db.Column(db.Integer, default=0)
    draw_predictions = db.Column(db.Integer, default=0)
    draw_correct = db.Column(db.Integer, default=0)
    away_win_predictions = db.Column(db.Integer, default=0)
    away_win_correct = db.Column(db.Integer, default=0)
    accuracy_percentage = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AdminSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    home_win_threshold = db.Column(db.Float, default=65.0)
    draw_threshold_min = db.Column(db.Float, default=40.0)
    draw_threshold_max = db.Column(db.Float, default=64.0)
    away_win_threshold = db.Column(db.Float, default=39.0)
    form_weight = db.Column(db.Float, default=25.0)
    home_away_weight = db.Column(db.Float, default=10.0)
    player_availability_weight = db.Column(db.Float, default=15.0)
    match_stats_weight = db.Column(db.Float, default=20.0)
    h2h_weight = db.Column(db.Float, default=10.0)
    ai_predictions_weight = db.Column(db.Float, default=5.0)
    odds_agreement_weight = db.Column(db.Float, default=10.0)
    intangibles_weight = db.Column(db.Float, default=5.0)
    max_matches_weekday = db.Column(db.Integer, default=100)
    max_matches_weekend = db.Column(db.Integer, default=300)
    scaling_start_date = db.Column(db.String(20), default='2025-07-13')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CacheManagement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cache_key = db.Column(db.String(255), unique=True, nullable=False)
    cache_data = db.Column(db.Text, nullable=False)
    expiry_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserPreferences(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_session = db.Column(db.String(100), nullable=False)
    favorite_teams = db.Column(db.Text)  # JSON string of team IDs
    favorite_leagues = db.Column(db.Text)  # JSON string of league IDs
    theme_preference = db.Column(db.String(20), default='light')
    lightweight_mode = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
