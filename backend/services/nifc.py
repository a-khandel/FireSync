import httpx
import json
from core.database import redis_client

async def fetch_live_fires():
    """
    Fetches live, named wildfire incidents from the NIFC WFIGS database.
    No API Key required.
    """
    # The public ArcGIS REST Endpoint for Wildland Fire Incident Locations
    url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations/FeatureServer/0/query"
    
    # 1. The Cleaned Query
    params = {
        # 'WF' = Wildfire. Get active fires over 100 acres where the fire isn't "Out" yet.
        "where": "IncidentTypeCategory = 'WF' AND IncidentSize > 100 AND FireOutDateTime IS NULL", 
        "outFields": "IrwinID,IncidentName,IncidentSize,PercentContained,POOState,POOCounty,IncidentTypeCategory",
        "orderByFields": "IncidentSize DESC", # Give us the absolute biggest fires at the top
        "resultRecordCount": "25", # Cap it so the frontend map doesn't freeze
        "returnGeometry": "true", 
        "f": "json" 
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            
            if response.status_code != 200:
                print(f"⚠️ NIFC API Error: {response.status_code}")
                return None

            data = response.json()
            
            # Catch any silent ArcGIS schema errors before they break the loop
            if "error" in data:
                print(f"🛑 ArcGIS Database Error: {data['error']}")
                return None
            
            live_fires = []
            
            # 2. The Cleaned Parser
            for feature in data.get('features', []):
                attrs = feature.get('attributes', {})
                geometry = feature.get('geometry', {})
                
                live_fires.append({
                    "id": attrs.get("IrwinID"),
                    "name": attrs.get("IncidentName", "Unnamed Fire"),
                    "acres": attrs.get("IncidentSize", 0), # Successfully mapped to the new NIFC column
                    "contained_percent": attrs.get("PercentContained", 0),
                    "state": attrs.get("POOState", "Unknown"),
                    "county": attrs.get("POOCounty", "Unknown"),
                    "latitude": geometry.get("y"),
                    "longitude": geometry.get("x"),
                    "status": "active"
                })
            
            # Store the rich incident state in Redis for the Agent
            redis_client.set("firesync_live_state", json.dumps(live_fires))
            
            print(f"🔥 FireSync: Synced {len(live_fires)} active named fires from NIFC into Redis.")
            return live_fires
            
        except Exception as e:
            print(f"❌ NIFC Fetcher Failure: {e}")
            return None