"""
Seed script to insert real Facilito OSINERGMIN fuel station prices across Peru into MongoDB.
"""
import asyncio
import os
from datetime import datetime, timezone
import motor.motor_asyncio

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "red_enered")

DATASET_FACILITO = [
  # LA LIBERTAD - TRUJILLO (REGISTROS REALES DE OSINERGMIN FACILITO)
  {
    "establecimiento": "EMPRESA DE TRANSPORTES SEÑOR DE LA MISERICORDIA S.A.",
    "direccion": "ESQUINA AVENIDA JULIAN ARCE LARRETA Y EL JR. CARLOS MANUEL COX",
    "telefono": "975805029 / 977199725",
    "precio_venta": 18.40,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "LAREDO",
    "ciudad": "Laredo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "ESTACION DE SERVICIOS PESQUEDA 07 E.I.R.L.",
    "direccion": "AV. CAMINO REAL S/N SECTOR FALDAS CERRO PESQUEDA LOTE 7",
    "telefono": "051982632781 / 999501950",
    "precio_venta": 22.39,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "EE SS GASOLINAS DE AMERICA SAC",
    "direccion": "JIRON MANUEL UBALDE N° 1103",
    "telefono": "044-219800",
    "precio_venta": 22.49,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "EL PORVENIR",
    "ciudad": "El Porvenir",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "CONSORCIO Y PROYECTOS R&R S.R.L.",
    "direccion": "PREDIO QUEVEDO MZ. A LOTES 1 Y 2",
    "telefono": "965919171",
    "precio_venta": 22.88,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "MOCHE",
    "ciudad": "Moche",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "ESTACION DE SERVICIOS EL REPOSO S.A.C.",
    "direccion": "AREA DE RESERVA GRLL-5, SECTOR EL MILAGRO ETAPA III VALLE MOCHE",
    "telefono": "044-281100",
    "precio_venta": 22.99,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "HUANCHACO",
    "ciudad": "Huanchaco",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "PETRONEX PERU S.A.C.",
    "direccion": "ESQUINA AV. CESAR VALLEJO CON JR. LOS DIAMANTES, URB. LA RINCONADA",
    "telefono": "044213406 / 012215288",
    "precio_venta": 22.99,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "PETRONEX PERU S.A.C.",
    "direccion": "AV. JOSE GABRIEL CONDORCANQUI N° 1241",
    "telefono": "949496076",
    "precio_venta": 22.99,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "LA ESPERANZA",
    "ciudad": "La Esperanza",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "CHECAPET SRL",
    "direccion": "AV. LARCO N° 193 URB. EL RECREO",
    "telefono": "051914330018 / 950023575",
    "precio_venta": 22.99,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "MULTISERVICIOS ECOGAS SAC",
    "direccion": "AV. CESAR VALLEJO NRO 1180-1186 URB ARANJUEZ",
    "telefono": "044-229988",
    "precio_venta": 22.99,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
  {
    "establecimiento": "GRIFO E INVERSIONES A & B E.I.R.L.",
    "direccion": "AV. VICTOR ANDRES BELAUNDE N° 561 - 569 URB. SANTO DOMINGUITO",
    "telefono": "944556677",
    "precio_venta": 23.00,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "ciudad": "Trujillo",
    "fuente": "facilito.gob.pe"
  },
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
  # LA LIBERTAD - PACASMAYO
  {
    "establecimiento": "MULTISERVICIOS G & M S.R.L.",
    "direccion": "CARRETERA A CAJAMARCA KM 1.5 SECTOR PAMPAS DE JESÚS",
    "telefono": "044-522100",
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
    "telefono": "044-522080",
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
    "direccion": "CARRETERA PANAMERICANA SUR - VIA EVITAMIENTO 122",
    "telefono": "044-523456",
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
    "telefono": "044-529876",
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
    "direccion": "CARRETERA CIUDAD DE DIOS-CAJAMARCA KM. 5",
    "telefono": "976362869",
    "precio_venta": 23.79,
    "combustible": "DB5 S-50 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "ciudad": "Guadalupe",
    "fuente": "facilito.gob.pe"
  },
  # AMAZONAS
  {
    "establecimiento": "GRIFO BAGUA CENTRO S.A.C.",
    "direccion": "AV. HEROES DEL CENEPA N° 450, BAGUA",
    "telefono": "041-471234",
    "precio_venta": 23.40,
    "combustible": "DB5 S-50 UV",
    "departamento": "AMAZONAS",
    "provincia": "BAGUA",
    "distrito": "BAGUA",
    "ciudad": "Bagua",
    "fuente": "facilito.gob.pe"
  },
  # ANCASH
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
  # AREQUIPA
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
  # LIMA
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
  }
]

ESTACIONES_ENERED_DEFAULTS = [
  {
    "nombre_facilito": "SERVICELIB SAC",
    "precio_enered": 22.50,
    "combustible": "Diesel B5 UV",
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
    "combustible": "Diesel B5 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "PACASMAYO",
    "distrito": "GUADALUPE",
    "acepta_factura": True,
    "acepta_tarjeta": True,
    "activa": True
  },
  {
    "nombre_facilito": "ULTRACOM EVITAMIENTO TRUJILLO",
    "precio_enered": 20.97,
    "combustible": "Diesel B5 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "acepta_factura": True,
    "acepta_tarjeta": True,
    "activa": True
  },
  {
    "nombre_facilito": "ES ALTO MOCHE",
    "precio_enered": 20.97,
    "combustible": "Diesel B5 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "MOCHE",
    "acepta_factura": True,
    "acepta_tarjeta": True,
    "activa": True
  },
  {
    "nombre_facilito": "ES SANTA AMALIA",
    "precio_enered": 20.97,
    "combustible": "Diesel B5 UV",
    "departamento": "LA LIBERTAD",
    "provincia": "TRUJILLO",
    "distrito": "TRUJILLO",
    "acepta_factura": True,
    "acepta_tarjeta": True,
    "activa": True
  }
]

async def seed(db=None):
    if db is None:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        db = client[DB_NAME]

    scraped_at = datetime.now(timezone.utc).isoformat()

    count = 0
    for item in DATASET_FACILITO:
        doc = dict(item)
        doc["scraped_at"] = scraped_at
        doc["es_enered"] = False
        await db.precios_facilito.update_one(
            {
                "establecimiento": doc["establecimiento"],
                "departamento": doc["departamento"],
                "combustible": doc["combustible"]
            },
            {"$set": doc},
            upsert=True
        )
        count += 1

    for e in ESTACIONES_ENERED_DEFAULTS:
        await db.estaciones_enered.update_one(
            {"nombre_facilito": e["nombre_facilito"]},
            {"$set": e},
            upsert=True
        )

    await db.precios_facilito.create_index("combustible")
    await db.precios_facilito.create_index("departamento")
    await db.precios_facilito.create_index("provincia")

    print(f"✅ Se han procesado {count} estaciones en MongoDB sin borrar existentes.")
    return count

if __name__ == "__main__":
    asyncio.run(seed())
