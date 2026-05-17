import asyncio
import os
import re
from openai import AsyncOpenAI
from dotenv import load_dotenv

from services.goes import fetch_latest_goes_metadata
from services.weather import fetch_wind_data, wind_direction_to_degrees
from services.geodata import query_island_infrastructure
from agent.tools import (
    record_scan, analyze_frp_trend, compute_fire_centroid,
    generate_evacuation_zones, draft_resource_communications,
    latest_situation,
)
from core.database import SessionLocal
from models.orm import ScanLog, IncidentReport

load_dotenv()

nim_client = AsyncOpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ.get("NVIDIA_API_KEY"),
)

# Rolling conversation memory — keeps last 3 scan exchanges so
# NemoClaw can reference its own prior briefs and track evolution.
# Capped at 3 turns (~1500 tokens) to stay well under NIM context limits.
MAX_MEMORY_TURNS = 3
_conversation_memory = []   # list of {"role": ..., "content": ...} pairs


async def generate_nemoclaw_report(hotspots, total_area, max_frp,
                                   wind=None, trend=None, osm=None):
    if total_area > 2.0:
        model = "nvidia/nemotron-3-super-120b-a12b"
        print("🔴 [NEMOCLAW] Major event detected. Engaging Heavy Reasoning.", flush=True)
    else:
        model = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
        print("🟢 [NEMOCLAW] Routine scan. Engaging Low-Latency Fast Model.", flush=True)

    payload_lines = [
        f"Total Burn Area: {total_area:.4f} km²",
        f"Max Fire Radiative Power: {max_frp} MW",
    ]
    if wind and wind.get("status") == "success":
        payload_lines.append(
            f"Wind: {wind['wind_speed']} from {wind['wind_direction']} | "
            f"Forecast: {wind['short_forecast']}"
        )
    if trend and trend.get("trend") != "INSUFFICIENT_DATA":
        payload_lines.append(f"FRP Trend: {trend['trend']} (delta {trend['frp_delta_mw']:+.1f} MW)")
    if osm and osm.get("status") == "success":
        payload_lines.append(
            f"Nearby Infrastructure: {len(osm['campgrounds'])} campgrounds, "
            f"{len(osm['trails'])} trails, {len(osm['helipads'])} helipads, "
            f"{len(osm['beaches'])} beaches"
        )
    payload_lines.append("Hotspot Details:")
    for i, s in enumerate(hotspots):
        payload_lines.append(
            f"  [{i+1}] Coords: ({s['lat']}, {s['lon']}) | "
            f"Intensity: {s['frp_mw']} MW | Temp: {s['temp_k']}K"
        )
    payload_str = "\n".join(payload_lines)

    scan_number = len(_conversation_memory) // 2 + 1

    system_prompt = (
        "You are NemoClaw, an elite, autonomous Wildfire Incident Commander running "
        "continuous monitoring. You will receive a series of satellite scans over time. "
        "Your prior briefs are included in the conversation so you can track fire evolution.\n\n"
        "Rules:\n"
        "- Reference changes from your previous briefs (e.g. 'FRP has increased since last scan').\n"
        "- If conditions are unchanged, note stability rather than repeating the same analysis.\n"
        "- Escalate or de-escalate your threat assessment based on trend data.\n"
        "- Output a concise 2-to-3 sentence tactical brief: threat level, primary concern, "
        "immediate action.\n"
        "- Tone: cold, professional, highly technical."
    )

    # Build message list: system + rolling memory + new scan
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(_conversation_memory)
    messages.append({"role": "user", "content": f"[SCAN #{scan_number}]\n{payload_str}"})

    try:
        response = await nim_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content
        clean = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        brief = clean if clean else raw
    except Exception as e:
        brief = f"[NEMOCLAW ERROR] LLM connection failed: {e}"

    # Append this exchange to memory, then trim to MAX_MEMORY_TURNS
    _conversation_memory.append({"role": "user", "content": f"[SCAN #{scan_number}]\n{payload_str}"})
    _conversation_memory.append({"role": "assistant", "content": brief})
    while len(_conversation_memory) > MAX_MEMORY_TURNS * 2:
        _conversation_memory.pop(0)
        _conversation_memory.pop(0)

    return brief


def persist_scan_log(situation: dict, model_used: str):
    """Write a complete scan cycle to the Supabase scan_logs table."""
    db = SessionLocal()
    try:
        wind = situation.get("wind") or {}
        trend = situation.get("trend") or {}
        log = ScanLog(
            scan_timestamp=situation.get("timestamp", ""),
            hotspot_count=situation.get("hotspot_count", 0),
            total_area_km2=situation.get("total_area", 0.0),
            max_frp_mw=situation.get("max_frp", 0.0),
            centroid_lat=situation.get("centroid", {}).get("lat"),
            centroid_lon=situation.get("centroid", {}).get("lon"),
            wind_speed=wind.get("wind_speed"),
            wind_direction=wind.get("wind_direction"),
            temperature_f=wind.get("temperature_f"),
            short_forecast=wind.get("short_forecast"),
            frp_trend=trend.get("trend"),
            frp_delta_mw=trend.get("frp_delta_mw"),
            hotspots=situation.get("hotspots"),
            evacuation_zones=situation.get("evacuation_zones"),
            draft_comms=situation.get("comms"),
            osm_infrastructure=situation.get("osm"),
            nemoclaw_brief=situation.get("nemoclaw_brief"),
            nemoclaw_model=model_used,
        )
        db.add(log)
        db.commit()
        print("💾 [DB] Scan log persisted to Supabase.", flush=True)
    except Exception as e:
        db.rollback()
        print(f"⚠️ [DB] Failed to persist scan log: {e}", flush=True)
    finally:
        db.close()


async def generate_incident_document(situation: dict) -> dict:
    """
    Called by the frontend endpoint. Uses the latest situation snapshot
    to produce a full structured incident document via NemoClaw, then
    persists it to the incident_reports table and returns it.
    """
    if not situation:
        return {"status": "error", "message": "No situation data available yet."}

    total_area = situation.get("total_area", 0.0)
    max_frp = situation.get("max_frp", 0.0)
    hotspots = situation.get("hotspots", [])
    wind = situation.get("wind") or {}
    trend = situation.get("trend") or {}
    osm = situation.get("osm") or {}
    centroid = situation.get("centroid") or {}
    comms = situation.get("comms") or []

    if total_area > 2.0:
        model = "nvidia/nemotron-3-super-120b-a12b"
    else:
        model = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"

    # Build rich payload for document generation
    payload_lines = [
        f"Scan Timestamp: {situation.get('timestamp', 'N/A')}",
        f"Hotspot Count: {len(hotspots)}",
        f"Total Burn Area: {total_area:.4f} km²",
        f"Max Fire Radiative Power: {max_frp} MW",
        f"Fire Centroid: {centroid.get('lat', 'N/A')}°N, {centroid.get('lon', 'N/A')}°W",
    ]
    if wind.get("status") == "success":
        payload_lines.append(
            f"Wind: {wind['wind_speed']} from {wind['wind_direction']} | "
            f"Temp: {wind.get('temperature_f')}°F | Forecast: {wind['short_forecast']}"
        )
    if trend.get("trend") and trend["trend"] != "INSUFFICIENT_DATA":
        payload_lines.append(f"FRP Trend: {trend['trend']} (delta {trend.get('frp_delta_mw', 0):+.1f} MW)")
    if osm.get("status") == "success":
        payload_lines.append(
            f"Nearby: {len(osm.get('campgrounds',[]))} campgrounds, "
            f"{len(osm.get('trails',[]))} trails, {len(osm.get('helipads',[]))} helipads, "
            f"{len(osm.get('beaches',[]))} beaches, "
            f"{len(osm.get('ranger_stations',[]))} ranger stations"
        )
    payload_lines.append("Hotspot Details:")
    for i, s in enumerate(hotspots):
        payload_lines.append(
            f"  [{i+1}] ({s['lat']}, {s['lon']}) | "
            f"{s['frp_mw']} MW | {s['temp_k']}K"
        )
    if comms:
        payload_lines.append("Queued Notifications:")
        for msg in comms:
            payload_lines.append(f"  [{msg['priority']}] {msg['to']}")

    payload_str = "\n".join(payload_lines)

    system_prompt = (
        "You are NemoClaw, an elite Wildfire Incident Commander AI. "
        "Given the full situation data below, produce a structured Incident Report document. "
        "Use the following sections with markdown headers:\n"
        "# INCIDENT REPORT\n"
        "## Situation Overview\n"
        "## Threat Assessment\n"
        "## Weather & Fire Behavior\n"
        "## Infrastructure at Risk\n"
        "## Evacuation Recommendations\n"
        "## Resource Coordination\n"
        "## Commander Assessment\n"
        "Be thorough but concise under each section. "
        "Tone: authoritative, technical, actionable."
    )

    try:
        response = await nim_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": payload_str},
            ],
            temperature=0.3,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content
        document = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        if not document:
            document = raw
    except Exception as e:
        document = f"[NEMOCLAW ERROR] Document generation failed: {e}"

    wind_summary = None
    if wind.get("status") == "success":
        wind_summary = f"{wind.get('wind_speed')} from {wind.get('wind_direction')}"

    # Persist to DB
    db = SessionLocal()
    try:
        report = IncidentReport(
            report_type="full",
            scan_timestamp=situation.get("timestamp"),
            hotspot_count=len(hotspots),
            total_area_km2=total_area,
            max_frp_mw=max_frp,
            centroid_lat=centroid.get("lat"),
            centroid_lon=centroid.get("lon"),
            wind_summary=wind_summary,
            frp_trend=trend.get("trend"),
            situation_snapshot=situation,
            document=document,
            model_used=model,
            requested_by="frontend",
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        report_id = report.id
        created_at = str(report.created_at)
        print(f"📄 [DB] Incident report #{report_id} persisted to Supabase.", flush=True)
    except Exception as e:
        db.rollback()
        print(f"⚠️ [DB] Failed to persist incident report: {e}", flush=True)
        return {"status": "error", "message": f"DB write failed: {e}", "document": document}
    finally:
        db.close()

    return {
        "status": "success",
        "report_id": report_id,
        "model_used": model,
        "created_at": created_at,
        "document": document,
    }


# ───────────────────────────────────────────────────────────────────────────
#  Main Agent Loop
# ───────────────────────────────────────────────────────────────────────────
async def openclaw_agent_loop():
    """
    The background loop for OpenClaw.
    Fetches real-time satellite telemetry and logs results.
    """
    print("🧠 [RUNTIME] Agent cognitive loop active.", flush=True)

    while True:
        try:
            # ── STEP 1: Fire Detection (GOES) ─────────────────────────────
            print("\n🔍 [RUNTIME] Requesting latest satellite telemetry...", flush=True)
            data = await fetch_latest_goes_metadata()

            if data.get("status") == "success":
                print(f"🛰️ --- NEW SATELLITE SCAN: {data['timestamp']} ---", flush=True)
                print(f"🔥 HOTSPOTS: {len(data['coords'])}", flush=True)

                if 'summary' in data:
                    print(f"📐 TOTAL AREA: {data['summary']['total_area']:.4f} km²", flush=True)

                for i, s in enumerate(data['coords']):
                    conf = "HIGH" if s['conf_code'] in [10, 30] else "MED/LOW"
                    print(f"📍 [{i+1}] {s['lat']}, {s['lon']}", flush=True)
                    print(f"    - Intensity: {s['frp_mw']} MW | Temp: {s['temp_k']}K", flush=True)
                    print(f"    - Size: {s['area_km2']} km² | Confidence: {conf}", flush=True)

                if 'max_frp_mw' in data:
                    print(f"⚡ MAX SYSTEM FRP: {data['max_frp_mw']} MW", flush=True)

                hotspot_count = len(data['coords'])
                if hotspot_count > 0:
                    total_area = data['summary']['total_area']
                    max_frp = data['max_frp_mw']
                    hotspots = data['coords']
                    centroid = compute_fire_centroid(hotspots)

                    # ── STEP 2: Situation Assessment (parallel) ───────────
                    print("\n📡 [RUNTIME] Querying NWS weather + OSM infrastructure...", flush=True)
                    wind_task = asyncio.create_task(
                        fetch_wind_data(centroid[0], centroid[1])
                    )
                    osm_task = asyncio.create_task(
                        query_island_infrastructure(centroid[0], centroid[1])
                    )
                    wind_data = await wind_task
                    osm_data = await osm_task

                    # Print weather
                    if wind_data.get("status") == "success":
                        print(f"🌬️ WIND: {wind_data['wind_speed']} from {wind_data['wind_direction']}", flush=True)
                        print(f"🌡️ TEMP: {wind_data['temperature_f']}°F | {wind_data['short_forecast']}", flush=True)
                    else:
                        print(f"⚠️ [WEATHER] {wind_data.get('message', 'unavailable')}", flush=True)

                    # ── STEP 3: OSM Infrastructure ────────────────────────
                    if osm_data.get("status") == "success":
                        print(f"🏕️ CAMPGROUNDS: {len(osm_data['campgrounds'])}", flush=True)
                        for c in osm_data['campgrounds']:
                            print(f"    - {c['name']} ({c['lat']}, {c['lon']})", flush=True)
                        print(f"🚁 HELIPADS: {len(osm_data['helipads'])}", flush=True)
                        for h in osm_data['helipads']:
                            print(f"    - {h['name']} ({h['lat']}, {h['lon']})", flush=True)
                        print(f"🏖️ BEACHES (LZs): {len(osm_data['beaches'])}", flush=True)
                        for b in osm_data['beaches']:
                            print(f"    - {b['name']} ({b['lat']}, {b['lon']})", flush=True)
                        print(f"🥾 TRAILS: {len(osm_data['trails'])} | "
                              f"💧 WATER: {len(osm_data['water_sources'])} | "
                              f"🏠 RANGER STN: {len(osm_data['ranger_stations'])}", flush=True)
                    else:
                        print(f"⚠️ [OSM] {osm_data.get('message', 'unavailable')}", flush=True)

                    # ── STEP 6: FRP Trend Tracking ────────────────────────
                    record_scan(data['timestamp'], total_area, max_frp,
                                hotspot_count, hotspots)
                    trend = analyze_frp_trend()
                    print(f"📈 FRP TREND: {trend['trend']}", flush=True)
                    if trend['trend'] != "INSUFFICIENT_DATA":
                        print(f"    Δ FRP: {trend['frp_delta_mw']:+.1f} MW | "
                              f"Δ Area: {trend['area_delta_km2']:+.1f} km²", flush=True)

                    # ── STEP 4: Evacuation Zones ──────────────────────────
                    wind_dir = wind_data.get("wind_direction", "N")
                    wind_deg = wind_direction_to_degrees(wind_dir)
                    zones = generate_evacuation_zones(hotspots, wind_deg)
                    zone_count = len(zones["features"])
                    print(f"🚨 EVACUATION ZONES GENERATED: {zone_count} zones (RED/ORANGE/GREEN + perimeter)", flush=True)

                    # ── STEP 5: Resource Coordination Drafts ──────────────
                    comms = draft_resource_communications(
                        centroid, total_area, max_frp,
                        hotspot_count, wind_data, osm_data
                    )
                    print(f"📨 DRAFT COMMS: {len(comms)} messages queued", flush=True)
                    for msg in comms:
                        print(f"    [{msg['priority']}] → {msg['to']}", flush=True)

                    # ── Store latest situation for API ────────────────────
                    latest_situation.clear()
                    latest_situation.update({
                        "timestamp": data['timestamp'],
                        "centroid": {"lat": centroid[0], "lon": centroid[1]},
                        "hotspot_count": hotspot_count,
                        "total_area": total_area,
                        "max_frp": max_frp,
                        "wind": wind_data,
                        "osm": osm_data,
                        "trend": trend,
                        "evacuation_zones": zones,
                        "comms": comms,
                    })

                    # ── NemoClaw AI Brief (enriched) ──────────────────────
                    brief = await generate_nemoclaw_report(
                        hotspots, total_area, max_frp,
                        wind=wind_data, trend=trend, osm=osm_data
                    )
                    print(f"\n🧠 [NEMOCLAW COMMANDER BRIEF]\n{brief}\n", flush=True)
                    latest_situation["nemoclaw_brief"] = brief
                    latest_situation["hotspots"] = hotspots

                    # ── Persist to Supabase ─────────────────────────────
                    model_used = ("nvidia/nemotron-3-super-120b-a12b"
                                  if total_area > 2.0
                                  else "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
                    await asyncio.to_thread(persist_scan_log, latest_situation, model_used)

            elif data.get("status") == "no_data":
                print(f"⚪ [RUNTIME] No heat signatures found. ({data.get('message', 'Bucket empty')})", flush=True)

            else:
                print(f"⚠️ [RUNTIME] Data State: {data.get('status', 'unknown')} - {data.get('message', '')}", flush=True)

        except Exception as e:
            print(f"❌ [RUNTIME] Loop Error: {e}", flush=True)

        print("💤 [RUNTIME] Standby for 5 minutes...", flush=True)
        await asyncio.sleep(300)