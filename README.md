# Sunbeam: Weather & Disaster Monitoring System
FastAPI (Python) + MySQL + Leaflet map + pixel-art Bootstrap dashboard.

## Run
1. Install MySQL, then: `mysql -u root -p < database/schema.sql`
2. `cd backend && python -m venv venv && source venv/bin/activate` (Windows: `venv\Scripts\activate`)
3. `pip install -r requirements.txt`
4. `cp .env.example .env` and set DB_PASSWORD
5. `uvicorn main:app --reload` then open http://127.0.0.1:8000  (API docs: /docs)

Weather and the earthquake layer work without MySQL; saved places, preferences, and layer list need it.

## Data notes
- Pages: `index.html` = weather (rain chance, hourly, 7-day), `map.html` = hazard map with click-to-check.
- Weather: Open-Meteo (check its terms for commercial use). Cached 10 min in MySQL.
- Earthquakes: live USGS feed for the Philippine region. For official reports use PHIVOLCS.
- Flood / landslide / fault layers read `data/hazards/<slug>.geojson`. The flood file is a SAMPLE polygon only.
  Replace with real datasets from UP NOAH, MGB, and PHIVOLCS FaultFinder (follow their licenses).
- Susceptibility maps are not live monitoring. Use PAGASA for warnings.
