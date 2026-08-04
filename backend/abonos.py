import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, Request

logger = logging.getLogger("enered.abonos")

abonos_router = APIRouter(prefix="/api/abonos", tags=["abonos"])

def _get_db():
    import server
    return server.db

async def get_current_user_dynamic(request: Request):
    import server
    return await server.get_current_user(request)

@abonos_router.post("")
async def registrar_abono(
    monto: float = Form(...),
    fecha_deposito: str = Form(...),
    numero_operacion: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user_dynamic)
):
    db = _get_db()
    empresa = user.get("empresa")
    if not empresa:
        raise HTTPException(status_code=400, detail="Usuario sin empresa asignada")

    file_bytes = await file.read()
    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    
    await db.files.insert_one({
        "id": file_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "data": file_bytes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    })
    
    voucher_url = f"/api/abonos/files/{file_id}"

    abono_id = str(uuid.uuid4())
    doc = {
        "id": abono_id,
        "empresa": empresa,
        "monto": monto,
        "fecha_deposito": fecha_deposito,
        "numero_operacion": numero_operacion,
        "voucher_url": voucher_url,
        "estado": "POR VALIDAR",
        "monto_excedente": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.abonos.insert_one(doc)
    
    await db.transacciones_historial.insert_one({
        "id": str(uuid.uuid4()),
        "empresa": empresa,
        "tipo": "ABONO_REGISTRADO",
        "monto": monto,
        "descripcion": f"Abono registrado por S/ {monto:.2f} (Op: {numero_operacion})",
        "fecha": datetime.now(timezone.utc).isoformat(),
        "referencia_id": abono_id
    })

    return {"ok": True, "abono": doc}


@abonos_router.get("/mis-abonos")
async def listar_mis_abonos(user: dict = Depends(get_current_user_dynamic)):
    db = _get_db()
    empresa = user.get("empresa")
    if not empresa:
        return []
    cursor = db.abonos.find({"empresa": empresa}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@abonos_router.get("/admin/pendientes")
async def listar_abonos_pendientes(user: dict = Depends(get_current_user_dynamic)):
    db = _get_db()
    if user.get("role") != "admin_enered":
        raise HTTPException(status_code=403, detail="No autorizado")
    cursor = db.abonos.find({"estado": "POR VALIDAR"}, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(500)


@abonos_router.post("/admin/{abono_id}/aprobar")
async def aprobar_abono(abono_id: str, user: dict = Depends(get_current_user_dynamic)):
    db = _get_db()
    if user.get("role") != "admin_enered":
        raise HTTPException(status_code=403, detail="No autorizado")
        
    abono = await db.abonos.find_one({"id": abono_id}, {"_id": 0})
    if not abono:
        raise HTTPException(status_code=404, detail="Abono no encontrado")
    if abono["estado"] != "POR VALIDAR":
        raise HTTPException(status_code=400, detail="El abono ya fue procesado")

    empresa = abono["empresa"]
    monto_abono = float(abono["monto"])
    monto_restante = monto_abono

    cursor = db.invoices.find({
        "empresa": empresa,
        "estado": {"$in": ["PENDIENTE", "pendiente", "vencida", "VENCIDA", "por_vencer"]}
    }).sort("fecha_emision", 1)
    invoices = await cursor.to_list(1000)

    for fac in invoices:
        if monto_restante <= 0:
            break
        deuda = float(fac.get("saldo", fac.get("monto_total", 0)))
        if deuda <= 0:
            continue
            
        if monto_restante >= deuda:
            await db.invoices.update_one({"id": fac["id"]}, {"$set": {"estado": "pagada", "saldo": 0.0}})
            monto_restante -= deuda
        else:
            nuevo_saldo = round(deuda - monto_restante, 2)
            await db.invoices.update_one({"id": fac["id"]}, {"$set": {"saldo": nuevo_saldo}})
            monto_restante = 0.0

    excedente = round(monto_restante, 2)
    if excedente > 0:
        config = await db.empresas_config.find_one({"empresa": empresa})
        saldo_actual = float(config.get("saldo_a_favor", 0.0)) if config else 0.0
        nuevo_saldo_favor = round(saldo_actual + excedente, 2)
        await db.empresas_config.update_one(
            {"empresa": empresa},
            {"$set": {"saldo_a_favor": nuevo_saldo_favor}},
            upsert=True
        )

    await db.abonos.update_one(
        {"id": abono_id},
        {"$set": {
            "estado": "APROBADO",
            "monto_excedente": excedente,
            "procesado_at": datetime.now(timezone.utc).isoformat(),
            "procesado_por": user["id"]
        }}
    )

    await db.transacciones_historial.insert_one({
        "id": str(uuid.uuid4()),
        "empresa": empresa,
        "tipo": "ABONO_APROBADO",
        "monto": monto_abono,
        "descripcion": f"Abono de S/ {monto_abono:.2f} APROBADO. Excedente a favor: S/ {excedente:.2f}",
        "fecha": datetime.now(timezone.utc).isoformat(),
        "referencia_id": abono_id
    })

    return {"ok": True, "estado": "APROBADO", "excedente": excedente}


@abonos_router.post("/admin/{abono_id}/rechazar")
async def rechazar_abono(abono_id: str, motivo: str = Form(...), user: dict = Depends(get_current_user_dynamic)):
    db = _get_db()
    if user.get("role") != "admin_enered":
        raise HTTPException(status_code=403, detail="No autorizado")
        
    abono = await db.abonos.find_one({"id": abono_id}, {"_id": 0})
    if not abono:
        raise HTTPException(status_code=404, detail="Abono no encontrado")
    if abono["estado"] != "POR VALIDAR":
        raise HTTPException(status_code=400, detail="El abono ya fue procesado")

    await db.abonos.update_one(
        {"id": abono_id},
        {"$set": {
            "estado": "RECHAZADO",
            "motivo_rechazo": motivo,
            "procesado_at": datetime.now(timezone.utc).isoformat(),
            "procesado_por": user["id"]
        }}
    )

    await db.transacciones_historial.insert_one({
        "id": str(uuid.uuid4()),
        "empresa": abono["empresa"],
        "tipo": "ABONO_RECHAZADO",
        "monto": float(abono["monto"]),
        "descripcion": f"Abono RECHAZADO: {motivo}",
        "fecha": datetime.now(timezone.utc).isoformat(),
        "referencia_id": abono_id
    })

    return {"ok": True, "estado": "RECHAZADO"}


@abonos_router.get("/files/{file_id}")
async def get_file(file_id: str):
    db = _get_db()
    doc = await db.files.find_one({"id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return Response(content=doc["data"], media_type=doc.get("content_type", "application/pdf"))
