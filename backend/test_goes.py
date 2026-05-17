import s3fs
from datetime import datetime, timezone
import re

def verify_goes_cadence():
    print("🛰️ Connecting to NOAA GOES-18 S3 Bucket...")
    
    # Connect anonymously (no AWS keys needed)
    fs = s3fs.S3FileSystem(anon=True)
    
    # AWS GOES buckets use UTC time and Julian Days (1-365)
    now_utc = datetime.now(timezone.utc)
    year = now_utc.strftime('%Y')
    julian_day = now_utc.strftime('%j')
    hour = now_utc.strftime('%H')
    
    # Path for CONUS (Continental US) Fire Detection Characteristics (FDC)
    # ABI-L2-FDCF = Full Disk (every 10 mins). ABI-L2-FDCC = CONUS (every 5 mins)
    bucket_path = f'noaa-goes18/ABI-L2-FDCC/{year}/{julian_day}/{hour}/'
    
    try:
        files = fs.ls(bucket_path)
        if not files:
            print(f"⚠️ No files found for the current hour ({hour}:00 UTC). Checking previous hour...")
            # Fallback to previous hour if the current hour just rolled over
            hour = str(int(hour) - 1).zfill(2)
            bucket_path = f'noaa-goes18/ABI-L2-FDCC/{year}/{julian_day}/{hour}/'
            files = fs.ls(bucket_path)

        print(f"\n✅ Found {len(files)} scan files for this hour.")
        print("🕒 Extracting scan timestamps from the 5 most recent files:\n")
        
        # The filename contains the exact scan time. Example:
        # OR_ABI-L2-FDCC-M6_G18_s20261361201170... -> 's' means start time
        for file in files[-5:]:
            match = re.search(r'_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})(\d)', file)
            if match:
                f_year, f_julian, f_hour, f_min, f_sec, f_tenth = match.groups()
                print(f"File: {file.split('/')[-1][:35]}... | Scan Time: {f_hour}:{f_min}:{f_sec} UTC")

    except Exception as e:
        print(f"❌ AWS S3 Error: {e}")

if __name__ == "__main__":
    verify_goes_cadence()