import html as html_lib
import json, pathlib, re
import time
from functools import lru_cache, wraps
from urllib.parse import urlparse
import httpx, pymysql
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from db import query

ROOT = pathlib.Path(__file__).resolve().parent.parent
app = FastAPI(title="Weather & Disaster Monitoring System")
CACHE_MINUTES = 10

def db_guard(fn):
    @wraps(fn)
    def wrap(*a, **k):
        try:
            return fn(*a, **k)
        except pymysql.err.OperationalError:
            raise HTTPException(503, "Database unavailable. Check backend/.env and that MySQL is running.")
    return wrap

# ---------- Weather (Open-Meteo) ----------
@app.get("/api/geocode")
def geocode(q: str):
    query_text = q.strip()
    if len(query_text) < 2:
        return []
    try:
        return _geocode_locations(query_text.casefold())
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "Location search is temporarily unavailable. Please try again.") from exc

@lru_cache(maxsize=256)
def _geocode_locations(query_text: str):
    last_error = None
    for attempt in range(2):
        try:
            response = httpx.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": query_text, "count": 6, "language": "en"},
                timeout=httpx.Timeout(6, connect=3)
            )
            response.raise_for_status()
            results = response.json().get("results", [])
            if results:
                return [{"name": x["name"], "admin": x.get("admin1", ""), "country": x.get("country", ""),
                         "lat": x["latitude"], "lon": x["longitude"]} for x in results]
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < 1:
                time.sleep(.25 * (attempt + 1))

    try:
        response = httpx.get(
            "https://photon.komoot.io/api/",
            params={"q": query_text, "limit": 6},
            headers={"User-Agent": "SunbeamWeather/1.0"},
            timeout=httpx.Timeout(6, connect=3)
        )
        response.raise_for_status()
        features = response.json().get("features", [])
        locations = []
        for feature in features:
            properties = feature.get("properties") or {}
            coordinates = (feature.get("geometry") or {}).get("coordinates")
            if not isinstance(coordinates, list) or len(coordinates) < 2:
                continue
            name = properties.get("name") or properties.get("city") or properties.get("state")
            if not name:
                continue
            locations.append({
                "name": name,
                "admin": properties.get("state") or properties.get("county") or "",
                "country": properties.get("country") or "",
                "lat": coordinates[1],
                "lon": coordinates[0]
            })
        return locations
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        last_error = exc

    if last_error is not None:
        raise last_error
    raise RuntimeError("Location providers returned no result or error.")

@app.get("/api/weather")
def weather(lat: float, lon: float, units: str = "metric"):
    key = f"v2:{round(lat,2)}:{round(lon,2)}:{units}"
    try:
        hit = query("SELECT payload FROM weather_cache WHERE cache_key=%s AND fetched_at > NOW() - INTERVAL %s MINUTE",
                    (key, CACHE_MINUTES), one=True)
        if hit:
            return json.loads(hit["payload"])
    except pymysql.err.OperationalError:
        pass  # run without cache if DB is down
    imp = units == "imperial"
    params = {"latitude": lat, "longitude": lon, "timezone": "auto", "forecast_days": 7, "forecast_hours": 24,
              "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
              "hourly": "precipitation_probability,temperature_2m",
              "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset",
              "temperature_unit": "fahrenheit" if imp else "celsius",
              "wind_speed_unit": "mph" if imp else "kmh",
              "precipitation_unit": "inch" if imp else "mm"}
    r = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=15)
    if r.status_code != 200:
        raise HTTPException(502, "Weather provider error")
    data = r.json()
    try:
        query("REPLACE INTO weather_cache (cache_key, payload) VALUES (%s, %s)", (key, json.dumps(data)))
    except pymysql.err.OperationalError:
        pass
    return data

# ---------- Hazards ----------
@app.get("/api/hazard-layers")
@db_guard
def hazard_layers():
    return query("SELECT slug,label,color,source_name,source_url,kind,description FROM hazard_layers")

@app.get("/api/earthquakes")
def earthquakes(days: int = 7, minmag: float = 2.5):
    """Live USGS feed, Philippine region bounding box."""
    from datetime import datetime, timedelta, timezone
    start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")
    r = httpx.get("https://earthquake.usgs.gov/fdsnws/event/1/query", timeout=20, params={
        "format": "geojson", "starttime": start, "minmagnitude": minmag,
        "minlatitude": 4, "maxlatitude": 22, "minlongitude": 114, "maxlongitude": 128})
    return JSONResponse(r.json())

@app.get("/api/typhoon")
def typhoon_tracker():
        bulletin_url = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin"
        try:
            response = httpx.get(bulletin_url, timeout=20, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(502, "PAGASA typhoon bulletin is unavailable right now.") from exc

        page = response.text

        def clean_text(value):
            return re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", value))).strip()

        titles = [clean_text(value) for value in re.findall(r"<h3\b[^>]*>(.*?)</h3>", page, re.I | re.S)]
        title = next((value for value in titles
                      if re.search(r"\b(typhoon|tropical storm|tropical depression)\b", value, re.I)), None)
        if title:
            cyclone_heading = re.match(
                r"((?:(?:Super )?Typhoon|Severe Tropical Storm|Tropical Storm|Tropical Depression)"
                r"\s+(?:[\"“][^\"”]+[\"”]|[A-Za-z0-9-]+))",
                title,
                re.I
            )
            if cyclone_heading:
                title = cyclone_heading.group(1)
        issued_match = re.search(r"<h[45]\b[^>]*>\s*(Issued at[^<]+)</h[45]>", page, re.I)
        issued_at = clean_text(issued_match.group(1)) if issued_match else None

        def panel_value(label):
            pattern = (
                r"<div\b[^>]*class=[\"'][^\"']*\bpanel-heading\b[^\"']*[\"'][^>]*>\s*"
                + re.escape(label)
                + r"\s*</div>\s*<div\b[^>]*class=[\"'][^\"']*\bpanel-body\b[^\"']*[\"'][^>]*>"
                  r"\s*<p\b[^>]*>(.*?)</p>"
            )
            match = re.search(pattern, page, re.I | re.S)
            return clean_text(match.group(1)) if match else None

        center = panel_value("Location of Eye/center")
        movement = panel_value("Movement")
        strength = panel_value("Strength")
        coordinates = re.search(
            r"\(\s*(\d+(?:\.\d+)?)\s*°?\s*([NS])\s*,\s*"
            r"(\d+(?:\.\d+)?)\s*°?\s*([EW])\s*\)",
            center or "",
            re.I
        )
        track_match = re.search(
            r"<img\b[^>]*src=[\"']([^\"']*/tamss/weather/track_[^\"']+\.(?:png|jpe?g))[\"']",
            page,
            re.I
        )
        track_image = html_lib.unescape(track_match.group(1)) if track_match else None
        if track_image:
            track_url = urlparse(track_image)
            if track_url.scheme != "https" or track_url.netloc != "pubfiles.pagasa.dost.gov.ph":
                track_image = None

        if not title or not coordinates:
            return {
                "active": False,
                "message": "No active tropical cyclone position is currently listed by PAGASA.",
                "bulletin_url": bulletin_url
            }

        lat = float(coordinates.group(1)) * (-1 if coordinates.group(2).upper() == "S" else 1)
        lon = float(coordinates.group(3)) * (-1 if coordinates.group(4).upper() == "W" else 1)
        return {
            "active": True,
            "name": title,
            "issued_at": issued_at,
            "center": center,
            "movement": movement,
            "strength": strength,
            "latitude": lat,
            "longitude": lon,
            "track_image": track_image,
            "bulletin_url": bulletin_url
        }

@app.get("/api/hazards/{slug}")
def hazard_geojson(slug: str):
    """Serves data/hazards/<slug>.geojson. Drop real datasets (NOAH, MGB, PHIVOLCS) there."""
    if not slug.replace("_", "").isalnum():
        raise HTTPException(400, "Bad layer name")
    f = ROOT / "data" / "hazards" / f"{slug}.geojson"
    if not f.exists():
        raise HTTPException(404, f"No dataset for '{slug}'. Add data/hazards/{slug}.geojson")
    return JSONResponse(json.loads(f.read_text(encoding="utf-8")))

# ---------- Saved locations & preferences ----------
class Loc(BaseModel):
    name: str
    country: str | None = None
    latitude: float
    longitude: float

class Prefs(BaseModel):
    units: str
    default_location_id: int | None = None

@app.get("/api/locations")
@db_guard
def list_locations():
    return query("SELECT * FROM saved_locations ORDER BY created_at DESC")

@app.post("/api/locations")
@db_guard
def add_location(loc: Loc):
    query("INSERT IGNORE INTO saved_locations (name,country,latitude,longitude) VALUES (%s,%s,%s,%s)",
          (loc.name, loc.country, loc.latitude, loc.longitude))
    return list_locations()

@app.delete("/api/locations/{loc_id}")
@db_guard
def delete_location(loc_id: int):
    query("DELETE FROM saved_locations WHERE id=%s", (loc_id,))
    return list_locations()

@app.get("/api/preferences")
@db_guard
def get_prefs():
    return query("SELECT units, default_location_id FROM preferences WHERE id=1", one=True)

@app.put("/api/preferences")
@db_guard
def put_prefs(p: Prefs):
    if p.units not in ("metric", "imperial"):
        raise HTTPException(400, "units must be metric or imperial")
    query("UPDATE preferences SET units=%s, default_location_id=%s WHERE id=1", (p.units, p.default_location_id))
    return p

app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
