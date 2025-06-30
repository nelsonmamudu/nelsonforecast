import requests
from bs4 import BeautifulSoup
import json
import logging
from datetime import datetime, date, timedelta
from app import db
from models import *
import time
import random
from urllib.parse import urljoin, quote
import os

class ScrapingService:
    def __init__(self):
        self.api_key = os.environ.get("API_FOOTBALL_KEY", "default_key")
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # Prediction sites for aggregation
        self.prediction_sites = [
            'https://www.forebet.com',
            'https://www.predictz.com',
            'https://www.betimate.com',
            'https://www.windrawwin.com',
            'https://www.footballpredictions.net',
            'https://www.soccervista.com',
            'https://www.tips180.com',
            'https://www.zulubet.com',
            'https://www.betensured.com',
            'https://www.aifootball.com'
        ]
    
    def get_dynamic_match_limit(self):
        """Get current match limit based on date and admin settings"""
        try:
            settings = AdminSettings.query.first()
            if not settings:
                return 50  # Default fallback
            
            today = date.today()
            scaling_start = datetime.strptime(settings.scaling_start_date, '%Y-%m-%d').date()
            
            if today < scaling_start:
                return 50  # Current implementation
            
            # Check if today is weekend (Saturday=5, Sunday=6)
            if today.weekday() >= 5:
                return settings.max_matches_weekend
            else:
                return settings.max_matches_weekday
                
        except Exception as e:
            logging.error(f"Error getting dynamic match limit: {e}")
            return 50
    
    def scrape_fixtures_today(self):
        """Scrape today's fixtures with dynamic scaling"""
        try:
            limit = self.get_dynamic_match_limit()
            logging.info(f"Scraping up to {limit} matches for today")
            
            # Try API-Football first
            fixtures = self._scrape_fixtures_api()
            if not fixtures:
                # Fallback to web scraping
                fixtures = self._scrape_fixtures_web()
            
            # Limit results based on dynamic scaling
            return fixtures[:limit]
            
        except Exception as e:
            logging.error(f"Error scraping fixtures: {e}")
            return []
    
    def _scrape_fixtures_api(self):
        """Scrape fixtures using API-Football"""
        try:
            today_str = date.today().strftime('%Y-%m-%d')
            url = f"https://v3.football.api-sports.io/fixtures"
            
            headers = {
                'X-RapidAPI-Key': self.api_key,
                'X-RapidAPI-Host': 'v3.football.api-sports.io'
            }
            
            params = {
                'date': today_str,
                'status': 'NS-1H-HT-2H-ET-P-FT-AET-PEN'
            }
            
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                fixtures = []
                
                for match in data.get('response', []):
                    fixture_data = {
                        'id': match['fixture']['id'],
                        'home_team': match['teams']['home']['name'],
                        'away_team': match['teams']['away']['name'],
                        'league': match['league']['name'],
                        'kickoff_time': match['fixture']['date'],
                        'status': match['fixture']['status']['long'],
                        'venue': match['fixture']['venue']['name'],
                        'referee': match['fixture']['referee']
                    }
                    fixtures.append(fixture_data)
                
                return fixtures
            
        except Exception as e:
            logging.error(f"API scraping failed: {e}")
            
        return []
    
    def _scrape_fixtures_web(self):
        """Fallback web scraping for fixtures"""
        try:
            # Scrape from multiple sources
            sources = [
                'https://www.flashscore.com',
                'https://www.sofascore.com'
            ]
            
            for source in sources:
                try:
                    fixtures = self._scrape_from_source(source)
                    if fixtures:
                        return fixtures
                except:
                    continue
            
            return []
            
        except Exception as e:
            logging.error(f"Web scraping failed: {e}")
            return []
    
    def _scrape_from_source(self, source_url):
        """Scrape fixtures from a specific source"""
        try:
            response = self.session.get(source_url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # This would need specific parsing logic for each site
            # For demo purposes, returning sample structure
            fixtures = []
            
            # Add rate limiting
            time.sleep(random.uniform(1, 3))
            
            return fixtures
            
        except Exception as e:
            logging.error(f"Error scraping from {source_url}: {e}")
            return []
    
    def scrape_prediction_aggregation(self, fixture_id):
        """Scrape predictions from multiple sites for a fixture"""
        try:
            predictions = []
            
            for site in self.prediction_sites:
                try:
                    prediction = self._scrape_site_prediction(site, fixture_id)
                    if prediction:
                        predictions.append(prediction)
                    
                    # Rate limiting
                    time.sleep(random.uniform(2, 5))
                    
                except Exception as e:
                    logging.error(f"Error scraping {site}: {e}")
                    continue
            
            # Calculate consensus
            if predictions:
                consensus = self._calculate_prediction_consensus(predictions)
                
                # Save aggregated predictions
                for pred in predictions:
                    aggregation = PredictionAggregation(
                        fixture_id=fixture_id,
                        source_name=pred['source'],
                        prediction=pred['prediction'],
                        confidence=pred.get('confidence', 0.0)
                    )
                    db.session.add(aggregation)
                
                db.session.commit()
                return consensus
            
            return None
            
        except Exception as e:
            logging.error(f"Error in prediction aggregation: {e}")
            return None
    
    def _scrape_site_prediction(self, site_url, fixture_id):
        """Scrape prediction from a specific site"""
        try:
            # This would need specific parsing logic for each prediction site
            # For now, returning sample data
            
            response = self.session.get(site_url, timeout=10)
            if response.status_code == 200:
                # Parse prediction (site-specific logic needed)
                return {
                    'source': site_url.split('//')[1].split('.')[1],  # Extract site name
                    'prediction': random.choice(['Home', 'Draw', 'Away']),  # Sample
                    'confidence': random.uniform(40, 90)  # Sample
                }
            
        except Exception as e:
            logging.error(f"Error scraping prediction from {site_url}: {e}")
            
        return None
    
    def _calculate_prediction_consensus(self, predictions):
        """Calculate consensus from multiple predictions"""
        try:
            home_count = sum(1 for p in predictions if p['prediction'] == 'Home')
            draw_count = sum(1 for p in predictions if p['prediction'] == 'Draw')
            away_count = sum(1 for p in predictions if p['prediction'] == 'Away')
            
            total = len(predictions)
            
            # Determine majority prediction
            if home_count > draw_count and home_count > away_count:
                consensus_prediction = 'Home'
                confidence = (home_count / total) * 100
            elif draw_count > away_count:
                consensus_prediction = 'Draw'
                confidence = (draw_count / total) * 100
            else:
                consensus_prediction = 'Away'
                confidence = (away_count / total) * 100
            
            return {
                'prediction': consensus_prediction,
                'confidence': confidence,
                'breakdown': {
                    'home': home_count,
                    'draw': draw_count,
                    'away': away_count,
                    'total': total
                },
                'sources': [p['source'] for p in predictions]
            }
            
        except Exception as e:
            logging.error(f"Error calculating consensus: {e}")
            return None
    
    def scrape_betting_odds(self, fixture_id):
        """Scrape betting odds from multiple bookmakers"""
        try:
            odds_sources = [
                'https://www.oddsportal.com',
                'https://www.betexplorer.com',
                'https://www.bet365.com'
            ]
            
            all_odds = []
            
            for source in odds_sources:
                try:
                    odds = self._scrape_odds_from_source(source, fixture_id)
                    if odds:
                        all_odds.extend(odds)
                    
                    time.sleep(random.uniform(1, 3))
                    
                except Exception as e:
                    logging.error(f"Error scraping odds from {source}: {e}")
                    continue
            
            # Save odds to database
            for odd in all_odds:
                betting_odd = BettingOdds(
                    fixture_id=fixture_id,
                    bookmaker=odd['bookmaker'],
                    home_odds=odd['home_odds'],
                    draw_odds=odd['draw_odds'],
                    away_odds=odd['away_odds']
                )
                db.session.add(betting_odd)
            
            db.session.commit()
            return all_odds
            
        except Exception as e:
            logging.error(f"Error scraping betting odds: {e}")
            return []
    
    def _scrape_odds_from_source(self, source_url, fixture_id):
        """Scrape odds from a specific bookmaker"""
        try:
            # This would need specific parsing logic for each odds site
            # For demo purposes, returning sample data
            
            bookmaker_name = source_url.split('//')[1].split('.')[1]
            
            return [{
                'bookmaker': bookmaker_name,
                'home_odds': round(random.uniform(1.5, 4.0), 2),
                'draw_odds': round(random.uniform(2.8, 4.5), 2),
                'away_odds': round(random.uniform(1.8, 5.0), 2)
            }]
            
        except Exception as e:
            logging.error(f"Error scraping odds from {source_url}: {e}")
            return []
    
    def scrape_team_data(self, league_id):
        """Scrape team data for a league"""
        try:
            # Implementation for scraping team data
            # This would use API-Football or web scraping
            pass
            
        except Exception as e:
            logging.error(f"Error scraping team data: {e}")
    
    def scrape_player_data(self, team_id):
        """Scrape player data for a team"""
        try:
            # Implementation for scraping player data
            pass
            
        except Exception as e:
            logging.error(f"Error scraping player data: {e}")
    
    def scrape_standings(self, league_id):
        """Scrape league standings"""
        try:
            # Implementation for scraping standings
            pass
            
        except Exception as e:
            logging.error(f"Error scraping standings: {e}")
    
    def scrape_live_scores(self):
        """Scrape live scores and update fixtures"""
        try:
            # Implementation for live score updates
            pass
            
        except Exception as e:
            logging.error(f"Error scraping live scores: {e}")
    
    def detect_match_importance(self, fixture):
        """Detect if a match has special importance"""
        try:
            importance_level = None
            
            # Derby detection (same city/region teams)
            # This would need geographic data
            
            # Relegation battle detection
            # Check standings positions
            
            # Finals/Semi-finals detection
            if 'final' in fixture.round_info.lower():
                importance_level = 'Final'
            elif 'semi' in fixture.round_info.lower():
                importance_level = 'Semi-Final'
            
            # Champions League detection
            if 'champions league' in fixture.league.name.lower():
                importance_level = 'Champions League'
            elif 'europa league' in fixture.league.name.lower():
                importance_level = 'Europa League'
            
            return importance_level
            
        except Exception as e:
            logging.error(f"Error detecting match importance: {e}")
            return None
