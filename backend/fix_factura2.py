import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import re

load_dotenv()
MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    print("❌ Error: No se encontró MONGO_URL en el archivo .env")
    exit(1)

client = AsyncIOMotorClient(MONGO_URL)

async def fix_invoice():
    print("Conectando a la base de datos de producción...")
    
    # La ruta exacta que encontraste en Cloudflare R2
    real_key = "subsidio/6ddc7272-473e-4098-98b5-e4c161e09964/factura_subsidio/343dbb7b-TEG863_F021-00000654.PDF"
    
    # Buscar en ambas bases de datos posibles ("test" y "red_enered")
    for db_name in ["test", "red_enered", "enered_prod"]:
        db = client.get_database(db_name)
        
        # Usamos regex para encontrar cualquier documento que contenga 00000654 (por si hay typos)
        regex = re.compile("00000654", re.IGNORECASE)
        q = {"$or": [
            {"numero_documento": regex},
            {"n_doc": regex},
            {"factura_filename": regex},
            {"pdf_key": regex}
        ]}
        
        found = False
        
        # Buscar y actualizar en consumos_subsidio
        docs = await db.consumos_subsidio.find(q).to_list(100)
        for d in docs:
            await db.consumos_subsidio.update_one({"_id": d["_id"]}, {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}})
            print(f"✅ [BD: {db_name}] Actualizado en consumos_subsidio: {d.get('numero_documento') or d.get('n_doc')}")
            found = True
            
        # Buscar y actualizar en invoices
        docs = await db.invoices.find(q).to_list(100)
        for d in docs:
            await db.invoices.update_one({"_id": d["_id"]}, {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}})
            print(f"✅ [BD: {db_name}] Actualizado en invoices: {d.get('numero_documento') or d.get('n_doc')}")
            found = True
            
        # Buscar y actualizar en empresas_invoices
        docs = await db.empresas_invoices.find(q).to_list(100)
        for d in docs:
            await db.empresas_invoices.update_one({"_id": d["_id"]}, {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}})
            print(f"✅ [BD: {db_name}] Actualizado en empresas_invoices: {d.get('numero_documento') or d.get('n_doc')}")
            found = True

        if found:
            print(f"🎉 ¡TODO LISTO! Base de datos reparada.")
            return

    print(f"⚠️ Aún no se encontró la factura. Intentemos buscar con 00000645 por si acaso.")
    # Fallback: maybe the typo was 00000645 in the database!
    for db_name in ["test", "red_enered", "enered_prod"]:
        db = client.get_database(db_name)
        regex = re.compile("00000645", re.IGNORECASE)
        q = {"$or": [{"numero_documento": regex}, {"n_doc": regex}]}
        
        docs = await db.consumos_subsidio.find(q).to_list(100)
        for d in docs:
            await db.consumos_subsidio.update_one({"_id": d["_id"]}, {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}})
            print(f"✅ [BD: {db_name}] Actualizado typo (645) en consumos_subsidio!")
            return
            
        docs = await db.invoices.find(q).to_list(100)
        for d in docs:
            await db.invoices.update_one({"_id": d["_id"]}, {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}})
            print(f"✅ [BD: {db_name}] Actualizado typo (645) en invoices!")
            return

    print("❌ Definitivamente no se encontró ninguna factura que coincida.")

if __name__ == "__main__":
    asyncio.run(fix_invoice())
