import s3fs
import asyncio
import xarray as xr
import numpy as np
from datetime import datetime, timezone
from pyproj import Transformer

def process_goes_dataset(latest_file, fs, lat_range, lon_range):
    """
    Heavy lifting: Opens the NetCDF file and extracts hotspots.
    Executed in a separate thread to avoid blocking the event loop.
    """
    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range
    
    with fs.open(latest_file, mode='rb') as s3_file:
        ds = xr.open_dataset(s3_file, engine='h5netcdf')
        
        proj_var = ds['goes_imager_projection']
        h = proj_var.attrs['perspective_point_height']
        transformer = Transformer.from_crs(
            f"+proj=geos +h={h} +lon_0={proj_var.attrs['longitude_of_projection_origin']} +sweep={proj_var.attrs.get('sweep_angle_axis', 'x')} +datum=WGS84 +units=m +no_defs",
            "epsg:4326", always_xy=True
        )

        # HEATSEEKER MODE: Bypass the official 'Power' check
        # We scan the raw Temperature (Temp) array directly
        temp_raw = ds['Temp'].values
        
        # 304K is about 87°F. We'll look for anything significantly
        # warmer than the average background.
        warm_indices = np.argwhere(temp_raw > 304.0) 
        
        hotspots = []
        for idx in warm_indices:
            y, x = idx[0], idx[1]
            x_m, y_m = ds.x.values[x] * h, ds.y.values[y] * h
            lon, lat = transformer.transform(x_m, y_m)
            
            # Check Bounding Box (Southern California)
            if (lat_min <= lat <= lat_max) and (lon_min <= lon <= lon_max):
                p_val = ds['Power'].values[y, x]
                hotspots.append({
                    "lat": round(float(lat), 4),
                    "lon": round(float(lon), 4),
                    "frp_mw": round(float(p_val), 2) if not np.isnan(p_val) else 0.5,
                    "temp_k": round(float(temp_raw[y, x]), 1),
                    "area_km2": 4.0,
                    "conf_code": int(ds['Mask'].values[y, x])
                })

        # Sort by temperature (hottest first) and grab top 10
        hotspots = sorted(hotspots, key=lambda x: x['temp_k'], reverse=True)[:10]
        
        # Calculate summary stats for the runtime loop
        total_area = sum([h['area_km2'] for h in hotspots])
        max_frp = max([h['frp_mw'] for h in hotspots]) if hotspots else 0.0

        stats = {
            "status": "success",
            "file": latest_file,
            "hotspot_count": len(hotspots),
            "max_frp_mw": max_frp,
            "summary": {
                "total_area": float(total_area)
            },
            "coords": hotspots 
        }
        
        ds.close()
        return stats

async def fetch_latest_goes_metadata():
    """
    GOES-18 (West) Parser: Targets the Channel Islands / Southern California coast.
    Uses HEATSEEKER MODE and thread-safe processing.
    """
    fs = s3fs.S3FileSystem(anon=True)
    now_utc = datetime.now(timezone.utc)
    
    # Target: Channel Islands / Santa Rosa Island region
    LAT_RANGE = (33.8, 34.1)
    LON_RANGE = (-120.3, -119.8)

    year, jday, hour = now_utc.strftime('%Y'), now_utc.strftime('%j'), now_utc.strftime('%H')
    bucket_path = f"noaa-goes18/ABI-L2-FDCC/{year}/{jday}/{hour}/"
    
    try:
        # SAFE S3 LISTING
        try:
            files = await asyncio.to_thread(fs.ls, bucket_path)
        except FileNotFoundError:
            files = []

        if not files:
            prev_hour = str(int(hour) - 1).zfill(2)
            if prev_hour == "-1": prev_hour = "23" 
            bucket_path = f"noaa-goes18/ABI-L2-FDCC/{year}/{jday}/{prev_hour}/"
            try:
                files = await asyncio.to_thread(fs.ls, bucket_path)
            except FileNotFoundError:
                files = []

        if not files: return {"status": "no_data", "message": "Bucket empty for current/prev hour."}

        latest_file = files[-1]
        print(f"🛰️ [GOES Service] Processing: {latest_file.split('/')[-1]}", flush=True)
        
        # OFF-LOAD HEAVY PROCESSING TO A THREAD
        stats = await asyncio.to_thread(
            process_goes_dataset, 
            latest_file, fs, LAT_RANGE, LON_RANGE
        )
        
        stats["timestamp"] = now_utc.isoformat()
        return stats

    except Exception as e:
        print(f"❌ GOES-18 Extraction Error: {e}", flush=True)
        return {"status": "error", "message": str(e)}