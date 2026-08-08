"""
run_facilito_scrape.py
======================
Ejecuta el scraping completo de Facilito OSINERGMIN e inserta
TODAS las estaciones reales en MongoDB.

Uso:
    python run_facilito_scrape.py

Este script itera los 25 departamentos x 3 combustibles = 75 peticiones
a facilito.gob.pe y guarda cada estacion en MongoDB.
Tiempo estimado: 3-6 minutos dependiendo de la conexion.
"""
import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timezone

# Configura logs legibles
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Agrega el directorio actual al path para importar modulos locales
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import motor.motor_asyncio

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "red_enered")


async def main():
    logger.info("=" * 60)
    logger.info("FACILITO SCRAPER - Iniciando scraping nacional")
    logger.info("=" * 60)

    # Conectar a MongoDB
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    logger.info(f"Conectado a MongoDB: {DB_NAME}")

    # Importar el scraper
    from services.facilito_scraper import scrape_all_precios

    # Obtener estaciones ENERED existentes para marcarlas
    enered_docs = await db.estaciones_enered.find({}, {"nombre_facilito": 1}).to_list(1000)
    enered_stations = {e.get("nombre_facilito", "") for e in enered_docs if e.get("nombre_facilito")}
    logger.info(f"Estaciones ENERED configuradas: {len(enered_stations)}")

    # Ejecutar scraping en thread (httpx sincrono)
    logger.info("Iniciando scraping de facilito.gob.pe ...")
    start = time.time()

    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, scrape_all_precios, enered_stations)

    elapsed = round(time.time() - start, 1)
    logger.info(f"Scraping completado en {elapsed}s - {len(results)} estaciones encontradas")

    if not results:
        logger.warning("⚠️  El scraper no retorno datos. Verificar conexion a facilito.gob.pe")
        logger.info("Usando seed de respaldo...")
        from seed_facilito_precios import seed
        await seed(db)
        count = await db.precios_facilito.count_documents({})
        logger.info(f"✅ Seed de respaldo insertado: {count} estaciones")
        return

    # Insertar en MongoDB
    logger.info("Borrando registros anteriores e insertando nuevos...")
    await db.precios_facilito.delete_many({})
    await db.precios_facilito.insert_many(results)

    # Crear indices para busquedas rapidas
    await db.precios_facilito.create_index("departamento")
    await db.precios_facilito.create_index("provincia")
    await db.precios_facilito.create_index("combustible")
    await db.precios_facilito.create_index("es_enered")

    # Estadisticas finales
    total = await db.precios_facilito.count_documents({})
    dptos = await db.precios_facilito.distinct("departamento")
    combustibles = await db.precios_facilito.distinct("combustible")

    logger.info("=" * 60)
    logger.info(f"✅ COMPLETADO: {total} estaciones insertadas en MongoDB")
    logger.info(f"   Departamentos: {len(dptos)}")
    logger.info(f"   Combustibles: {combustibles}")
    logger.info("=" * 60)
    logger.info("Ahora presiona F5 en tu navegador para ver TODAS las estaciones.")


if __name__ == "__main__":
    asyncio.run(main())
