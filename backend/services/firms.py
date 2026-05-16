# import httpx
# import pandas as pd
# import json
# from io import StringIO
# from core.config import settings
# from core.database import redis_client # Import Redis directly
# 
# # California Bounding Box for the demo
# CA_BBOX = "-25.0,34.0,45.0,72.0"
# 
# async def fetch_live_fires():
#     """
#     Fetches live fire detections from NASA FIRMS and updates Redis.
#     No Postgres database involved.
#     """
#     url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{settings.NASA_FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/{CA_BBOX}/1"
#     
#     async with httpx.AsyncClient() as client:
#         try:
#             response = await client.get(url)
#             if response.status_code != 200:
#                 print(f"⚠️ NASA API Error: {response.status_code}")
#                 return None
# 
#             # Parse the CSV
#             df = pd.read_csv(StringIO(response.text))
#             
#             live_fires = []
#             for _, row in df.iterrows():
#                 live_fires.append({
#                     # Create a unique ID based on time and coordinates
#                     "id": f"Fire-{row['acq_time']}-{row['latitude']}",
#                     "latitude": row['latitude'],
#                     "longitude": row['longitude'],
#                     "intensity": float(row['bright_ti4']),
#                     "status": "active"
#                 })
#             
#             # Store the entire live state in Redis for the Agent to access
#             redis_client.set("firesync_live_state", json.dumps(live_fires))
#             
#             print(f"🔥 FireSync: Synced {len(live_fires)} active fires into Redis.")
#             return live_fires
#             
#         except Exception as e:
#             print(f"❌ FireSync Fetcher Failure: {e}")
#             return None