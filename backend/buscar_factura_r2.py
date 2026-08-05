import asyncio
import os
import sys
from dotenv import load_dotenv

# Load env variables for MongoDB and R2
load_dotenv()

async def main():
    import motor.motor_asyncio
    MONGO_URL = os.environ.get("MONGO_URL")
    DB_NAME = os.environ.get("DB_NAME")
    
    if not MONGO_URL:
        print("ERROR: MONGO_URL no encontrado en .env")
        return
        
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. BUSCAR EN MONGODB
    print("="*60)
    print("1. BUSCANDO REGISTRO EN MONGODB (consumos_subsidio / invoices)")
    print("="*60)
    
    n_doc_target = "F021-00000645"
    
    # Buscar en consumos_subsidio
    doc = await db.consumos_subsidio.find_one({"numero_documento": n_doc_target})
    if not doc:
        doc = await db.consumos_subsidio.find_one({"n_doc": n_doc_target})
    
    if doc:
        print(f"✅ ENCONTRADO EN 'consumos_subsidio':")
        for k, v in doc.items():
            if "storage" in k or "key" in k or "file" in k or "pdf" in k or k in ["id", "_id", "empresa", "monto_total", "fecha", "numero_documento"]:
                print(f"   -> {k}: {v}")
    else:
        print(f"❌ NO ENCONTRADO EN 'consumos_subsidio'")
        
        # Buscar en invoices
        doc = await db.invoices.find_one({"n_doc": n_doc_target})
        if doc:
            print(f"✅ ENCONTRADO EN 'invoices':")
            for k, v in doc.items():
                if "storage" in k or "key" in k or "file" in k or "pdf" in k or k in ["id", "_id", "empresa", "monto_total", "f_emision", "n_doc"]:
                    print(f"   -> {k}: {v}")
        else:
            print(f"❌ NO ENCONTRADO EN 'invoices'")
    
    # 2. BUSCAR EN CLOUDFLARE R2
    print("\n" + "="*60)
    print("2. BUSCANDO ARCHIVO FÍSICO EN CLOUDFLARE R2")
    print("="*60)
    
    if not os.environ.get("R2_ACCESS_KEY_ID"):
        print("⚠️ No hay credenciales de R2 en el .env, buscando en carpeta local 'uploads'...")
        uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
        if os.path.exists(uploads_dir):
            import glob
            files = glob.glob(f"{uploads_dir}/**/*{n_doc_target}*", recursive=True)
            if files:
                print("✅ ARCHIVOS ENCONTRADOS LOCALMENTE:")
                for f in files:
                    print(f"   -> {f}")
            else:
                print("❌ Ningun archivo encontrado localmente.")
        return

    try:
        from storage import _get_r2, _bucket
        s3 = _get_r2()
        bucket = _bucket()
        
        print(f"Conectado a R2. Buscando cualquier archivo que contenga '{n_doc_target}' o 'BENICORP'...")
        
        paginator = s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=bucket)
        
        found = False
        for page in pages:
            if "Contents" in page:
                for obj in page["Contents"]:
                    key = obj["Key"]
                    if n_doc_target.lower() in key.lower() or "benicorp" in key.lower() or "00000645" in key.lower():
                        print(f"✅ ¡ENCONTRADO EN R2! -> Key: {key} | Tamaño: {obj['Size']} bytes | Modificado: {obj['LastModified']}")
                        found = True
                        
                        # Guardar copia local de rescate
                        safe_name = key.replace("/", "_")
                        print(f"   📥 Descargando copia de rescate localmente como: {safe_name}")
                        s3.download_file(bucket, key, safe_name)
                        
        if not found:
            print("❌ Lamentablemente, el archivo no existe en Cloudflare R2 con ese nombre.")
            print("   Es posible que el cliente no llegó a adjuntar el PDF físico (solo llenó el formulario),")
            print("   o se guardó con un nombre UUID completamente distinto (ej. 'subsidio/facturas/1234-5678.pdf').")
            
            # Si tenemos el doc de la DB, buscar exactamente por la llave que indica
            if doc and (doc.get("factura_storage_key") or doc.get("pdf_key") or doc.get("storage_key")):
                k = doc.get("factura_storage_key") or doc.get("pdf_key") or doc.get("storage_key")
                print(f"\n🔍 Verificando la llave exacta de la base de datos: {k}")
                try:
                    meta = s3.head_object(Bucket=bucket, Key=k)
                    print(f"   ✅ EXISTE! Tamaño: {meta['ContentLength']} bytes")
                    s3.download_file(bucket, k, f"RESCATE_{n_doc_target}.pdf")
                    print(f"   📥 Descargado como RESCATE_{n_doc_target}.pdf")
                except Exception as e:
                    print(f"   ❌ El archivo en esa ruta exacta YA NO EXISTE en Cloudflare R2: {e}")
                    
    except Exception as e:
        print(f"Error al conectar con R2: {e}")

if __name__ == "__main__":
    asyncio.run(main())
