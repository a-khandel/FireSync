import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


async def query_island_infrastructure(lat: float, lon: float, radius_m: int = 5000) -> dict:
    """Query OSM via Overpass for emergency-relevant infrastructure near a fire."""
    query = (
        f"[out:json][timeout:15];"
        f"("
        f'node["tourism"="camp_site"](around:{radius_m},{lat},{lon});'
        f'way["tourism"="camp_site"](around:{radius_m},{lat},{lon});'
        f'node["aeroway"="helipad"](around:{radius_m},{lat},{lon});'
        f'way["aeroway"="helipad"](around:{radius_m},{lat},{lon});'
        f'node["amenity"="ranger_station"](around:{radius_m},{lat},{lon});'
        f'way["amenity"="ranger_station"](around:{radius_m},{lat},{lon});'
        f'node["natural"="water"](around:{radius_m},{lat},{lon});'
        f'way["natural"="water"](around:{radius_m},{lat},{lon});'
        f'way["highway"~"path|track|footway"](around:{radius_m},{lat},{lon});'
        f'node["natural"="beach"](around:{radius_m},{lat},{lon});'
        f'way["natural"="beach"](around:{radius_m},{lat},{lon});'
        f");"
        f"out center body;"
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            if resp.status_code != 200:
                return {"status": "error", "message": f"Overpass returned {resp.status_code}"}

            elements = resp.json().get("elements", [])

            result = {
                "status": "success",
                "campgrounds": [],
                "helipads": [],
                "ranger_stations": [],
                "water_sources": [],
                "trails": [],
                "beaches": [],
            }

            for el in elements:
                tags = el.get("tags", {})
                lat_v = el.get("lat") or (el.get("center") or {}).get("lat")
                lon_v = el.get("lon") or (el.get("center") or {}).get("lon")
                name = tags.get("name", "Unnamed")
                entry = {"name": name, "lat": lat_v, "lon": lon_v}

                if tags.get("tourism") == "camp_site":
                    result["campgrounds"].append(entry)
                elif tags.get("aeroway") == "helipad":
                    result["helipads"].append(entry)
                elif tags.get("amenity") == "ranger_station":
                    result["ranger_stations"].append(entry)
                elif tags.get("natural") == "water":
                    result["water_sources"].append(entry)
                elif tags.get("natural") == "beach":
                    result["beaches"].append(entry)
                elif el.get("type") == "way" and tags.get("highway") in ("path", "track", "footway"):
                    result["trails"].append(entry)

            return result
        except Exception as e:
            return {"status": "error", "message": str(e)}