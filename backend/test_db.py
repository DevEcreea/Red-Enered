import asyncio
from services.db import db, init_db

async def main():
    await init_db()
    c = await db.consumos_subsidio.find().sort("_id", -1).limit(10).to_list(10)
    for x in c:
        print(f"ID: {x.get('id')} N_DOC: {x.get('numero_documento')} FILE: {x.get('factura_filename')} KEY: {x.get('factura_storage_key')}")

if __name__ == "__main__":
    asyncio.run(main())
