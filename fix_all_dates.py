import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_all_dates():
    from dotenv import load_dotenv
    load_dotenv("backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    cursor = db.consumptions.find({})
    rows = await cursor.to_list(10000)
    
    fixed_count = 0
    for r in rows:
        fecha = r.get("FECHA")
        if not fecha: continue
        
        # Format is YYYY-MM-DD
        parts = fecha.split("-")
        if len(parts) == 3:
            y, m, d = parts
            
            # If the original was YYYY/05/12, it got parsed as YYYY-12-05
            # We know it's corrupted because they only have data up to July 2026.
            # If the month is > 7, it's DEFINITELY corrupted.
            # So if m > "07", we swap m and d!
            if int(m) > 7:
                new_fecha = f"{y}-{d}-{m}"
                await db.consumptions.update_one({"_id": r["_id"]}, {"$set": {"FECHA": new_fecha}})
                fixed_count += 1
                
    print(f"Fixed {fixed_count} corrupted dates.")

if __name__ == "__main__":
    asyncio.run(fix_all_dates())
