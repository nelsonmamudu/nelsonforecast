from flask import render_template, request, jsonify, session
from app import app, db
from models import *
from scraper import ScrapingService
from prediction_engine import PredictionEngine
from utils import get_user_session, calculate_confidence_color, format_confidence_display
import json
from datetime import datetime, date, timedelta
import logging

# Initialize services
scraping_service = ScrapingService()
prediction_engine = PredictionEngine()

@app.route('/')
def index():
    """Homepage with today's matches and predictions"""
    try:
        today = date.today()
        user_session = get_user_session()
        
        # Get user preferences
        user_prefs = UserPreferences.query.filter_by(user_session=user_session).first()
        lightweight_mode = user_prefs.lightweight_mode if user_prefs else False
        
        # Get today's fixtures with predictions
        fixtures = db.session.query(Fixture).filter(
            db.func.date(Fixture.kickoff_time) == today
        ).order_by(Fixture.kickoff_time).limit(50).all()
        
        # Enrich fixtures with predictions and confidence
        enriched_fixtures = []
        for fixture in fixtures:
            prediction = Prediction.query.filter_by(fixture_id=fixture.id).first()
            
            fixture_data = {
                'fixture': fixture,
                'prediction': prediction,
                'confidence_color': calculate_confidence_color(prediction.confidence) if prediction else 'secondary',
                'confidence_display': format_confidence_display(prediction) if prediction else None,
                'importance_icon': get_importance_icon(fixture.importance_level),
                'is_bookmarked': check_bookmark_status(fixture.id, user_session)
            }
            enriched_fixtures.append(fixture_data)
        
        # Get performance tracker stats
        performance_today = PerformanceTracker.query.filter_by(date=today).first()
        
        return render_template('index.html', 
                             fixtures=enriched_fixtures,
                             performance=performance_today,
                             lightweight_mode=lightweight_mode,
                             today=today)
    except Exception as e:
        logging.error(f"Error in index route: {e}")
        return render_template('index.html', fixtures=[], error="Failed to load fixtures")

@app.route('/fixtures')
def fixtures():
    """Fixtures and results view with filtering"""
    try:
        # Get filter parameters
        league_id = request.args.get('league')
        team_id = request.args.get('team')
        date_filter = request.args.get('date', 'today')
        status_filter = request.args.get('status', 'all')
        
        query = db.session.query(Fixture)
        
        # Apply filters
        if league_id:
            query = query.filter(Fixture.league_id == league_id)
        if team_id:
            query = query.filter(
                (Fixture.home_team_id == team_id) | (Fixture.away_team_id == team_id)
            )
        
        # Date filtering
        if date_filter == 'today':
            query = query.filter(db.func.date(Fixture.kickoff_time) == date.today())
        elif date_filter == 'tomorrow':
            query = query.filter(db.func.date(Fixture.kickoff_time) == date.today() + timedelta(days=1))
        elif date_filter == 'week':
            week_start = date.today()
            week_end = week_start + timedelta(days=7)
            query = query.filter(Fixture.kickoff_time.between(week_start, week_end))
        
        # Status filtering
        if status_filter != 'all':
            query = query.filter(Fixture.status == status_filter)
        
        fixtures = query.order_by(Fixture.kickoff_time).all()
        
        # Get all leagues and teams for filter dropdowns
        leagues = League.query.all()
        teams = Team.query.all()
        
        return render_template('fixtures.html', 
                             fixtures=fixtures,
                             leagues=leagues,
                             teams=teams,
                             current_filters={
                                 'league': league_id,
                                 'team': team_id,
                                 'date': date_filter,
                                 'status': status_filter
                             })
    except Exception as e:
        logging.error(f"Error in fixtures route: {e}")
        return render_template('fixtures.html', fixtures=[], error="Failed to load fixtures")

@app.route('/team/<int:team_id>')
def team_detail(team_id):
    """Detailed team page with squad and statistics"""
    try:
        team = Team.query.get_or_404(team_id)
        players = Player.query.filter_by(team_id=team_id).all()
        
        # Get team standings
        standing = Standings.query.filter_by(team_id=team_id).first()
        
        # Get recent fixtures
        recent_fixtures = db.session.query(Fixture).filter(
            ((Fixture.home_team_id == team_id) | (Fixture.away_team_id == team_id)) &
            (Fixture.status == 'Finished')
        ).order_by(Fixture.kickoff_time.desc()).limit(5).all()
        
        # Get upcoming fixtures
        upcoming_fixtures = db.session.query(Fixture).filter(
            ((Fixture.home_team_id == team_id) | (Fixture.away_team_id == team_id)) &
            (Fixture.status == 'Not Started')
        ).order_by(Fixture.kickoff_time).limit(5).all()
        
        return render_template('team.html', 
                             team=team,
                             players=players,
                             standing=standing,
                             recent_fixtures=recent_fixtures,
                             upcoming_fixtures=upcoming_fixtures)
    except Exception as e:
        logging.error(f"Error in team detail route: {e}")
        return render_template('team.html', team=None, error="Failed to load team data")

@app.route('/player/<int:player_id>')
def player_detail(player_id):
    """Detailed player page with statistics and bio"""
    try:
        player = Player.query.get_or_404(player_id)
        stats = PlayerStats.query.filter_by(player_id=player_id).all()
        injuries = InjurySuspension.query.filter_by(player_id=player_id).order_by(
            InjurySuspension.created_at.desc()
        ).limit(5).all()
        
        return render_template('player.html', 
                             player=player,
                             stats=stats,
                             injuries=injuries)
    except Exception as e:
        logging.error(f"Error in player detail route: {e}")
        return render_template('player.html', player=None, error="Failed to load player data")

@app.route('/league/<int:league_id>')
def league_detail(league_id):
    """League page with standings and fixtures"""
    try:
        league = League.query.get_or_404(league_id)
        standings = Standings.query.filter_by(league_id=league_id).order_by(Standings.position).all()
        
        # Get recent fixtures
        recent_fixtures = Fixture.query.filter_by(
            league_id=league_id
        ).order_by(Fixture.kickoff_time.desc()).limit(10).all()
        
        return render_template('league.html', 
                             league=league,
                             standings=standings,
                             fixtures=recent_fixtures)
    except Exception as e:
        logging.error(f"Error in league detail route: {e}")
        return render_template('league.html', league=None, error="Failed to load league data")

@app.route('/bookmarks')
def bookmarks():
    """User's bookmarked matches"""
    try:
        user_session = get_user_session()
        bookmarked_fixtures = db.session.query(Fixture).join(BookmarkedMatch).filter(
            BookmarkedMatch.user_session == user_session
        ).order_by(Fixture.kickoff_time).all()
        
        # Enrich with predictions
        enriched_fixtures = []
        for fixture in bookmarked_fixtures:
            prediction = Prediction.query.filter_by(fixture_id=fixture.id).first()
            fixture_data = {
                'fixture': fixture,
                'prediction': prediction,
                'confidence_color': calculate_confidence_color(prediction.confidence) if prediction else 'secondary',
                'confidence_display': format_confidence_display(prediction) if prediction else None
            }
            enriched_fixtures.append(fixture_data)
        
        return render_template('bookmarks.html', fixtures=enriched_fixtures)
    except Exception as e:
        logging.error(f"Error in bookmarks route: {e}")
        return render_template('bookmarks.html', fixtures=[], error="Failed to load bookmarks")

@app.route('/dashboard')
def dashboard():
    """User dashboard with personalized data"""
    try:
        user_session = get_user_session()
        user_prefs = UserPreferences.query.filter_by(user_session=user_session).first()
        
        # Get favorite teams and leagues
        favorite_teams = []
        favorite_leagues = []
        
        if user_prefs:
            if user_prefs.favorite_teams:
                team_ids = json.loads(user_prefs.favorite_teams)
                favorite_teams = Team.query.filter(Team.id.in_(team_ids)).all()
            
            if user_prefs.favorite_leagues:
                league_ids = json.loads(user_prefs.favorite_leagues)
                favorite_leagues = League.query.filter(League.id.in_(league_ids)).all()
        
        # Get fixtures for favorite teams
        favorite_fixtures = []
        if favorite_teams:
            team_ids = [team.id for team in favorite_teams]
            favorite_fixtures = db.session.query(Fixture).filter(
                (Fixture.home_team_id.in_(team_ids)) | (Fixture.away_team_id.in_(team_ids))
            ).filter(
                db.func.date(Fixture.kickoff_time) >= date.today()
            ).order_by(Fixture.kickoff_time).limit(10).all()
        
        # Get performance stats
        recent_performance = PerformanceTracker.query.order_by(
            PerformanceTracker.date.desc()
        ).limit(7).all()
        
        return render_template('dashboard.html', 
                             user_prefs=user_prefs,
                             favorite_teams=favorite_teams,
                             favorite_leagues=favorite_leagues,
                             favorite_fixtures=favorite_fixtures,
                             performance_history=recent_performance)
    except Exception as e:
        logging.error(f"Error in dashboard route: {e}")
        return render_template('dashboard.html', error="Failed to load dashboard")

@app.route('/calendar')
def prediction_calendar():
    """Calendar view of predictions"""
    try:
        month = request.args.get('month', date.today().month)
        year = request.args.get('year', date.today().year)
        
        # Get fixtures for the month
        start_date = date(int(year), int(month), 1)
        if int(month) == 12:
            end_date = date(int(year) + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(int(year), int(month) + 1, 1) - timedelta(days=1)
        
        fixtures = Fixture.query.filter(
            Fixture.kickoff_time.between(start_date, end_date)
        ).order_by(Fixture.kickoff_time).all()
        
        # Group by date with predictions
        calendar_data = {}
        for fixture in fixtures:
            fixture_date = fixture.kickoff_time.date()
            if fixture_date not in calendar_data:
                calendar_data[fixture_date] = []
            
            prediction = Prediction.query.filter_by(fixture_id=fixture.id).first()
            calendar_data[fixture_date].append({
                'fixture': fixture,
                'prediction': prediction,
                'confidence_color': calculate_confidence_color(prediction.confidence) if prediction else 'secondary'
            })
        
        return render_template('calendar.html', 
                             calendar_data=calendar_data,
                             current_month=int(month),
                             current_year=int(year))
    except Exception as e:
        logging.error(f"Error in calendar route: {e}")
        return render_template('calendar.html', error="Failed to load calendar")

# API Routes
@app.route('/api/predict/<int:fixture_id>')
def api_predict(fixture_id):
    """Generate prediction for a specific fixture"""
    try:
        fixture = Fixture.query.get_or_404(fixture_id)
        
        # Check if prediction already exists
        existing_prediction = Prediction.query.filter_by(fixture_id=fixture_id).first()
        if existing_prediction:
            return jsonify({
                'prediction': existing_prediction.prediction,
                'confidence': existing_prediction.confidence,
                'reasoning': existing_prediction.reasoning,
                'cached': True
            })
        
        # Generate new prediction
        result = prediction_engine.predict_match(fixture)
        
        # Save prediction
        prediction = Prediction(
            fixture_id=fixture_id,
            prediction=result['prediction'],
            confidence=result['confidence'],
            reasoning=result['reasoning'],
            criteria_scores=json.dumps(result.get('criteria_scores', {})),
            data_warnings=json.dumps(result.get('warnings', []))
        )
        db.session.add(prediction)
        db.session.commit()
        
        return jsonify(result)
    except Exception as e:
        logging.error(f"Error in predict API: {e}")
        return jsonify({'error': 'Failed to generate prediction'}), 500

@app.route('/api/bookmark/<int:fixture_id>', methods=['POST', 'DELETE'])
def api_bookmark(fixture_id):
    """Toggle bookmark status for a fixture"""
    try:
        user_session = get_user_session()
        
        if request.method == 'POST':
            # Add bookmark
            existing = BookmarkedMatch.query.filter_by(
                fixture_id=fixture_id, 
                user_session=user_session
            ).first()
            
            if not existing:
                bookmark = BookmarkedMatch(
                    fixture_id=fixture_id,
                    user_session=user_session
                )
                db.session.add(bookmark)
                db.session.commit()
            
            return jsonify({'bookmarked': True})
        
        else:  # DELETE
            bookmark = BookmarkedMatch.query.filter_by(
                fixture_id=fixture_id, 
                user_session=user_session
            ).first()
            
            if bookmark:
                db.session.delete(bookmark)
                db.session.commit()
            
            return jsonify({'bookmarked': False})
    
    except Exception as e:
        logging.error(f"Error in bookmark API: {e}")
        return jsonify({'error': 'Failed to update bookmark'}), 500

@app.route('/api/user/preferences', methods=['GET', 'POST'])
def api_user_preferences():
    """Get or update user preferences"""
    try:
        user_session = get_user_session()
        
        if request.method == 'GET':
            prefs = UserPreferences.query.filter_by(user_session=user_session).first()
            if prefs:
                return jsonify({
                    'theme': prefs.theme_preference,
                    'lightweight_mode': prefs.lightweight_mode,
                    'favorite_teams': json.loads(prefs.favorite_teams) if prefs.favorite_teams else [],
                    'favorite_leagues': json.loads(prefs.favorite_leagues) if prefs.favorite_leagues else []
                })
            else:
                return jsonify({
                    'theme': 'light',
                    'lightweight_mode': False,
                    'favorite_teams': [],
                    'favorite_leagues': []
                })
        
        else:  # POST
            data = request.json
            prefs = UserPreferences.query.filter_by(user_session=user_session).first()
            
            if not prefs:
                prefs = UserPreferences(user_session=user_session)
            
            if 'theme' in data:
                prefs.theme_preference = data['theme']
            if 'lightweight_mode' in data:
                prefs.lightweight_mode = data['lightweight_mode']
            if 'favorite_teams' in data:
                prefs.favorite_teams = json.dumps(data['favorite_teams'])
            if 'favorite_leagues' in data:
                prefs.favorite_leagues = json.dumps(data['favorite_leagues'])
            
            db.session.add(prefs)
            db.session.commit()
            
            return jsonify({'success': True})
    
    except Exception as e:
        logging.error(f"Error in user preferences API: {e}")
        return jsonify({'error': 'Failed to update preferences'}), 500

@app.route('/api/search')
def api_search():
    """Global search for teams, leagues, players"""
    try:
        query = request.args.get('q', '').strip()
        if len(query) < 2:
            return jsonify({'results': []})
        
        results = []
        
        # Search teams
        teams = Team.query.filter(Team.name.ilike(f'%{query}%')).limit(5).all()
        for team in teams:
            results.append({
                'type': 'team',
                'id': team.id,
                'name': team.name,
                'country': team.country,
                'url': f'/team/{team.id}'
            })
        
        # Search leagues
        leagues = League.query.filter(League.name.ilike(f'%{query}%')).limit(5).all()
        for league in leagues:
            results.append({
                'type': 'league',
                'id': league.id,
                'name': league.name,
                'country': league.country,
                'url': f'/league/{league.id}'
            })
        
        # Search players
        players = Player.query.filter(Player.name.ilike(f'%{query}%')).limit(5).all()
        for player in players:
            results.append({
                'type': 'player',
                'id': player.id,
                'name': player.name,
                'position': player.position,
                'url': f'/player/{player.id}'
            })
        
        return jsonify({'results': results})
    
    except Exception as e:
        logging.error(f"Error in search API: {e}")
        return jsonify({'error': 'Search failed'}), 500

def get_importance_icon(importance_level):
    """Get icon for match importance"""
    icons = {
        'Derby': '🔥',
        'Relegation': '❗',
        'Final': '🏆',
        'Semi-Final': '🏆',
        'Champions League': '⭐',
        'Europa League': '🌟'
    }
    return icons.get(importance_level, '')

def check_bookmark_status(fixture_id, user_session):
    """Check if fixture is bookmarked by user"""
    return BookmarkedMatch.query.filter_by(
        fixture_id=fixture_id, 
        user_session=user_session
    ).first() is not None
