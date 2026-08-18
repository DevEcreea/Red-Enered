"""
Prueba de concepto — API SIRE (SUNAT): traer el Registro de Compras (RCE) de un cliente.

Valida el supuesto clave del modelo: con las credenciales de API generadas en SOL
(+ usuario/clave SOL), ENERED puede listar TODOS los comprobantes que le emitieron
al contribuyente, sin que él descargue ni suba nada.

Uso:
  1. Llenar en backend/.env: SIRE_CLIENT_ID, SIRE_CLIENT_SECRET, SIRE_RUC,
     SIRE_USUARIO, SIRE_CLAVE  (el usuario/clave SOL — idealmente un usuario secundario)
  2. ./.venv/bin/python scripts/test_sire.py [periodo]   (default: 202606)
"""
import io
import os
import sys
import time
import zipfile
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

CLIENT_ID = (os.getenv("SIRE_CLIENT_ID") or "").strip()
CLIENT_SECRET = (os.getenv("SIRE_CLIENT_SECRET") or "").strip()
RUC = (os.getenv("SIRE_RUC") or "").strip()
USUARIO = (os.getenv("SIRE_USUARIO") or "").strip()
CLAVE = (os.getenv("SIRE_CLAVE") or "").strip()
PERIODO = (sys.argv[1] if len(sys.argv) > 1 else "202606").strip()

BASE = "https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros"
UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


def fallo(msg: str):
    print(f"\n❌ {msg}")
    sys.exit(1)


def main():
    faltan = [k for k, v in [("SIRE_CLIENT_ID", CLIENT_ID), ("SIRE_CLIENT_SECRET", CLIENT_SECRET),
                             ("SIRE_RUC", RUC), ("SIRE_USUARIO", USUARIO), ("SIRE_CLAVE", CLAVE)] if not v]
    if faltan:
        fallo(f"Faltan en backend/.env: {', '.join(faltan)}")

    with httpx.Client(timeout=60, headers=UA) as c:
        # ── 1) Token (grant password: usuario/clave SOL)
        print(f"1) Pidiendo token para RUC {RUC} (usuario {USUARIO})…")
        r = c.post(f"https://api-seguridad.sunat.gob.pe/v1/clientessol/{CLIENT_ID}/oauth2/token/",
                   data={"grant_type": "password",
                         "scope": "https://api-sire.sunat.gob.pe",
                         "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
                         "username": f"{RUC}{USUARIO}", "password": CLAVE})
        if r.status_code != 200:
            fallo(f"Token rechazado (HTTP {r.status_code}): {r.text[:300]}\n"
                  "   → Revisa client_id/secret, y que el usuario/clave SOL sean correctos.")
        token = r.json().get("access_token")
        print("   ✅ Token obtenido")
        H = {**UA, "Authorization": f"Bearer {token}"}

        # ── 2) Periodos disponibles del RCE
        print("2) Consultando periodos habilitados del RCE…")
        r = c.get(f"{BASE}/rvierce/padron/web/omisos/080000/periodos", headers=H)
        if r.status_code == 200:
            data = r.json()
            pers = []
            for e in (data if isinstance(data, list) else []):
                for p in e.get("lisPeriodos", []) or []:
                    pers.append(p.get("perTributario"))
            print(f"   ✅ Periodos: {sorted(set(filter(None, pers)))[-8:] or '(no reportó)'}")
        else:
            print(f"   ⚠ HTTP {r.status_code} (sigo igual): {r.text[:150]}")

        # ── 3) Solicitar la exportación de la propuesta (CSV)
        print(f"3) Solicitando propuesta del RCE · periodo {PERIODO}…")
        r = c.get(f"{BASE}/rce/propuesta/web/propuesta/{PERIODO}/exportacioncomprobantepropuesta",
                  params={"codTipoArchivo": 1, "codOrigenEnvio": 2}, headers=H)
        if r.status_code != 200:
            fallo(f"No se pudo solicitar la propuesta (HTTP {r.status_code}): {r.text[:300]}")
        ticket = r.json().get("numTicket")
        print(f"   ✅ Ticket: {ticket}")

        # ── 4) Esperar el ticket
        print("4) Esperando que SUNAT procese…")
        nombre = None
        for i in range(30):
            time.sleep(4)
            r = c.get(f"{BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets",
                      params={"perIni": PERIODO, "perFin": PERIODO, "page": 1, "perPage": 20,
                              "numTicket": ticket}, headers=H)
            if r.status_code != 200:
                continue
            regs = (r.json() or {}).get("registros") or []
            if not regs:
                continue
            reg = regs[0]
            estado = reg.get("desEstadoProceso") or reg.get("codEstadoProceso")
            print(f"   … intento {i+1}: {estado}")
            archivos = reg.get("archivoReporte") or []
            if archivos and str(reg.get("codEstadoProceso")) in ("06", "6") or (archivos and "Terminado" in str(estado)):
                nombre = archivos[0].get("nomArchivoReporte")
                break
            if archivos:
                nombre = archivos[0].get("nomArchivoReporte")
                if nombre:
                    break
        if not nombre:
            fallo("El ticket no terminó a tiempo. Vuelve a correr el script en un minuto.")

        # ── 5) Descargar y resumir
        print(f"5) Descargando {nombre}…")
        r = c.get(f"{BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte",
                  params={"nomArchivoReporte": nombre, "codTipoArchivoReporte": "01",
                          "perTributario": PERIODO, "codProceso": "1", "numTicket": ticket}, headers=H)
        if r.status_code != 200:
            fallo(f"No se pudo descargar (HTTP {r.status_code}): {r.text[:200]}")
        contenido = r.content
        try:
            zf = zipfile.ZipFile(io.BytesIO(contenido))
            interno = zf.namelist()[0]
            texto = zf.read(interno).decode("utf-8", errors="replace")
        except zipfile.BadZipFile:
            texto = contenido.decode("utf-8", errors="replace")

        lineas = [l for l in texto.splitlines() if l.strip()]
        print(f"\n{'='*74}\n✅ PROPUESTA RCE {PERIODO} — {max(len(lineas)-1,0)} comprobantes\n{'='*74}")
        if lineas:
            cab = lineas[0].split("|")
            print("Columnas:", " | ".join(cab[:10]), "…" if len(cab) > 10 else "")
            for l in lineas[1:6]:
                c_ = l.split("|")
                print("  ·", " | ".join(c_[:10]))
            if len(lineas) > 6:
                print(f"  … y {len(lineas)-6} más")
        out = Path(__file__).parent / f"rce_{RUC}_{PERIODO}.csv"
        out.write_text(texto, encoding="utf-8")
        print(f"\nArchivo completo guardado en: {out}")


if __name__ == "__main__":
    main()
