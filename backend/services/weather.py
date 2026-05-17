import httpx
import math

NWS_BASE = "https://api.weather.gov"
HEADERS = {
    "User-Agent": "(OpenClaw/2.0, openclaw@firesync.dev)",
    "Accept": "application/geo+json",
}

COMPASS_TO_DEG = {
    "N": 0, "NNE": 22.5, "NE": 45, "ENE": 67.5,
    "E": 90, "ESE": 112.5, "SE": 135, "SSE": 157.5,
    "S": 180, "SSW": 202.5, "SW": 225, "WSW": 247.5,
    "W": 270, "WNW": 292.5, "NW": 315, "NNW": 337.5,
}


async def fetch_wind_data(lat: float, lon: float) -> dict:
    """Fetch current wind conditions from the NWS hourly forecast."""
    async with httpx.AsyncClient(headers=HEADERS, timeout=12.0, follow_redirects=True) as client:
        try:
            resp = await client.get(f"{NWS_BASE}/points/{round(lat,4)},{round(lon,4)}")
            if resp.status_code != 200:
                return {"status": "error", "message": f"NWS points lookup: {resp.status_code}"}

            props = resp.json()["properties"]
            forecast_url = props.get("forecastHourly")
            if not forecast_url:
                return {"status": "error", "message": "No hourly forecast URL in NWS response"}

            resp2 = await client.get(forecast_url)
            if resp2.status_code != 200:
                return {"status": "error", "message": f"NWS forecast fetch: {resp2.status_code}"}

            periods = resp2.json()["properties"]["periods"]
            cur = periods[0] if periods else {}

            return {
                "status": "success",
                "wind_speed": cur.get("windSpeed", "Unknown"),
                "wind_direction": cur.get("windDirection", "Unknown"),
                "temperature_f": cur.get("temperature", 0),
                "short_forecast": cur.get("shortForecast", "Unknown"),
                "humidity": cur.get("relativeHumidity", {}).get("value"),
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}


def wind_direction_to_degrees(direction: str) -> float:
    """Convert compass label to degrees (0=N, 90=E, etc.)."""
    return COMPASS_TO_DEG.get(direction, 0.0)


def wind_vector_km(direction: str, speed_kmh: float = 1.0) -> tuple:
    """Return (east_km, north_km) unit vector for the DOWNWIND direction."""
    deg = wind_direction_to_degrees(direction)
    rad = math.radians(deg)
    return (math.sin(rad) * speed_kmh, math.cos(rad) * speed_kmh)