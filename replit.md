# NelsonPredicts - Football Prediction Platform

## Overview

NelsonPredicts is a comprehensive football prediction platform that combines web scraping, AI-powered prediction algorithms, and real-time performance tracking to provide accurate football match predictions. The system uses Flask as the backend framework with SQLAlchemy for database management, offering both regular and administrative interfaces for managing predictions and system settings.

## System Architecture

### Backend Architecture
- **Framework**: Flask web application with Blueprint-based modular design
- **Database**: SQLAlchemy ORM with support for both SQLite (development) and PostgreSQL (production)
- **Core Components**:
  - Main application (`app.py`) with database configuration
  - Route handlers (`routes.py`) for public endpoints
  - Admin panel (`admin_panel.py`) for system management
  - Prediction engine (`prediction_engine.py`) for match analysis
  - Web scraping service (`scraper.py`) for data collection
  - Utility functions (`utils.py`) for common operations

### Frontend Architecture
- **Templates**: Jinja2-based HTML templates with Bootstrap 5 styling
- **JavaScript**: Modular client-side scripts for:
  - Bookmark management (`bookmarks.js`)
  - Calendar functionality (`calendar.js`)
  - Performance tracking (`performance.js`)
  - Main application logic (`main.js`)
- **Styling**: Custom CSS with theme support (light/dark modes)

### Database Schema
The system uses a relational database with the following key entities:
- **League**: Football competitions with country and season information
- **Team**: Football clubs with venue and founding details
- **Player**: Individual players with position and physical attributes
- **Fixture**: Match data including teams, kickoff times, and results
- **Prediction**: AI-generated predictions with confidence levels
- **PerformanceTracker**: System accuracy tracking over time
- **AdminSettings**: Configurable system parameters and thresholds

## Key Components

### Prediction Engine
The core prediction algorithm weighs multiple factors:
- Form and standings (25% weight)
- Home/away performance (10% weight)
- Player availability (15% weight)
- Match statistics (20% weight)
- Head-to-head records (10% weight)
- AI predictions (5% weight)
- Betting odds agreement (10% weight)
- Intangible factors (5% weight)

### Web Scraping Service
Aggregates data from multiple prediction websites and football APIs:
- Supports 10+ prediction sources
- Rate limiting and error handling
- Dynamic match limit scaling
- API integration for fixture and team data

### Admin Panel
Comprehensive system management interface:
- Real-time performance monitoring
- Prediction threshold configuration
- System statistics and analytics
- Cache management and optimization

### User Features
- Bookmark system for favorite matches
- Calendar view for prediction scheduling
- Performance tracking and accuracy metrics
- Lightweight mode for reduced data usage
- Theme switching (light/dark modes)

## Data Flow

1. **Data Collection**: Scraping service fetches fixture data from external APIs and prediction sites
2. **Prediction Generation**: Engine analyzes collected data using weighted algorithms
3. **Storage**: Predictions and performance metrics stored in database
4. **Display**: Web interface presents predictions with confidence indicators
5. **Tracking**: System monitors prediction accuracy and updates performance metrics

## External Dependencies

### Backend Dependencies
- Flask and Flask-SQLAlchemy for web framework and ORM
- Requests and BeautifulSoup for web scraping
- Standard Python libraries for date/time handling

### Frontend Dependencies
- Bootstrap 5 for responsive UI components
- Font Awesome for iconography
- Chart.js for data visualization
- Moment.js for date manipulation

### External APIs
- Football API for fixture and team data
- Multiple prediction websites for consensus analysis
- Configurable API key management

## Deployment Strategy

### Development Environment
- SQLite database for local development
- Debug mode enabled with detailed logging
- Hot reloading for development efficiency

### Production Environment
- PostgreSQL database with connection pooling
- Environment-based configuration management
- ProxyFix middleware for reverse proxy deployment
- Configurable session management and security

### Environment Variables
- `DATABASE_URL`: Database connection string
- `SESSION_SECRET`: Application secret key
- `API_FOOTBALL_KEY`: External API authentication

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 30, 2025. Initial setup