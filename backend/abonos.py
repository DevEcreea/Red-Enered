import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from server import db, get_current_user

logger = logging.getLogger("enered.abonos")

abonos_router = APIRouter(prefix="/api/abonos", tags=["abonos"])

@abonos_router.post("")
async def registrar_abono(
    monto: float = Form(...),
    fecha_deposito: str = Form(...),
    numero_operacion: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    empresa = user.get("empresa")
    if not empresa:
        raise HTTPException(status_code=400, detail="Usuario sin empresa asignada")

    # Guardar archivo
    file_bytes = await file.read()
    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    
    # Podemos guardarlo en db.files (storage) o directo
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
        "descripcion": f"Abono registrado (Op. {numero_operacion}), pendiente de validación",
        "abono_id": abono_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    })
    
    return {"ok": True, "id": abono_id}

@abonos_router.get("")
async def list_abonos(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] not in ["admin_enered", "administrador", "contabilidad"]:
        if not user.get("empresa"):
            return {"data": []}
        query["empresa"] = user["empresa"]
        
    cursor = db.abonos.find(query).sort("created_at", -1)
    abonos = await cursor.to_list(1000)
    for a in abonos:
        a["_id"] = str(a["_id"])
    return {"data": abonos}

@abonos_router.get("/files/{file_id}")
async def get_file(file_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin_enered", "administrador", "contabilidad"]:
        # El cliente solo puede ver sus propios archivos
        f = await db.files.find_one({"id": file_id})
        if not f or f.get("created_by") != user["id"]:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
    else:
        f = await db.files.find_one({"id": file_id})
        if not f:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
            
    return Response(content=f["data"], media_type=f["content_type"])

@abonos_router.get("/historial")
async def list_historial(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] not in ["admin_enered", "administrador", "contabilidad"]:
        if not user.get("empresa"):
            return {"data": []}
        query["empresa"] = user["empresa"]
        
    cursor = db.transacciones_historial.find(query).sort("created_at", -1)
    transacciones = await cursor.to_list(1000)
    for t in transacciones:
        t["_id"] = str(t["_id"])
    return {"data": transacciones}

@abonos_router.put("/{abono_id}/validar")
async def validar_abono(abono_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin_enered", "administrador", "contabilidad"]:
        raise HTTPException(status_code=403, detail="Sin permisos para validar abonos")
        
    abono = await db.abonos.find_one({"id": abono_id})
    if not abono:
        raise HTTPException(status_code=404, detail="Abono no encontrado")
    if abono["estado"] != "POR VALIDAR":
        raise HTTPException(status_code=400, detail=f"El abono ya está {abono['estado']}")
        
    monto_restante = float(abono["monto"])
    empresa_nombre = abono["empresa"]
    
    cursor = db.invoices.find({
        "empresa": empresa_nombre,
        "estado": {"$in": ["PENDIENTE", "pendiente", "vencida", "VENCIDA", "por_vencer"]}
    }).sort("fecha_emision", 1)
    facturas_pendientes = await cursor.to_list(1000)
    
    facturas_pagadas = []
    
    for fac in facturas_pendientes:
        if monto_restante <= 0:
            break
            
        deuda = float(fac.get("saldo", fac.get("monto_total", 0)))
        if deuda <= 0:
            continue
            
        if monto_restante >= deuda:
            await db.invoices.update_one(
                {"id": fac["id"]},
                {"$set": {"estado": "pagada", "saldo": 0.0}}
            )
            monto_restante -= deuda
            facturas_pagadas.append({"fac_id": fac["id"], "monto_aplicado": deuda})
            
            await db.transacciones_historial.insert_one({
                "id": str(uuid.uuid4()),
                "empresa": empresa_nombre,
                "tipo": "PAGO_FACTURA",
                "monto": deuda,
                "descripcion": f"Factura {fac.get('numero_documento', fac['id'])} pagada con abono {abono['numero_operacion']}",
                "abono_id": abono_id,
                "factura_id": fac["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"]
            })
        else:
            await db.invoices.update_one(
                {"id": fac["id"]},
                {"$set": {"saldo": round(deuda - monto_restante, 2)}}
            )
            facturas_pagadas.append({"fac_id": fac["id"], "monto_aplicado": monto_restante})
            
            await db.transacciones_historial.insert_one({
                "id": str(uuid.uuid4()),
                "empresa": empresa_nombre,
                "tipo": "PAGO_PARCIAL_FACTURA",
                "monto": monto_restante,
                "descripcion": f"Abono parcial ({monto_restante}) a factura {fac.get('numero_documento', fac['id'])}",
                "abono_id": abono_id,
                "factura_id": fac["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"]
            })
            monto_restante = 0.0
            
    excedente = monto_restante
    await db.abonos.update_one(
        {"id": abono_id},
        {"$set": {
            "estado": "CONCILIADO",
            "monto_excedente": excedente,
            "validated_at": datetime.now(timezone.utc).isoformat(),
            "validated_by": user["id"]
        }}
    )
    
    if excedente > 0:
        await db.empresas_config.update_one(
            {"empresa": empresa_nombre},
            {"$inc": {"saldo_a_favor": excedente}},
            upsert=True
        )
        t_id = None
        if t_id:
            await db.transacciones_historial.update_one(
                {"id": t_id},
                {"$set": {"monto": excedente}}
            )
        else:
            await db.transacciones_historial.insert_one({
                "id": str(uuid.uuid4()),
                "empresa": empresa_nombre,
                "tipo": "SALDO_PREPAGO_GENERADO",
                "monto": excedente,
                "descripcion": f"Saldo a favor generado por abono {abono['numero_operacion']}",
                "abono_id": abono_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"]
            })
        
    return {
        "ok": True,
        "monto_original": abono["monto"],
        "monto_usado": abono["monto"] - excedente,
        "monto_excedente": excedente,
        "facturas_pagadas": facturas_pagadas
    }
