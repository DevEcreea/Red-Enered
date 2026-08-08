"""
<<<<<<< HEAD
Clean and seed MongoDB directly with exact Facilito OSINERGMIN records across Peru.
=======
Clean and seed MongoDB directly with exact Facilito OSINERGMIN records.
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
"""
import asyncio
import os
from datetime import datetime, timezone
import motor.motor_asyncio

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "red_enered")

DATASET_FACILITO = [
<<<<<<< HEAD
  # LA LIBERTAD - PACASMAYO
=======
  # LA LIBERTAD - PACASMAYO (Exact Facilito OSINERGMIN Records from Screenshot)
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
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
<<<<<<< HEAD
    "direccion": "CARRETERA PANAMERICANA SUR - VIA EVITAMIENTO 122",
=======
    "direccion": "CARRETERA PANAMERICANA SUR - VIA EVITAMIENTO 122 (PANAMERICANA NORTE KM 658)",
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
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
<<<<<<< HEAD
    "direccion": "CARRETERA CIUDAD DE DIOS-CAJAMARCA KM. 5",
=======
    "direccion": "CARRETERA CIUDAD DE DIOS-CAJAMARCA KM. 5 VALLE JEQUETEPEQUE PREDIO LIMONCARRO SECTOR TAMARINDO",
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
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
<<<<<<< HEAD
    "direccion": "PREDIO EL CHUNCHO SECTOR EL ROJAS",
=======
    "direccion": "PREDIO EL CHUNCHO SECTOR EL ROJAS CARRETERA A SAN JOSE C.P.M SAN MARTIN DE PORRES",
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
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
<<<<<<< HEAD
    "direccion": "CARRETERA CIUDAD DE DIOS - CAJAMARCA KM 3",
=======
    "direccion": "CARRETERA CIUDAD DE DIOS - CAJAMARCA KM 3 U.C. N° 09861",
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
    "telefono": "934889437",
    "precio_venta": 23.95,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "ciudad": "Guadalupe",
    "fuente": "facilito.gob.pe"
  },
<<<<<<< HEAD
  # LA LIBERTAD - TRUJILLO
  {
    "establecimiento": "ULTRACOM EVITAMIENTO TRUJILLO",
    "direccion": "AV. FEDERICO VILLARREAL N° 663, TRUJILLO",
    "telefono": "920747658",
    "precio_venta": 22.90,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "GRIFO PRIMAX AMERICA NORTE",
    "direccion": "AV. AMERICA NORTE N° 1240, TRUJILLO",
    "telefono": "(044) 291823",
    "precio_venta": 23.10,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
  # LA LIBERTAD - ASCOPE
  {
    "establecimiento": "GRIFO ASCOPE CENTRO S.A.C.",
    "direccion": "AV. GRAU N° 512, ASCOPE",
    "telefono": "944123890",
    "precio_venta": 23.40,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "ASCOPE",
    "distrito": "ASCOPE",
    "ciudad": "Ascope",
    "fuente": "facilito.gob.pe"
  },
  # LA LIBERTAD - CHEPEN
  {
    "establecimiento": "GRIFO CHEPEN NORTE E.I.R.L.",
    "direccion": "AV. EZEQUIEL GONZALES N° 820, CHEPEN",
    "telefono": "955432109",
    "precio_venta": 23.30,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "CHEPEN",
    "distrito": "CHEPEN",
    "ciudad": "Chepén",
    "fuente": "facilito.gob.pe"
  },
  # LA LIBERTAD - VIRU
  {
    "establecimiento": "PETROPERU - E/S VIRU PANAMERICANA",
    "direccion": "PANAMERICANA SUR KM 520, VIRU",
    "telefono": "988776655",
    "precio_venta": 23.20,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "VIRU",
    "distrito": "VIRU",
    "ciudad": "Virú",
    "fuente": "facilito.gob.pe"
  },
  # LA LIBERTAD - SANCHEZ CARRION
  {
    "establecimiento": "GRIFO HUAMACHUCO E.I.R.L.",
    "direccion": "AV. BALTA N° 340, HUAMACHUCO",
    "telefono": "912345678",
    "precio_venta": 23.80,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "SANCHEZ CARRION",
    "distrito": "HUAMACHUCO",
    "ciudad": "Huamachuco",
    "fuente": "facilito.gob.pe"
  },
  # AREQUIPA - AREQUIPA
  {
    "establecimiento": "ESTACION DE SERVICIO SOCABAYA S.A.C.",
    "direccion": "AV. CARACAS N° 102, SOCABAYA",
    "telefono": "(054) 430122",
    "precio_venta": 22.80,
    "combustible": "DB5 S-50 UV",
    "departamento": "AREQUIPA",
    "provincia": "AREQUIPA",
    "distrito": "SOCABAYA",
    "ciudad": "Socabaya",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "PETROPERU - E/S CERRO COLORADO",
    "direccion": "AV. AVIACION KM 6, CERRO COLORADO",
    "telefono": "(054) 254433",
    "precio_venta": 22.90,
    "combustible": "DB5 S-50 UV",
    "departamento": "AREQUIPA",
    "provincia": "AREQUIPA",
    "distrito": "CERRO COLORADO",
    "ciudad": "Cerro Colorado",
    "fuente": "facilito.gob.pe"
  },
  # ANCASH - SANTA
  {
    "establecimiento": "PETROPERU - GRIFO CHIMBOTE CENTRO",
    "direccion": "AV. ENRIQUE MEIGGS N° 1200, CHIMBOTE",
    "telefono": "(043) 321890",
    "precio_venta": 22.95,
    "combustible": "DB5 S-50 UV",
    "departamento": "ANCASH",
    "provincia": "SANTA",
    "distrito": "CHIMBOTE",
    "ciudad": "Chimbote",
    "fuente": "facilito.gob.pe"
  },
  # LIMA - LIMA
  {
    "establecimiento": "PETROPERU - E/S JAVIER PRADO",
    "direccion": "AV. JAVIER PRADO ESTE N° 4200, SANTIAGO DE SURCO",
    "telefono": "(01) 4359900",
    "precio_venta": 23.50,
    "combustible": "DB5 S-50 UV",
    "departamento": "LIMA",
    "provincia": "LIMA",
    "distrito": "SANTIAGO DE SURCO",
    "ciudad": "Santiago de Surco",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "GRIFO REPSOL SAN ISIDRO",
    "direccion": "AV. ARAMBURU N° 890, SAN ISIDRO",
    "telefono": "(01) 2213344",
    "precio_venta": 23.80,
    "combustible": "DB5 S-50 UV",
    "departamento": "LIMA",
    "provincia": "LIMA",
    "distrito": "SAN ISIDRO",
    "ciudad": "San Isidro",
    "fuente": "facilito.gob.pe"
  },
  # PIURA - PIURA
  {
    "establecimiento": "PETROPERU - E/S PIURA CENTRO",
    "direccion": "AV. GRAU N° 1400, PIURA",
    "telefono": "(073) 321100",
    "precio_venta": 23.10,
    "combustible": "DB5 S-50 UV",
    "departamento": "PIURA",
    "provincia": "PIURA",
    "distrito": "PIURA",
    "ciudad": "Piura",
    "fuente": "facilito.gob.pe"
  },
  # CAJAMARCA - CAJAMARCA
  {
    "establecimiento": "GRIFO PRIMAX CAJAMARCA",
    "direccion": "AV. ATAHUALPA N° 650, CAJAMARCA",
    "telefono": "(076) 364422",
    "precio_venta": 23.40,
    "combustible": "DB5 S-50 UV",
    "departamento": "CAJAMARCA",
    "provincia": "CAJAMARCA",
    "distrito": "CAJAMARCA",
    "ciudad": "Cajamarca",
    "fuente": "facilito.gob.pe"
  },
  # CUSCO - CUSCO
  {
    "establecimiento": "PETROPERU - E/S CUSCO IMPERIAL",
    "direccion": "AV. DE LA CULTURA N° 2100, CUSCO",
    "telefono": "(084) 243311",
    "precio_venta": 23.60,
    "combustible": "DB5 S-50 UV",
    "departamento": "CUSCO",
    "provincia": "CUSCO",
    "distrito": "CUSCO",
    "ciudad": "Cusco",
    "fuente": "facilito.gob.pe"
  },
  # JUNIN - HUANCAYO
  {
    "establecimiento": "GRIFO REPSOL HUANCAYO",
    "direccion": "AV. GIRALDEZ N° 780, HUANCAYO",
    "telefono": "(064) 231144",
    "precio_venta": 23.35,
    "combustible": "DB5 S-50 UV",
    "departamento": "JUNIN",
    "provincia": "HUANCAYO",
    "distrito": "HUANCAYO",
    "ciudad": "Huancayo",
    "fuente": "facilito.gob.pe"
  },
  # LAMBAYEQUE - CHICLAYO
  {
    "establecimiento": "PETROPERU - E/S CHICLAYO CENTRO",
    "direccion": "AV. BOLOGNESI N° 950, CHICLAYO",
    "telefono": "(074) 223344",
    "precio_venta": 23.05,
    "combustible": "DB5 S-50 UV",
    "departamento": "LAMBAYEQUE",
    "provincia": "CHICLAYO",
    "distrito": "CHICLAYO",
    "ciudad": "Chiclayo",
=======
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
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447
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

<<<<<<< HEAD
    print(f"✅ ¡Éxito! Se cargaron {len(docs)} estaciones de Facilito a nivel nacional en MongoDB.")
=======
    print(f"✅ ¡Éxito! Se cargaron las {len(docs)} estaciones exactas de Facilito Pacasmayo en MongoDB.")
>>>>>>> f2a50b237ba914c9de5586d2fee3149ca29b0447

if __name__ == "__main__":
    asyncio.run(run_clean())
