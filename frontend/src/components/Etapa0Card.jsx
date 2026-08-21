import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Coins, CheckCircle2, XCircle, AlertTriangle, Loader2, MessageCircle, Clock3, BarChart3,
  ChevronDown, ChevronUp,
} from "lucide-react";

const fmtSoles = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n) => (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const WSP_NUMERO = "51997389536";

/* ── Calendario de los decretos ─────────────────────────────────────────── */
const DU004_FIN = new Date(2026, 8, 28, 23, 59, 59);   // cierre único 28 set 2026
const DU004_INI = new Date(2026, 6, 28);               // apertura de la ventana
/* DU 007: [inicio consumo, fin consumo, abre ventana, cierra ventana] */
const DU007_PERIODOS = [
  { n: 1, ci: new Date(2026, 7, 16), cf: new Date(2026, 8, 15, 23, 59, 59), ai: new Date(2026, 8, 16), af: new Date(2026, 9, 15, 23, 59, 59), consumo: "16 ago–15 set", presenta: "16 set–15 oct" },
  { n: 2, ci: new Date(2026, 8, 16), cf: new Date(2026, 9, 15, 23, 59, 59), ai: new Date(2026, 9, 16), af: new Date(2026, 10, 15, 23, 59, 59), consumo: "16 set–15 oct", presenta: "16 oct–15 nov" },
  { n: 3, ci: new Date(2026, 9, 16), cf: new Date(2026, 10, 15, 23, 59, 59), ai: new Date(2026, 10, 16), af: new Date(2026, 11, 15, 23, 59, 59), consumo: "16 oct–15 nov", presenta: "16 nov–15 dic" },
];
const DU007_CATS = ["N1", "N2", "N3"]; // el 007 solo cubre N1, N2 y N3
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV", "DIC"];

const descuenta = (ms) => {
  if (ms < 0) ms = 0;
  const p = (x) => String(x).padStart(2, "0");
  return { d: Math.floor(ms / 864e5), h: p(Math.floor(ms / 36e5) % 24), m: p(Math.floor(ms / 6e4) % 60), s: p(Math.floor(ms / 1e3) % 60) };
};

const PASOS_CARGA = [
  { p: 22, t: "Conectando con SUNAT…", d: "Verificando RUC activo y habido" },
  { p: 48, t: "Consultando el MTC…", d: "Buscando tus autorizaciones y placas" },
  { p: 74, t: "Verificando en la plataforma ATU…", d: "Revisando el TUC de cada unidad" },
  { p: 92, t: "Calculando tu potencial…", d: "Aplicando los topes por categoría" },
];

/* ── Piezas visuales ────────────────────────────────────────────────────── */
function Reloj({ target, label, fecha, soft }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const t = descuenta(target - now);
  return (
    <div className={`e0k-clock${soft ? " soft" : ""}`}>
      <div className="when">
        {soft ? <BarChart3 /> : <Clock3 />}
        <div>{fecha}<small>{label}</small></div>
      </div>
      <div className="units">
        {[["D", t.d], ["H", t.h], ["M", t.m], ["S", t.s]].map(([u, v]) => (
          <div className="unit" key={u}><b>{v}</b><span>{u}</span></div>
        ))}
      </div>
    </div>
  );
}

function Chk({ ok, pend, children }) {
  const cls = ok ? "pass" : pend ? "pend" : "fail";
  return (
    <div className={`e0k-chk ${cls}`}>
      {ok ? <CheckCircle2 /> : pend ? <Loader2 className="e0k-spin" /> : <AlertTriangle />}
      {children}
    </div>
  );
}

/**
 * MÓDULO 0 (Etapa 0): diagnóstico integrado de los DOS subsidios abiertos —
 * DU 004 (presentación única) y DU 007 (3 periodos, solo N1/N2/N3, mismo S/ por galón).
 */
export default function Etapa0Card({ onResumen, ruc: rucProp, solo }) {
  const { user } = useAuth();
  const ruc = rucProp || user?.ruc;   // rucProp: uso público en /subsidio (sin login)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paso, setPaso] = useState(0);
  const [pct, setPct] = useState(8);
  const [periodo, setPeriodo] = useState(0);
  const [verPlacas, setVerPlacas] = useState(false);
  const [verPlacas7, setVerPlacas7] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (!ruc) { setLoading(false); return; }
    let alive = true;
    api.get("/subsidio/resumen", { params: { ruc } })
      .then(({ data }) => { if (alive) { setData(data); if (onResumen) onResumen(data); } })
      .catch(() => {})
      .finally(() => { if (alive) { setPct(100); setLoading(false); } });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruc]);

  // Auto-reverificación: si alguna fuente quedó "POR_VERIFICAR" (SUNAT/MTC/ATU no respondió
  // en ese momento), se reintenta solo — hasta 2 veces, saltando el caché del backend.
  const [reintentos, setReintentos] = useState(0);
  useEffect(() => {
    if (!data || reintentos >= 2) return;
    const pendiente = (data.semaforo || []).some((c) => c.estado === "POR_VERIFICAR");
    if (!pendiente) return;
    const t = setTimeout(async () => {
      try {
        const { data: d2 } = await api.get("/subsidio/resumen", { params: { ruc, refresh: 1 } });
        setData(d2);
        if (onResumen) onResumen(d2);
      } catch {}
      setReintentos((n) => n + 1);
    }, 7000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reintentos]);

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => {
      setPaso((k) => {
        const next = Math.min(k + 1, PASOS_CARGA.length - 1);
        setPct(PASOS_CARGA[next].p);
        return next;
      });
    }, 1600);
    setPct(PASOS_CARGA[0].p);
    return () => clearInterval(iv);
  }, [loading]);

  if (!ruc) return null;
  if (loading) {
    const info = PASOS_CARGA[paso];
    return (
      <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", borderRadius: 18, padding: 30, color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, opacity: 0.1 }}><Coins style={{ width: 150, height: 150 }} /></div>
        <Loader2 style={{ width: 30, height: 30, animation: "spin 1s linear infinite", color: "#fff" }} />
        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 17 }}>{info.t}</div>
        <div style={{ marginTop: 3, fontSize: 13, color: "#DDD6FE" }}>{info.d}</div>
        <div style={{ maxWidth: 420, margin: "18px auto 0", background: "rgba(255,255,255,.18)", borderRadius: 999, height: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#fff", borderRadius: 999, transition: "width .7s ease" }} />
        </div>
        <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: "#EDE9FE" }}>{pct}%</div>
        <div style={{ marginTop: 14, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {PASOS_CARGA.map((x, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
              background: i <= paso ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.08)", color: i <= paso ? "#fff" : "#C4B5FD" }}>
              {i < paso ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : i === paso ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : null}
              {x.t.replace("…", "").replace("Conectando con ", "").replace("Consultando el ", "").replace("Verificando en la plataforma ", "").replace("Calculando tu ", "")}
            </span>
          ))}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }
  if (!data) return null;

  /* Sin unidades en el MTC: aviso claro + soporte (no ceros que parecen error). */
  const sinUnidades = (data.subsidio?.total_unidades || 0) === 0 && !((data.requisitos || []).some((r) => r.codigo === "permiso_mtc" && r.cumple));
  if (sinUnidades) {
    const wsp = encodeURIComponent(`Hola ENERED, soy ${user?.empresa || data?.razon_social || ""} (RUC ${ruc}). No aparecen mis unidades en el MTC y quiero que me ayuden a revisar mi caso para el subsidio.`);
    return (
      <div style={{ background: "#fff", border: "1px solid #FDE68A", borderLeft: "5px solid #F59E0B", borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle style={{ width: 26, height: 26, color: "#B45309", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: "#92400E" }}>No encontramos tus unidades en el MTC</div>
            <div style={{ fontSize: 13.5, color: "#78350F", marginTop: 5, lineHeight: 1.5 }}>
              Con el RUC <b>{ruc}</b> ({user?.empresa || data?.razon_social}) no aparecen autorizaciones de transporte en el registro que consultamos.
              Esto suele pasar cuando las unidades están a nombre de <b>otro RUC</b>, o cuando el servicio está en <b>otro tipo de registro</b> del MTC.
              No te preocupes: lo revisamos contigo directamente.
            </div>
            <a href={`https://wa.me/${WSP_NUMERO}?text=${wsp}`} target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, background: "#16A34A", color: "#fff", padding: "11px 18px", borderRadius: 10, fontSize: 14, fontWeight: 800, textDecoration: "none" }}>
              <MessageCircle style={{ width: 17, height: 17 }} /> Escríbenos y revisamos tu caso
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ── Cálculos con los datos reales del diagnóstico ─────────────────────── */
  const s = data.subsidio || {};
  const factor = s.factor || 4;
  const topePorCat = Object.fromEntries((s.por_categoria || []).map((c) => [c.categoria, c.tope]));
  const unidades = data.unidades || [];

  // DU 004: recuperables = categoría subsidiable (aceptadas ya, o regularizables)
  const aceptadas = unidades.filter((u) => u.cumple);
  const regularizables = unidades.filter((u) => !u.cumple && topePorCat[u.categoria]);
  const noAplican = unidades.filter((u) => !topePorCat[u.categoria]);
  const monto = (us) => us.reduce((a, u) => a + (topePorCat[u.categoria] || 0) * factor, 0);
  const montoAceptadas = monto(aceptadas);
  const montoRegularizables = monto(regularizables);
  const recuperables = aceptadas.length + regularizables.length;

  // DU 007: SOLO N1, N2 y N3 — mismos topes de galones y mismo S/ por galón, por periodo.
  const unidades007 = unidades.filter((u) => DU007_CATS.includes(u.categoria));
  // Desglose de placas del 007 (SOLO N1/N2/N3; el resto —M2, M3, O4…— no aplica a este decreto)
  const aceptadas007 = unidades007.filter((u) => u.cumple);
  const regularizables007 = unidades007.filter((u) => !u.cumple);
  const noAplican007 = unidades.filter((u) => !DU007_CATS.includes(u.categoria));
  const galones007 = unidades007.reduce((a, u) => a + (topePorCat[u.categoria] || 0), 0);
  const monto007 = galones007 * factor;
  const catsExcluidas007 = [...new Set(unidades.filter((u) => topePorCat[u.categoria] && !DU007_CATS.includes(u.categoria)).map((u) => u.categoria))];

  // Semáforo → chips. "POR_VERIFICAR" (la fuente no respondió) se muestra distinto de un fallo.
  const sem = Object.fromEntries((data.semaforo || []).map((c) => [c.codigo, c.estado]));
  const okRuc = sem.RUC_ACTIVO === "CUMPLE";
  const okAut = sem.AUTORIZACION_VIGENTE === "CUMPLE";
  const okHab = sem.VEHICULOS_HABILITADOS === "CUMPLE";
  const okTuc = sem.VEHICULOS_TUC === "CUMPLE";
  const pendRuc = sem.RUC_ACTIVO === "POR_VERIFICAR";
  const pendAut = sem.AUTORIZACION_VIGENTE === "POR_VERIFICAR";
  const pendHab = sem.VEHICULOS_HABILITADOS === "POR_VERIFICAR";
  const pendTuc = sem.VEHICULOS_TUC === "POR_VERIFICAR";

  // Reloj del periodo DU 007 seleccionado
  const p = DU007_PERIODOS[periodo];
  const ahora = new Date(now);
  let target7, label7, soft7 = true;
  if (ahora < p.ci) { target7 = p.ci; label7 = "inicia"; }
  else if (ahora <= p.cf) { target7 = p.cf; label7 = "consumo"; }
  else if (ahora < p.ai) { target7 = p.ai; label7 = "abre"; }
  else { target7 = p.af; label7 = "cierre"; soft7 = false; }
  const fecha7 = `${target7.getDate()} ${MESES[target7.getMonth()]}`;

  const avance = (ini, fin) => ahora <= ini ? 0 : ahora >= fin ? 100 : ((ahora - ini) / (fin - ini)) * 100;

  const empresa = user?.empresa || data?.razon_social || "";
  const wsp004 = encodeURIComponent(`Hola ENERED, soy ${empresa} (RUC ${ruc}). Quiero recuperar mis ${fmtSoles(s.total_monto)} del subsidio DU 004 antes del cierre del 28 de setiembre.`);
  const wsp007 = encodeURIComponent(`Hola ENERED, soy ${empresa} (RUC ${ruc}). Quiero blindar mis facturas del subsidio DU 007 desde el periodo 1 (consumo ya está corriendo).`);

  return (
    <div className={solo === "du007" ? "e0k e0k-uno" : "e0k"}>
      {/* ══════════ DU 004 ══════════ */}
      {solo !== "du007" && (
      <article className="e0k-deck">
        <div className="e0k-eyebrow">D.U. 004-2026 <span className="tag one">PRESENTACIÓN ÚNICA</span></div>

        <div className="e0k-amount a4">
          {/* Encabezado: a quién pertenece el diagnóstico */}
          <div className="amt-emp"><span className="emp">{empresa}</span><b className="rucv">RUC {ruc}</b></div>
          <div className="amt-row">
            <div className="amt-l">
              <div className="lbl">Máximo que puedes reclamar</div>
              <div className="big">{fmtSoles(s.total_monto)}</div>
              <div className="sub">{fmtNum(s.total_galones)} galones · {s.unidades_con_subsidio} unidad{s.unidades_con_subsidio === 1 ? "" : "es"} subsidiable{s.unidades_con_subsidio === 1 ? "" : "s"} de {s.total_unidades}</div>
            </div>
            <Reloj target={DU004_FIN} label="cierre" fecha="28 SET" />
          </div>
          <div className="amt-foot">Un solo intento en el año — cierra <b>28 SET 2026</b></div>
        </div>

        <div className="e0k-box">
          <div className="bh"><h4>Un solo intento en todo el año</h4><em>sin segunda oportunidad</em></div>
          <div className="track"><div className="seg"><i style={{ width: `${avance(DU004_INI, DU004_FIN)}%` }} /></div></div>
          <div className="marks">
            <div><b>Ventana abierta</b>hasta el 28 set</div>
            <div style={{ textAlign: "right" }}><b>Cierre definitivo</b>28 set 2026</div>
          </div>
        </div>

        <div className="e0k-box">
          <div className="bh"><h4>De tus {unidades.length} placa{unidades.length === 1 ? "" : "s"}, <b className="g">{recuperables} {recuperables === 1 ? "es recuperable" : "son recuperables"}</b></h4></div>
          <div className="bars">
            {aceptadas.length > 0 && <i style={{ flex: aceptadas.length, background: "#0EA46B" }} />}
            {regularizables.length > 0 && <i style={{ flex: regularizables.length, background: "#D97706" }} />}
            {noAplican.length > 0 && <i style={{ flex: noAplican.length, background: "#D9D5E8" }} />}
          </div>
          <div className="legend">
            {aceptadas.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#0EA46B" }} />
                <div><span className="k">{aceptadas.length} aceptada{aceptadas.length === 1 ? "" : "s"} por la ATU</span>
                  <span className="d">{aceptadas.slice(0, 3).map((u) => u.placa).join(" · ")}{aceptadas.length > 3 ? "…" : ""} · TUC reconocido</span></div>
                <span className="v ok">{fmtSoles(montoAceptadas)}</span></div>
            )}
            {regularizables.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#D97706" }} />
                <div><span className="k">{regularizables.length} regularizable{regularizables.length === 1 ? "" : "s"}</span>
                  <span className="d">{regularizables.slice(0, 3).map((u) => `${u.placa} · ${u.categoria}`).join("  ·  ")}{regularizables.length > 3 ? "…" : ""} — {regularizables[0]?.motivo || "se puede corregir"}</span></div>
                <span className="v warn">{fmtSoles(montoRegularizables)}</span></div>
            )}
            {noAplican.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#D9D5E8" }} />
                <div><span className="k">{noAplican.length} no aplica{noAplican.length === 1 ? "" : "n"}</span>
                  <span className="d">Categoría {[...new Set(noAplican.map((u) => u.categoria || "sin categoría"))].join(", ")} · el decreto solo cubre M2, M3, N1, N2 y N3</span></div>
                <span className="v mute">S/ 0.00</span></div>
            )}
          </div>
          <button className="e0k-toggle" onClick={() => setVerPlacas(!verPlacas)}>
            {verPlacas ? <ChevronUp /> : <ChevronDown />} {verPlacas ? "Ocultar" : "Ver"} detalle por placa
          </button>
          {verPlacas && (
            <div className="e0k-tabla">
              <table>
                <thead><tr>{["Placa", "Cat.", "TUC", "¿Acepta?", "Motivo", "Vigencia MTC"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {unidades.map((u, i) => (
                    <tr key={i}>
                      <td className="pl">{u.placa}</td>
                      <td>{u.categoria || "—"}</td>
                      <td>{u.tuc || "—"}</td>
                      <td>{u.cumple ? <span className="st ok"><CheckCircle2 /> Aceptada</span>
                        : u.estado === "por_verificar" ? <span className="st wa"><AlertTriangle /> Por verificar</span>
                        : <span className="st no"><XCircle /> No aceptada</span>}</td>
                      <td className="mo">{u.cumple ? "—" : u.motivo}</td>
                      <td>{u.vigencia || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="e0k-checks">
          <Chk ok={okRuc} pend={pendRuc}>{pendRuc ? "RUC · verificando en SUNAT…" : okRuc ? "RUC activo y habido" : "RUC con observación en SUNAT"}</Chk>
          <Chk ok={okAut} pend={pendAut}>{pendAut ? "Autorización MTC · verificando…" : okAut ? "Autorización MTC vigente" : "Autorización MTC por revisar"}</Chk>
          <Chk ok={okHab} pend={pendHab}>{pendHab ? "Habilitación · verificando…" : okHab ? "Habilitación vehicular" : "Habilitación por revisar"}</Chk>
          <Chk ok={okTuc} pend={pendTuc}>{pendTuc ? "TUC · verificando en la ATU…" : okTuc ? "TUC habilitado en la ATU" : "TUC por regularizar"}</Chk>
        </div>

        <a className="e0k-cta" href={`https://wa.me/${WSP_NUMERO}?text=${wsp004}`} target="_blank" rel="noreferrer">
          Recuperar mis {fmtSoles(s.total_monto)} del DU 004
        </a>
      </article>
      )}

      {/* ══════════ DU 007 ══════════ */}
      <article className="e0k-deck">
        <div className="e0k-eyebrow">D.U. 007-2026 <span className="tag three">3 PERIODOS · 3 SOLICITUDES</span></div>

        <div className="e0k-amount a7">
          <div className="amt-emp"><span className="emp">{empresa}</span><b className="rucv">RUC {ruc}</b></div>
          <div className="amt-row">
            <div className="amt-l">
              <div className="lbl">Máximo por periodo</div>
              <div className="big">{fmtSoles(monto007)}</div>
              <div className="sub">
                {monto007 > 0
                  ? <>{fmtNum(galones007)} galones · {unidades007.length} unidad{unidades007.length === 1 ? "" : "es"} subsidiable{unidades007.length === 1 ? "" : "s"} de {unidades.length}</>
                  : <>El DU 007 solo cubre N1, N2 y N3{catsExcluidas007.length ? ` — tus ${catsExcluidas007.join("/")} no aplican` : ""}</>}
              </div>
            </div>
            <Reloj target={target7} label={label7} fecha={fecha7} soft={soft7} />
          </div>
          {monto007 > 0 ? (
            <div className="amt-foot">Si presentas los 3 periodos <b>{fmtSoles(monto007 * 3)}</b></div>
          ) : (
            <div className="amt-foot">Consumo del periodo 1 <b>ya corriendo</b></div>
          )}
        </div>

        <div className="e0k-box">
          <div className="bh"><h4>Cada periodo se solicita por separado</h4><em>avance del periodo {periodo + 1}</em></div>
          <div className="track">
            {DU007_PERIODOS.map((q) => (
              <div className="seg" key={q.n}><i style={{ width: `${avance(q.ci, q.cf)}%` }} /></div>
            ))}
          </div>
          <div className="periods">
            {DU007_PERIODOS.map((q, i) => (
              <button key={q.n} className="pbtn" aria-pressed={periodo === i} onClick={() => setPeriodo(i)}>
                <b>Periodo {q.n}</b>consumo {q.consumo}<br />presentas {q.presenta}
              </button>
            ))}
          </div>
        </div>

        {/* Placas que entran al DU 007 — SOLO N1, N2 y N3 */}
        <div className="e0k-box">
          <div className="bh"><h4>De tus {unidades.length} placa{unidades.length === 1 ? "" : "s"}, <b className="g">{unidades007.length} entra{unidades007.length === 1 ? "" : "n"} al DU 007</b></h4>
            <em>solo N1, N2 y N3</em></div>
          <div className="bars">
            {aceptadas007.length > 0 && <i style={{ flex: aceptadas007.length, background: "#0EA46B" }} />}
            {regularizables007.length > 0 && <i style={{ flex: regularizables007.length, background: "#D97706" }} />}
            {noAplican007.length > 0 && <i style={{ flex: noAplican007.length, background: "#D9D5E8" }} />}
          </div>
          <div className="legend">
            {aceptadas007.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#0EA46B" }} />
                <div><span className="k">{aceptadas007.length} con TUC aceptado</span>
                  <span className="d">{aceptadas007.slice(0, 3).map((u) => u.placa).join(" · ")}{aceptadas007.length > 3 ? "…" : ""}</span></div>
                <span className="v ok">{fmtSoles(monto(aceptadas007))}</span></div>
            )}
            {regularizables007.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#D97706" }} />
                <div><span className="k">{regularizables007.length} regularizable{regularizables007.length === 1 ? "" : "s"}</span>
                  <span className="d">{regularizables007.slice(0, 3).map((u) => `${u.placa} · ${u.categoria}`).join("  ·  ")}{regularizables007.length > 3 ? "…" : ""} — {regularizables007[0]?.motivo || "se puede corregir"}</span></div>
                <span className="v warn">{fmtSoles(monto(regularizables007))}</span></div>
            )}
            {noAplican007.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#D9D5E8" }} />
                <div><span className="k">{noAplican007.length} no aplica{noAplican007.length === 1 ? "" : "n"} al 007</span>
                  <span className="d">Categoría {[...new Set(noAplican007.map((u) => u.categoria || "sin categoría"))].join(", ")} · el DU 007 solo cubre N1, N2 y N3</span></div>
                <span className="v mute">S/ 0.00</span></div>
            )}
          </div>
          <button className="e0k-toggle" onClick={() => setVerPlacas7(!verPlacas7)}>
            {verPlacas7 ? <ChevronUp /> : <ChevronDown />} {verPlacas7 ? "Ocultar" : "Ver"} detalle por placa
          </button>
          {verPlacas7 && (
            <div className="e0k-tabla">
              <table>
                <thead><tr>{["Placa", "Cat.", "TUC", "¿Acepta?", "Motivo", "Vigencia MTC"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {unidades007.map((u, i) => (
                    <tr key={i}>
                      <td className="pl">{u.placa}</td>
                      <td>{u.categoria || "—"}</td>
                      <td>{u.tuc || "—"}</td>
                      <td>{u.cumple ? <span className="st ok"><CheckCircle2 /> Aceptada</span>
                        : u.estado === "por_verificar" ? <span className="st wa"><AlertTriangle /> Por verificar</span>
                        : <span className="st no"><XCircle /> No aceptada</span>}</td>
                      <td className="mo">{u.cumple ? "—" : u.motivo}</td>
                      <td>{u.vigencia || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="e0k-box">
          <div className="bh"><h4>Lo que decides <b className="vi">hoy</b> define lo que cobras en octubre</h4></div>
          <div className="legend">
            <div className="li"><span className="dot" style={{ background: "#E11D48" }} />
              <div><span className="k">Tus facturas ya están corriendo</span>
                <span className="d">Sin placa o sin decir “diésel B5 / B20”, la ATU no las cuenta — y no se corrige después</span></div>
              <span className="v warn">Urgente</span></div>
            <div className="li"><span className="dot" style={{ background: "#0EA46B" }} />
              <div><span className="k">Tu grifo debe tener registro OSINERGMIN</span>
                <span className="d">La ATU publica cada quincena los proveedores excluidos</span></div>
              <span className="v ok">Verificable</span></div>
            {regularizables.length > 0 && (
              <div className="li"><span className="dot" style={{ background: "#7C3AED" }} />
                <div><span className="k">Mismo TUC observado del DU 004</span>
                  <span className="d">Regularizarlo ahora te habilita en los 3 periodos, no en uno</span></div>
                <span className="v vi">×3</span></div>
            )}
          </div>
        </div>

        <div className="e0k-checks">
          <Chk ok={okRuc} pend={pendRuc}>{pendRuc ? "RUC · verificando en SUNAT…" : okRuc ? "RUC activo y habido" : "RUC con observación en SUNAT"}</Chk>
          <Chk ok={okAut} pend={pendAut}>{pendAut ? "Autorización MTC · verificando…" : okAut ? "Autorización MTC vigente" : "Autorización MTC por revisar"}</Chk>
          <Chk ok={false}>Facturas por blindar</Chk>
          <Chk ok={okTuc} pend={pendTuc}>{pendTuc ? "TUC · verificando en la ATU…" : okTuc ? "TUC habilitado en la ATU" : "TUC por regularizar"}</Chk>
        </div>

        <a className="e0k-cta ghost" href={`https://wa.me/${WSP_NUMERO}?text=${wsp007}`} target="_blank" rel="noreferrer">
          Blindar mis facturas del DU 007
        </a>
      </article>

      <p className="e0k-legal">Cálculo referencial según los topes por categoría de cada decreto. El monto final lo determina la ATU.</p>

      <style>{`
.e0k{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;
  --vi6:#6D28D9;--vi5:#7C3AED;--vi1:#EDE9FE;--vi05:#F6F4FF;
  --ink:#15102E;--ink2:#4B4666;--ink3:#8B87A3;--line:#E7E4F2;
  --ok:#0EA46B;--okbg:#E8F8F1;--warn:#D97706;--warnbg:#FEF6E7;--stop:#E11D48;--stopbg:#FEECF0;--cyan:#12C7E0}
.e0k *{box-sizing:border-box}
.e0k-legal{grid-column:1/-1;font-size:11px;color:var(--ink3);text-align:center;margin:0}

.e0k-deck{background:#fff;border-radius:18px;box-shadow:0 1px 2px rgba(21,16,46,.04),0 12px 32px -20px rgba(21,16,46,.28);
  padding:20px 22px;display:flex;flex-direction:column;gap:14px;min-height:100%}
.e0k-eyebrow{display:flex;align-items:center;gap:10px;font-family:"Cabinet Grotesk",system-ui,sans-serif;
  font-size:13px;letter-spacing:.1em;color:var(--ink3);font-weight:700}
.e0k-eyebrow .tag{padding:4px 10px;border-radius:7px;font-size:10px;letter-spacing:.07em;font-weight:800;font-family:"Manrope",system-ui,sans-serif}
.tag.one{background:var(--stopbg);color:var(--stop)}
.tag.three{background:var(--vi1);color:var(--vi6)}

.e0k-amount{border-radius:15px;padding:18px 20px;color:#fff;position:relative;overflow:hidden}
.e0k-amount.a4{background:linear-gradient(120deg,#5B21B6,var(--vi5) 58%,#8B5CF6)}
.e0k-amount.a7{background:linear-gradient(120deg,#2E1065,var(--vi6) 58%,#9333EA)}
.e0k-amount::after{content:"";position:absolute;right:-50px;top:-60px;width:220px;height:220px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.15),transparent 68%)}
.e0k-amount .amt-row{display:flex;align-items:center;gap:18px;position:relative;z-index:1;flex-wrap:wrap}
.e0k-amount .amt-l{min-width:0;flex:1}
.e0k-amount .lbl{font-size:11.5px;opacity:.85;font-weight:500}
.e0k-amount .big{font-family:"Cabinet Grotesk",system-ui,sans-serif;font-size:38px;font-weight:800;line-height:1.04;margin:2px 0 4px;
  font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.e0k-amount .sub{font-size:11.5px;opacity:.85}
.e0k-amount .amt-emp{display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin-bottom:12px;padding-bottom:11px;border-bottom:1px solid rgba(255,255,255,.22);
  position:relative;z-index:1}
.e0k-amount .amt-emp .emp{font-family:"Cabinet Grotesk",system-ui,sans-serif;font-size:13px;font-weight:800;
  letter-spacing:.02em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.e0k-amount .amt-emp .rucv{font-size:11.5px;font-weight:700;opacity:.9;white-space:nowrap;
  font-variant-numeric:tabular-nums;letter-spacing:.05em}
.e0k-amount .amt-foot{margin-top:13px;padding-top:12px;border-top:1px solid rgba(255,255,255,.22);
  display:flex;align-items:baseline;gap:9px;font-size:12px;position:relative;z-index:1;min-height:42px}
.e0k-amount .amt-foot b{font-family:"Cabinet Grotesk",system-ui,sans-serif;font-size:19px;font-weight:800}

.e0k-clock{display:flex;align-items:center;gap:12px;flex:none;padding:11px 15px;border-radius:12px;
  background:var(--stop);color:#fff;box-shadow:0 10px 24px -12px rgba(225,29,72,.9)}
.e0k-clock.soft{background:#EA8104;box-shadow:0 10px 24px -12px rgba(217,119,6,.9)}
.e0k-clock .when{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;white-space:nowrap;
  padding-right:12px;border-right:1px solid rgba(255,255,255,.3)}
.e0k-clock .when svg{width:14px;height:14px}
.e0k-clock .when small{display:block;font-size:9px;font-weight:500;opacity:.85;letter-spacing:.03em}
.e0k-clock .units{display:flex;gap:9px}
.e0k-clock .unit{text-align:center;min-width:26px}
.e0k-clock .unit b{display:block;font-size:19px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.e0k-clock .unit span{font-size:8px;letter-spacing:.11em;opacity:.8;text-transform:uppercase}

.e0k-box{border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.e0k-box .bh{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px}
.e0k-box .bh h4{font-size:13px;font-weight:700;color:var(--ink);margin:0}
.e0k-box .bh h4 .g{color:var(--ok)}
.e0k-box .bh h4 .vi{color:var(--vi6)}
.e0k-box .bh em{font-style:normal;font-size:11px;color:var(--ink3);white-space:nowrap}

.e0k-box .track{display:flex;gap:4px}
.e0k-box .seg{flex:1;height:6px;border-radius:99px;background:var(--vi1);overflow:hidden}
.e0k-box .seg i{display:block;height:100%;background:linear-gradient(90deg,var(--vi5),var(--cyan));border-radius:99px;transition:width .9s cubic-bezier(.2,.8,.2,1)}
.e0k-box .marks{display:flex;margin-top:9px;font-size:10px;color:var(--ink3);line-height:1.35}
.e0k-box .marks div{flex:1}
.e0k-box .marks b{display:block;color:var(--ink2);font-size:11px;font-weight:600}

.e0k-box .periods{display:flex;gap:7px;margin-top:12px}
.e0k-box .pbtn{flex:1;border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px 6px;font-size:10.5px;
  color:var(--ink3);cursor:pointer;transition:.15s;line-height:1.4;text-align:center;font-family:inherit}
.e0k-box .pbtn b{display:block;font-size:12px;color:var(--ink);font-weight:700;margin-bottom:2px}
.e0k-box .pbtn[aria-pressed="true"]{border-color:var(--vi5);background:var(--vi05);box-shadow:0 0 0 2px rgba(124,58,237,.1)}

.e0k-box .bars{display:flex;height:9px;border-radius:99px;overflow:hidden;gap:2px;margin-bottom:13px}
.e0k-box .bars i{display:block}
.e0k-box .legend{display:grid;gap:11px}
.e0k-box .li{display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.4}
.e0k-box .dot{width:9px;height:9px;border-radius:3px;margin-top:4px;flex:none}
.e0k-box .li .k{font-weight:700;color:var(--ink);font-size:12.5px;display:block}
.e0k-box .li .d{color:var(--ink3);font-size:11px}
.e0k-box .li .v{margin-left:auto;text-align:right;font-weight:800;font-size:13px;white-space:nowrap;padding-left:10px;
  font-variant-numeric:tabular-nums}
.e0k .v.ok{color:var(--ok)} .e0k .v.warn{color:var(--warn)} .e0k .v.mute{color:var(--ink3)} .e0k .v.vi{color:var(--vi6)}

.e0k-toggle{margin-top:12px;display:inline-flex;align-items:center;gap:5px;border:0;background:none;cursor:pointer;
  font-size:11.5px;font-weight:700;color:var(--vi6);padding:0;font-family:inherit}
.e0k-toggle svg{width:14px;height:14px}
.e0k-tabla{margin-top:10px;overflow:auto;max-height:300px;border:1px solid var(--line);border-radius:10px}
.e0k-tabla table{width:100%;border-collapse:collapse;font-size:12px}
.e0k-tabla th{position:sticky;top:0;background:#F8FAFC;padding:8px 10px;text-align:left;font-weight:700;color:#475569;
  border-bottom:1px solid #E5E7EB;white-space:nowrap}
.e0k-tabla td{padding:8px 10px;border-bottom:1px solid #F3F4F6;color:#374151}
.e0k-tabla td.pl{font-weight:800;color:#1D4ED8;letter-spacing:.03em;white-space:nowrap}
.e0k-tabla td.mo{font-size:11px;color:#B45309;min-width:150px}
.e0k-tabla .st{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;white-space:nowrap}
.e0k-tabla .st svg{width:12px;height:12px}
.e0k-tabla .st.ok{background:#ECFDF5;color:#065F46}
.e0k-tabla .st.wa{background:#FEFCE8;color:#92400E}
.e0k-tabla .st.no{background:#FEF2F2;color:#991B1B}

.e0k-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.e0k-chk{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;font-size:11.5px;font-weight:600;line-height:1.3}
.e0k-chk svg{width:14px;height:14px;flex:none}
.e0k-chk.pass{background:var(--okbg);color:#0A7A50}
.e0k-chk.fail{background:var(--warnbg);color:#9A5B04}
.e0k-chk.pend{background:#F1F0F7;color:var(--ink3)}
.e0k-spin{animation:e0kspin 1s linear infinite}
@keyframes e0kspin{to{transform:rotate(360deg)}}

.e0k-cta{width:100%;padding:14px;border-radius:12px;border:0;cursor:pointer;font-size:14px;font-weight:700;color:#fff;
  text-align:center;text-decoration:none;background:linear-gradient(120deg,var(--vi6),var(--vi5));
  transition:transform .12s,box-shadow .12s;margin-top:auto;display:block}
.e0k-cta:hover{transform:translateY(-1px);box-shadow:0 12px 24px -12px rgba(109,40,217,.7)}
.e0k-cta.ghost{background:#fff;color:var(--vi6);border:1.5px solid #C4B5FD}
.e0k-cta.ghost:hover{background:var(--vi05);box-shadow:0 12px 24px -14px rgba(109,40,217,.4)}

.e0k-uno{grid-template-columns:1fr;max-width:880px;margin:0 auto}
@media (max-width:1180px){.e0k{grid-template-columns:1fr}}
@media (max-width:520px){
  .e0k-amount .big{font-size:30px}
  .e0k-clock{width:100%;justify-content:center}
  .e0k-checks{grid-template-columns:1fr}
  .e0k-box .periods{flex-direction:column}
}
@media (prefers-reduced-motion:reduce){.e0k *{transition:none!important;animation:none!important}}
      `}</style>
    </div>
  );
}
