"""
Clean and seed MongoDB directly with exact Facilito OSINERGMIN records.
"""
import asyncio
import os
from datetime import datetime, timezone
import motor.motor_asyncio

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "red_enered")

DATASET_FACILITO = [
  # LA LIBERTAD - PACASMAYO (Exact Facilito OSINERGMIN Records from Screenshot)
  {
    "establecimiento": "MULTISERVICIOS G & M S.R.L.",
    "direccion": "CARRETERA A CAJAMARCA KM 1.5 SECTOR PAMPAS DE JESÚS",
    "telefono": "",
    "precio_venta": 23.00,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "ciudad": "Guadalupe",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "G & N GRIFOS S.A.",
    "direccion": "AV. LEONCIO PRADO MZ. 2 LT. 14 SECTOR RAZURI CENTRO",
    "telefono": "044522080",
    "precio_venta": 23.25,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "PACASMAYO",
    "ciudad": "Pacasmayo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "ESTACION DE SERVICIOS SANTO TOMAS DE LIMA S.A.C.",
    "direccion": "CARRETERA PANAMERICANA SUR - VIA EVITAMIENTO 122 (PANAMERICANA NORTE KM 658)",
    "telefono": "",
    "precio_venta": 23.29,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "SAN PEDRO DE LLOC",
    "ciudad": "San Pedro de Lloc",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "SERVICELIB SAC",
    "direccion": "ESQUINA AV. LEONCIO PRADO Y GONZALO UGAS",
    "telefono": "937253132",
    "precio_venta": 23.55,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "PACASMAYO",
    "ciudad": "Pacasmayo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "GRUPO AMELIA E.I.R.L.",
    "direccion": "AV. INDUSTRIAL N° 324 LOTE 07",
    "telefono": "",
    "precio_venta": 23.65,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "ciudad": "Guadalupe",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "GRIFO CONTINENTAL S.A.C.",
    "direccion": "CARRETERA CIUDAD DE DIOS-CAJAMARCA KM. 5 VALLE JEQUETEPEQUE PREDIO LIMONCARRO SECTOR TAMARINDO",
    "telefono": "976362869",
    "precio_venta": 23.79,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "ciudad": "Guadalupe",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "ESTACION DE SERVICIOS SAN MIGUEL SP S.A.C.",
    "direccion": "PREDIO EL CHUNCHO SECTOR EL ROJAS CARRETERA A SAN JOSE C.P.M SAN MARTIN DE PORRES",
    "telefono": "",
    "precio_venta": 23.90,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "SAN JOSE",
    "ciudad": "San José",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "ESTACION DE SERVICIOS HUAYOBAMBA E.I.R.L.",
    "direccion": "CARRETERA CIUDAD DE DIOS - CAJAMARCA KM 3 U.C. N° 09861",
    "telefono": "934889437",
    "precio_venta": 23.95,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "ciudad": "Guadalupe",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "AERO GAS DEL NORTE SOCIEDAD ANONIMA CERRADA",
    "direccion": "CARRETERA A SAN JOSE LIMITE VERDUM",
    "telefono": "974686620/981545128",
    "precio_venta": 23.95,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "SAN JOSE",
    "ciudad": "San José",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "AERO GAS DEL NORTE SOCIEDAD ANONIMA CERRADA (PANAMERICANA)",
    "direccion": "CARRETERA PANAMERICANA NORTE KM. 690",
    "telefono": "974686620/981545128",
    "precio_venta": 23.95,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "SAN JOSE",
    "ciudad": "San José",
    "fuente": "facilito.gob.pe"
  }
]

async def run_clean():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    scraped_at = datetime.now(timezone.utc).isoformat()

    print("Deleting old sample records from db.precios...")
    await db.precios.delete_many({})

    print("Deleting old sample records from db.precios_facilito...")
    await db.precios_facilito.delete_many({})

    docs = []
    for item in DATASET_FACILITO:
        doc = dict(item)
        doc["scraped_at"] = scraped_at
        doc["es_enered"] = False
        docs.append(doc)

    await db.precios_facilito.insert_many(docs)

    estaciones_enered = [
        {
            "nombre_facilito": "SERVICELIB SAC",
            "precio_enered": 22.50,
            "departamento": "LA LIBERTAD",
            "provincia": "PACASMAYO",
            "distrito": "PACASMAYO",
            "acepta_factura": True,
            "acepta_tarjeta": True,
            "activa": True
        },
        {
            "nombre_facilito": "GRUPO AMELIA E.I.R.L.",
            "precio_enered": 22.40,
            "departamento": "LA LIBERTAD",
            "provincia": "PACASMAYO",
            "distrito": "GUADALUPE",
            "acepta_factura": True,
            "acepta_tarjeta": True,
            "activa": True
        }
    ]

    for e in estaciones_enered:
        await db.estaciones_enered.update_one(
            {"nombre_facilito": e["nombre_facilito"]},
            {"$set": e},
            upsert=True
        )

    print(f"✅ ¡Éxito! Se cargaron las {len(docs)} estaciones exactas de Facilito Pacasmayo en MongoDB.")

if __name__ == "__main__":
    asyncio.run(run_clean())
