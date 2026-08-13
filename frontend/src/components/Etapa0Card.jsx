import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Coins, CheckCircle2, XCircle, AlertTriangle, Loader2, Truck, ShieldCheck, ShieldAlert, MessageCircle,
} from "lucide-react";

const fmtSoles = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n) => (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// TODO: reemplazar por el número real de ENERED
const WSP_NUMERO = "51997389536";

/**
 * MÓDULO 0 (Etapa 0) dentro de Mi Flota: potencial del subsidio, requisitos, unidades y
 * semáforo. Para pasar a la Etapa 1 (cargar datos), el transportista escribe por WhatsApp.
 */
const PASOS_CARGA = [
  { p: 22, t: "Conectando con SUNAT…", d: "Verificando RUC activo y habido" },
  { p: 48, t: "Consultando el MTC…", d: "Buscando tus autorizaciones y placas" },
  { p: 74, t: "Verificando en la plataforma ATU…", d: "Revisando el TUC de cada unidad" },
  { p: 92, t: "Calculando tu potencial…", d: "Aplicando los topes por categoría" },
];

export default function Etapa0Card() {
  const { user } = useAuth();
  const ruc = user?.ruc;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paso, setPaso] = useState(0);
  const [pct, setPct] = useState(8);

  useEffect(() => {
    if (!ruc) { setLoading(false); return; }
    let alive = true;
    api.get("/subsidio/resumen", { params: { ruc } })
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => {})
      .finally(() => { if (alive) { setPct(100); setLoading(false); } });
    return () => { alive = false; };
  }, [ruc]);

  // Avance de la barra por etapas mientras carga (percepción de progreso durante el scrape).
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

  // Sin unidades en el MTC: no mostramos ceros que parecen error, sino un aviso claro + soporte.
  const sinUnidades = (data.subsidio?.total_unidades || 0) === 0 && !((data.requisitos || []).some((r) => r.codigo === "permiso_mtc" && r.cumple));
  if (sinUnidades) {
    const wsp = encodeURIComponent(`Hola ENERED, soy ${user?.empresa || ""} (RUC ${ruc}). No aparecen mis unidades en el MTC y quiero que me ayuden a revisar mi caso para el subsidio.`);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #FDE68A", borderLeft: "5px solid #F59E0B", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AlertTriangle style={{ width: 26, height: 26, color: "#B45309", flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: "#92400E" }}>No encontramos tus unidades en el MTC</div>
              <div style={{ fontSize: 13.5, color: "#78350F", marginTop: 5, lineHeight: 1.5 }}>
                Con el RUC <b>{ruc}</b> ({user?.empresa}) no aparecen autorizaciones de transporte en el registro que consultamos.
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
      </div>
    );
  }

  const s = data.subsidio || {};
  const cumplen = (data.unidades || []).filter((u) => u.cumple).length;
  // "Resultados según la ATU": usa el semáforo real de la ATU; si no está disponible,
  // cae a nuestro análisis (MTC + SUNAT + TUC) con el mismo formato.
  const condiciones = (data.semaforo && data.semaforo.length)
    ? data.semaforo.map((c) => ({ nombre: c.nombre, estado: (c.estado || "").toUpperCase().replace(" ", "_"), descripcion: c.descripcion }))
    : (data.requisitos || []).map((r) => ({
        nombre: r.nombre,
        estado: r.cumple === true ? "CUMPLE" : r.cumple === false ? "NO_CUMPLE" : "POR_VERIFICAR",
        descripcion: r.detalle,
      }));
  const wspMsg = encodeURIComponent(
    data.inscrito
      ? `Hola ENERED, soy ${user?.empresa || ""} (RUC ${ruc}). Ya estoy inscrito en la ATU y quiero armar mi expediente para reclamar mi subsidio (hasta ${fmtSoles(s.total_monto)}).`
      : `Hola ENERED, soy ${user?.empresa || ""} (RUC ${ruc}). Aún NO estoy inscrito en la ATU y quiero registrarme y armar mi expediente para reclamar mi subsidio (hasta ${fmtSoles(s.total_monto)}).`
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Potencial */}
      <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", borderRadius: 18, padding: 24, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, opacity: 0.1 }}><Coins style={{ width: 150, height: 150 }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 22, alignItems: "start", position: "relative" }}>
          {/* Izquierda: monto y categorías */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.18)", padding: "3px 11px", borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: ".05em" }}>MÓDULO 0 · TU POTENCIAL</div>
            <div style={{ fontSize: 13.5, color: "#DDD6FE", marginTop: 12 }}>Máximo del subsidio que puedes reclamar</div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, marginTop: 2 }}>{fmtSoles(s.total_monto)}</div>
            <div style={{ fontSize: 13, color: "#DDD6FE", marginTop: 5 }}>Hasta <b style={{ color: "#fff" }}>{fmtNum(s.total_galones)} galones</b> · {s.unidades_con_subsidio} de {s.total_unidades} unidades</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {(s.por_categoria || []).map((c) => (
                <div key={c.categoria} style={{ background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "8px 13px" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#E9D5FF" }}>{c.unidades} × {c.categoria}</div>
                  <div style={{ fontSize: 15.5, fontWeight: 800 }}>{fmtSoles(c.monto)}</div>
                </div>
              ))}
            </div>
            {(s.categorias_no_aplican || []).length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#E9D5FF", background: "rgba(0,0,0,.14)", borderRadius: 10, padding: "9px 12px" }}>
                No entran al subsidio:{" "}
                <b style={{ color: "#fff" }}>
                  {s.categorias_no_aplican.map((c) => `${c.unidades} × ${c.categoria}`).join(" · ")}
                </b>
                . Solo aplican M2, M3, N1, N2 y N3.
              </div>
            )}
          </div>

          {/* Derecha: requisitos de valor para que la factura sea aceptada */}
          <div style={{ background: "rgba(255,255,255,.10)", borderRadius: 14, padding: "15px 17px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 9 }}>Para que tu consumo sea reconocido</div>
            {[
              "Facturas emitidas correctamente, con la placa en la descripción.",
              "El grifo debe estar habilitado ante OSINERGMIN.",
              "Necesitas una factura por cada consumo de combustible.",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: "#C4B5FD", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "#EDE9FE", lineHeight: 1.4 }}>{t}</span>
              </div>
            ))}
            <a href={`https://wa.me/${WSP_NUMERO}?text=${wspMsg}`} target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: "#fff", color: "#5B21B6", padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
              <MessageCircle style={{ width: 15, height: 15 }} /> Escríbenos para darte soporte
            </a>
          </div>
        </div>
      </div>

      {/* Mitad y mitad: placas (izq) + semáforo de requisitos (der) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        {/* IZQUIERDA: lista de placas */}
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #EEE", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: data.inscrito ? "#ECFDF5" : "#FFFBEB", color: data.inscrito ? "#065F46" : "#92400E" }}>
              {data.inscrito ? <ShieldCheck style={{ width: 12, height: 12 }} /> : <AlertTriangle style={{ width: 12, height: 12 }} />} {data.inscrito ? "INSCRITO EN LA ATU" : "NO INSCRITO EN LA ATU"}
            </span>
            <div style={{ fontWeight: 800, color: "#111827", fontSize: 15, marginTop: 5 }}>
              {data.atu_disponible
                ? <>La ATU acepta <span style={{ color: "#059669" }}>{cumplen}</span> de {data.unidades.length} placas</>
                : <>{data.unidades.length} placas en tu flota · <span style={{ color: "#B45309" }}>validación ATU pendiente</span></>}
            </div>
          </div>
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0, maxHeight: 470 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>{["Placa", "Cat.", "TUC", "¿Acepta?", "Motivo", "Vigencia MTC"].map((h) => (
                  <th key={h} style={{ position: "sticky", top: 0, background: "#F8FAFC", padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.unidades.map((u, i) => {
                  const pend = u.estado === "por_verificar";
                  const rowBg = u.cumple ? "#fff" : pend ? "#FFFDF5" : "#FFF7F5";
                  return (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: rowBg }}>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: "#1D4ED8", letterSpacing: ".03em", whiteSpace: "nowrap" }}>{u.placa}</td>
                    <td style={{ padding: "9px 12px", color: "#374151" }}>{u.categoria || "—"}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: u.tuc ? "#111827" : "#9CA3AF", whiteSpace: "nowrap" }}>{u.tuc || "—"}</td>
                    <td style={{ padding: "9px 12px" }}>
                      {u.cumple
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ECFDF5", color: "#065F46", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap" }}><CheckCircle2 style={{ width: 12, height: 12 }} /> Aceptada</span>
                        : pend
                          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FEFCE8", color: "#92400E", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap" }}><AlertTriangle style={{ width: 12, height: 12 }} /> Por verificar</span>
                          : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FEF2F2", color: "#991B1B", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap" }}><XCircle style={{ width: 12, height: 12 }} /> No aceptada</span>}
                    </td>
                    <td style={{ padding: "9px 12px", color: u.cumple ? "#9CA3AF" : pend ? "#92400E" : "#B45309", fontSize: 11.5, minWidth: 160 }}>{u.cumple ? "—" : u.motivo}</td>
                    <td style={{ padding: "9px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>{u.vigencia || "—"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DERECHA: Resultados según la ATU + CTA (bloques separados) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #EEE" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", fontWeight: 800, color: "#6b7280", fontSize: 12.5, letterSpacing: ".05em", textTransform: "uppercase" }}>
            Resultados según la ATU
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {condiciones.map((c, i) => {
              const ok = c.estado === "CUMPLE";
              const noc = c.estado === "NO_CUMPLE";
              const parcial = c.estado === "PARCIAL";
              const col = ok ? "#16A34A" : noc ? "#DC2626" : "#EAB308";
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 15px", borderRadius: 12, background: "#fff", border: "1px solid #F0F0F2", borderLeft: `5px solid ${col}`, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 999, background: col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    {ok ? <CheckCircle2 style={{ width: 16, height: 16, color: "#fff" }} /> : noc ? <XCircle style={{ width: 16, height: 16, color: "#fff" }} /> : <AlertTriangle style={{ width: 15, height: 15, color: "#fff" }} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, color: "#111827", fontSize: 14 }}>{c.nombre}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: col, whiteSpace: "nowrap" }}>{ok ? "CUMPLE" : noc ? "NO CUMPLE" : parcial ? "PARCIAL" : "POR VERIFICAR"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{c.descripcion}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

            {/* CTA URGENTE: el expediente se presenta una sola vez ante la ATU (bloque aparte del semáforo) */}
            <a href={`https://wa.me/${WSP_NUMERO}?text=${wspMsg}`} target="_blank" rel="noreferrer"
              style={{ display: "block", textDecoration: "none", background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderLeft: "5px solid #DC2626", borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <ShieldAlert style={{ width: 22, height: 22, color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ display: "inline-block", background: "#DC2626", color: "#fff", fontSize: 10, fontWeight: 900, letterSpacing: ".06em", padding: "2px 8px", borderRadius: 6, marginBottom: 5 }}>⚠ UN SOLO INTENTO</div>
                  <div style={{ fontWeight: 900, color: "#991B1B", fontSize: 14.5 }}>El subsidio se solicita una sola vez al año</div>
                  <div style={{ fontSize: 12.5, color: "#7F1D1D", marginTop: 3, lineHeight: 1.5 }}>
                    Ante la ATU <b>no hay segunda oportunidad</b>: si el expediente va con un error, se rechaza y pierdes el subsidio de todo el año. Deja que nuestro equipo lo revise y lo arme <b>antes de presentarlo</b>.
                  </div>
                  <div style={{ marginTop: 9, display: "inline-flex", alignItems: "center", gap: 7, background: "#DC2626", color: "#fff", padding: "9px 16px", borderRadius: 9, fontSize: 13.5, fontWeight: 800 }}>
                    <MessageCircle style={{ width: 16, height: 16 }} /> Recuperar mis {fmtSoles(s.total_monto)}
                  </div>
                </div>
              </div>
            </a>
        </div>
      </div>
    </div>
  );
}
