import math

# ---------------------------------------------------------------------------
# In-memory state (persists across loop iterations while the process lives)
# ---------------------------------------------------------------------------
scan_history = []      # last N scan snapshots for trend analysis
latest_situation = {}  # most recent full situation report, served via API


# ---------------------------------------------------------------------------
# FRP Trend Tracking  (Step 6)
# ---------------------------------------------------------------------------
def record_scan(timestamp, total_area, max_frp, hotspot_count, hotspots):
    """Append scan snapshot; keep last 10."""
    scan_history.append({
        "timestamp": timestamp,
        "total_area": total_area,
        "max_frp": max_frp,
        "hotspot_count": hotspot_count,
        "hotspots": hotspots,
    })
    if len(scan_history) > 10:
        scan_history.pop(0)


def analyze_frp_trend() -> dict:
    """Compare latest two scans and classify the trend."""
    if len(scan_history) < 2:
        return {"trend": "INSUFFICIENT_DATA", "scans": len(scan_history)}

    cur = scan_history[-1]
    prev = scan_history[-2]
    frp_delta = cur["max_frp"] - prev["max_frp"]
    area_delta = cur["total_area"] - prev["total_area"]

    if frp_delta > 50:
        trend = "ESCALATING"
    elif frp_delta < -50:
        trend = "DECLINING"
    else:
        trend = "STABLE"

    return {
        "trend": trend,
        "frp_delta_mw": round(frp_delta, 2),
        "area_delta_km2": round(area_delta, 2),
        "scans_analyzed": len(scan_history),
        "current_max_frp": cur["max_frp"],
        "previous_max_frp": prev["max_frp"],
    }


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def compute_fire_centroid(hotspots: list) -> tuple:
    if not hotspots:
        return (0.0, 0.0)
    avg_lat = sum(h["lat"] for h in hotspots) / len(hotspots)
    avg_lon = sum(h["lon"] for h in hotspots) / len(hotspots)
    return (round(avg_lat, 6), round(avg_lon, 6))


def _circle_polygon(lat, lon, radius_km, n=24):
    """Approximate a circle as an n-sided polygon in lon/lat coords."""
    coords = []
    for i in range(n):
        angle = 2 * math.pi * i / n
        dlat = (radius_km / 111.0) * math.cos(angle)
        dlon = (radius_km / (111.0 * math.cos(math.radians(lat)))) * math.sin(angle)
        coords.append([round(lon + dlon, 6), round(lat + dlat, 6)])
    coords.append(coords[0])  # close ring
    return coords


def _convex_hull(points):
    """Jarvis march (gift-wrapping) convex hull."""
    if len(points) <= 2:
        return list(points)
    start = min(points, key=lambda p: (p[0], p[1]))
    hull = []
    current = start
    while True:
        hull.append(current)
        candidate = points[0]
        for p in points[1:]:
            if candidate == current:
                candidate = p
                continue
            cross = ((candidate[0] - current[0]) * (p[1] - current[1]) -
                     (candidate[1] - current[1]) * (p[0] - current[0]))
            if cross < 0:
                candidate = p
        current = candidate
        if current == start:
            break
        if len(hull) > len(points):
            break
    return hull


def estimate_fire_perimeter(hotspots: list) -> list:
    """Return a GeoJSON-style coordinate ring around the fire cluster."""
    if not hotspots:
        return []
    if len(hotspots) == 1:
        return _circle_polygon(hotspots[0]["lat"], hotspots[0]["lon"], radius_km=1.0)

    points = [(h["lon"], h["lat"]) for h in hotspots]
    hull = _convex_hull(points)

    cx = sum(p[0] for p in hull) / len(hull)
    cy = sum(p[1] for p in hull) / len(hull)

    buffered = []
    for lon, lat in hull:
        dx, dy = lon - cx, lat - cy
        dist = math.sqrt(dx * dx + dy * dy) or 0.001
        scale = 0.009 / dist  # ~1 km outward buffer
        buffered.append([round(lon + dx * scale, 6), round(lat + dy * scale, 6)])
    if buffered and buffered[0] != buffered[-1]:
        buffered.append(buffered[0])
    return buffered


# ---------------------------------------------------------------------------
# Evacuation Zone Generation  (Step 4)
# ---------------------------------------------------------------------------
def generate_evacuation_zones(hotspots, wind_direction_deg) -> dict:
    """Build red / orange / green evacuation zones as a GeoJSON FeatureCollection."""
    clat, clon = compute_fire_centroid(hotspots)
    perimeter = estimate_fire_perimeter(hotspots)

    downwind_rad = math.radians((wind_direction_deg + 180) % 360)

    # RED — immediate danger (fire + 2 km buffer)
    red_zone = _circle_polygon(clat, clon, radius_km=2.0)

    # ORANGE — downwind smoke / spread corridor, offset 3 km downwind
    off_lat = (3.0 / 111.0) * math.cos(downwind_rad)
    off_lon = (3.0 / (111.0 * math.cos(math.radians(clat)))) * math.sin(downwind_rad)
    orange_zone = _circle_polygon(clat + off_lat, clon + off_lon, radius_km=3.0)

    # GREEN — upwind staging, offset 4 km upwind
    up_lat = -(4.0 / 111.0) * math.cos(downwind_rad)
    up_lon = -(4.0 / (111.0 * math.cos(math.radians(clat)))) * math.sin(downwind_rad)
    green_zone = _circle_polygon(clat + up_lat, clon + up_lon, radius_km=2.0)

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"zone": "RED", "label": "Immediate Danger — No Entry"},
                "geometry": {"type": "Polygon", "coordinates": [red_zone]},
            },
            {
                "type": "Feature",
                "properties": {"zone": "ORANGE", "label": "Evacuation Required — Downwind"},
                "geometry": {"type": "Polygon", "coordinates": [orange_zone]},
            },
            {
                "type": "Feature",
                "properties": {"zone": "GREEN", "label": "Safe Staging — Upwind"},
                "geometry": {"type": "Polygon", "coordinates": [green_zone]},
            },
            {
                "type": "Feature",
                "properties": {"zone": "PERIMETER", "label": "Estimated Fire Perimeter"},
                "geometry": {"type": "Polygon", "coordinates": [perimeter]} if perimeter else
                            {"type": "Point", "coordinates": [clon, clat]},
            },
        ],
    }


# ---------------------------------------------------------------------------
# Resource Coordination Drafts  (Step 5)
# ---------------------------------------------------------------------------
def draft_resource_communications(centroid, total_area, max_frp,
                                  hotspot_count, wind, osm_data) -> list:
    lat, lon = centroid
    wind_str = f"{wind.get('wind_speed', 'N/A')} from {wind.get('wind_direction', 'N/A')}"
    num_beaches = len(osm_data.get("beaches", [])) if isinstance(osm_data, dict) else 0

    return [
        {
            "to": "NPS Channel Islands National Park",
            "priority": "CRITICAL",
            "message": (
                f"WILDFIRE ALERT — Santa Rosa Island. {hotspot_count} active hotspots via GOES-18. "
                f"Burn area: {total_area:.1f} km². Max FRP: {max_frp:.1f} MW. "
                f"Centroid: {lat:.4f}°N, {lon:.4f}°W. Wind: {wind_str}. "
                f"Request immediate visitor count and ranger status."
            ),
        },
        {
            "to": "US Coast Guard Sector LA-Long Beach",
            "priority": "HIGH",
            "message": (
                f"MARITIME SUPPORT REQUEST — Active wildfire Santa Rosa Island. "
                f"{hotspot_count} hotspots, {total_area:.1f} km². "
                f"Potential visitor evacuation. Request assets stage at Channel Islands Harbor. "
                f"Wind: {wind_str}."
            ),
        },
        {
            "to": "Island Packers (Ferry Operator)",
            "priority": "HIGH",
            "message": (
                f"EVACUATION STANDBY — Active fire Santa Rosa Island. "
                f"Request vessel availability & passenger capacity. "
                f"{num_beaches} beach LZs identified for extraction."
            ),
        },
        {
            "to": "US Fish & Wildlife Service",
            "priority": "MEDIUM",
            "message": (
                f"WILDLIFE IMPACT ADVISORY — Wildfire on Santa Rosa Island. "
                f"Burn area: {total_area:.1f} km². Assess island fox & Torrey pine exposure."
            ),
        },
        {
            "to": "Santa Barbara County OES",
            "priority": "MEDIUM",
            "message": (
                f"MAINLAND COORDINATION — Santa Rosa Island wildfire. "
                f"Max intensity: {max_frp:.1f} MW. Wind: {wind_str}. "
                f"Smoke plume may reach mainland. Hospital standby recommended."
            ),
        },
    ]