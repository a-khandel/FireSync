import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from prompts import TRIAGE_PROMPT, MONITORING_PROMPT

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ["NVIDIA_API_KEY"]
)

MODEL = os.environ["NEMOTRON_MODEL"]


def run_triage(incident: dict) -> dict:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": TRIAGE_PROMPT},
            {"role": "user", "content": json.dumps(incident)}
        ],
        temperature=0.2,
        max_tokens=1024
    )
    raw = response.choices[0].message.content
    try:
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw_response": raw, "parse_error": True}


def run_monitoring(incident: dict, agency_statuses: dict) -> dict:
    payload = {
        "incident": incident,
        "agency_statuses": agency_statuses
    }
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": MONITORING_PROMPT},
            {"role": "user", "content": json.dumps(payload)}
        ],
        temperature=0.2,
        max_tokens=512
    )
    raw = response.choices[0].message.content
    try:
        raw = raw.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw_response": raw, "parse_error": True}


if __name__ == "__main__":
    test_incident = {
        "id": "fire_001",
        "lat": 37.5,
        "lon": -119.5,
        "location_name": "Mariposa County, CA",
        "acreage": 500,
        "wind_speed_mph": 25,
        "wind_direction": "NE",
        "humidity_pct": 12,
        "containment_pct": 0,
        "structures_threatened": 43,
        "population_nearby": 1200
    }

    print("--- Running triage ---")
    triage_result = run_triage(test_incident)
    print(json.dumps(triage_result, indent=2))

    print("\n--- Running monitoring ---")
    agency_statuses = {
        "cal_fire": "acknowledged",
        "county_sheriff": "no_response",
        "red_cross": "acknowledged"
    }
    monitor_result = run_monitoring(test_incident, agency_statuses)
    print(json.dumps(monitor_result, indent=2))