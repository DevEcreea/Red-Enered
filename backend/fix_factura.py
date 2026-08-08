import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    print("❌ Error: No se encontró MONGO_URL en el archivo .env")
    exit(1)

client = AsyncIOMotorClient(MONGO_URL)
db_name = os.getenv("MONGO_DB_NAME", "red_enered")
db = client.get_database(db_name)

async def fix_invoice():
    print("Conectando a la base de datos de producción...")
    
    # La ruta exacta que encontraste en Cloudflare R2
    real_key = "subsidio/6ddc7272-473e-4098-98b5-e4c161e09964/factura_subsidio/343dbb7b-TEG863_F021-00000654.PDF"
    doc_number = "F021-00000654"

    # Actualizar consumos_subsidio
    result = await db.consumos_subsidio.update_many(
        {"numero_documento": doc_number},
        {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}}
    )
    
    # Actualizar empresas_invoices y invoices por si acaso
    await db.invoices.update_many(
        {"n_doc": doc_number},
        {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}}
    )
    await db.empresas_invoices.update_many(
        {"n_doc": doc_number},
        {"$set": {"factura_storage_key": real_key, "pdf_key": real_key}}
    )

    if result.modified_count > 0 or result.matched_count > 0:
        print(f"✅ ¡ÉXITO! La base de datos ha sido corregida para la factura {doc_number}.")
        print("➡️ Ahora ve a la plataforma web y recarga la página. La factura ya debería ser visible.")
    else:
        print(f"⚠️ No se encontró la factura {doc_number} en la base de datos para actualizar.")

if __name__ == "__main__":
    asyncio.run(fix_invoice())
