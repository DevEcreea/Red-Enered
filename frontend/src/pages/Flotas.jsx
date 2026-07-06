import React, { useEffect, useRef, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";
import {
  Receipt, Fuel, Gauge, Coins, Droplet, MapPin, Camera,
  FileText, CreditCard, MoreHorizontal, ShieldCheck, Plus,
  ChevronDown, Download, Share2, Printer, Columns3, Upload,
  Filter, Calendar, User, Car, ArrowUpDown, Search, X,
  CheckCircle2, Trash2
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const HEADER_BG = "#241B4A";

const CTRL_TYPES = [
  "Tope mensual de galones por placa",
  "Restricción de estaciones",
  "Restricción de horario",
  "Restricción de producto",
  "Tope por carga (galones)",
];

const EV_EST = {
  "Pendiente de revisión":{ color:"#B45309", bg:"#FEF3C7" },
  "Coacheable":           { color:"#1D4ED8", bg:"#DBEAFE" },
  "Coacheado":            { color:"#059669", bg:"#ECFDF5" },
  "Descartado":           { color:"#64748B", bg:"#F1F5F9" },
};
const CT_EST = {
  "Pendiente": { color:"#B45309", bg:"#FEF3C7" },
  "Activa":    { color:"#059669", bg:"#ECFDF5" },
  "Rechazada": { color:"#DC2626", bg:"#FEF2F2" },
};

const MOCK_EVENTOS = [
  { tipo:"Ralentí improductivo",   cond:"Luis Galvez · L-2213", placa:"ABC123", info:"06/01/26 · Trujillo · Geocerca Planta",    est:"Pendiente de revisión" },
  { tipo:"Carga sin GPS",          cond:"Carlos Ríos · C-1180", placa:"BJO894", info:"06/01/26 · Lima · Primax 45",              est:"Pendiente de revisión" },
  { tipo:"Consumo anómalo",        cond:"Ana Rojas · A-0932",   placa:"V2P481", info:"05/01/26 · Arequipa · Repsol Sur",         est:"Coacheable" },
  { tipo:"Recarga duplicada",      cond:"Javier Q. · J-0455",   placa:"BRO700", info:"05/01/26 · Piura · Petroperú",            est:"Descartado" },
  { tipo:"Posible desvío de ruta", cond:"Luis Galvez · L-2213", placa:"BTP808", info:"04/01/26 · Chiclayo · Pecsa",             est:"Coacheado" },
  { tipo:"Ralentí improductivo",   cond:"Ana Rojas · A-0932",   placa:"C3K915", info:"04/01/26 · Trujillo · Geocerca Norte",    est:"Pendiente de revisión" },
];

const QR_LIST = [
  ["BBJ855","CARE PERU"],["BJO894","ROSANDINA SAC"],["BJO899","ROSANDINA S.A.C."],
  ["BRO700","EMPRESA DE TRANSPORTE…"],["BTP808","ROSANDINA SAC"],["V2P481","CARE PERU"],
  ["C3K915","ROSANDINA SAC"],["D9L307","ROSANDINA S.A.C."],["A4M650","EMPRESA DE TRANSPORTE…"],
  ["F1H228","ROSANDINA SAC"],["ABC123","CARE PERU"],["B7T022","ROSANDINA SAC"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Pill({ label, color, bg }) {
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:6,borderRadius:999,fontWeight:600,fontSize:12,padding:"4px 11px",color,background:bg,whiteSpace:"nowrap" }}>
      <span style={{ width:6,height:6,borderRadius:"50%",background:color,display:"inline-block" }}/>
      {label}
    </span>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed",top:82,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:8,background:"#059669",color:"#fff",fontWeight:600,fontSize:13.5,padding:"10px 18px",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.2)",zIndex:60,whiteSpace:"nowrap" }}>
      <CheckCircle2 style={{ width:17,height:17 }}/>{msg}
    </div>
  );
}

// Sparkline SVG
const AREA_PATH  = "M0,48 C28,42 46,26 78,33 C110,40 128,18 160,26 C182,31 194,42 200,38 L200,70 L0,70 Z";
const LINE_PATH  = "M0,48 C28,42 46,26 78,33 C110,40 128,18 160,26 C182,31 194,42 200,38";

// QR generator (deterministic from placa string)
function qrSvg(seed) {
  let h = 2166136261 >>> 0;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rng = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const N = 11, cell = 100 / N; let m = "";
  const fin = (x, y) => (x < 3 && y < 3) || (x >= N-3 && y < 3) || (x < 3 && y >= N-3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (fin(x, y)) continue;
    if (rng() > 0.5) m += `<rect x="${(x*cell).toFixed(1)}" y="${(y*cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}"/>`;
  }
  const F = (ox, oy) => { const u = cell; return `<rect x="${ox}" y="${oy}" width="${3*u}" height="${3*u}"/><rect x="${ox+u*0.55}" y="${oy+u*0.55}" width="${1.9*u}" height="${1.9*u}" fill="#fff"/><rect x="${ox+u}" y="${oy+u}" width="${u}" height="${u}" fill="#8B3DFF"/>`; };
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><g fill="#8B3DFF">${m}${F(0,0)}${F((N-3)*cell,0)}${F(0,(N-3)*cell)}</g></svg>`;
}

const BIG_CARDS_META = [
  { key:"gasto",       lab:"Gasto Total de Combustible",  ic:Receipt, col:"#8B3DFF" },
  { key:"galones",     lab:"Total de Galones Consumidos",  ic:Fuel,    col:"#10B981" },
  { key:"kmGal",       lab:"Promedio de KM/Galón",         ic:Gauge,   col:"#3B82F6" },
  { key:"costoGal",    lab:"Promedio de Costo/Galón",      ic:Coins,   col:"#334155" },
];

const thSt = { textAlign:"left",color:"#fff",fontWeight:600,fontSize:13,padding:"16px 14px",whiteSpace:"nowrap" };
const tdSt = { padding:"14px",fontSize:13.5,color:"#4b5563" };
const inputSt = { width:"100%",height:44,border:"1px solid #E5E7EB",borderRadius:10,padding:"0 14px",fontSize:14,color:"#111827",outline:"none",background:"#fff",boxSizing:"border-box" };
const selSt = { appearance:"none",backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239ca3af' stroke-width='2'><path d='M4 6l4 4 4-4'/></svg>")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center" };

// ─── Filter selector component ────────────────────────────────────────────────
function FSel({ label, icon:Icon, grow, children }) {
  return (
    <div style={{ position:"relative",height:42,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",display:"flex",alignItems:"center",padding:"0 34px 0 14px",fontSize:14,color:"#4b5563",minWidth:grow?undefined:120,flex:grow?"1":undefined,cursor:"pointer",userSelect:"none" }}>
      {Icon && <Icon style={{ width:15,height:15,color:"#9ca3af",marginRight:6 }}/>}
      {label}
      {children}
      <ChevronDown style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:16,height:16,color:"#9ca3af" }}/>
    </div>
  );
}

// ═════════════════════════════════ TABS ══════════════════════════════════════

function RowActions({ row, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={()=>setOpen(v=>!v)} data-testid={`row-actions-${row.id||row.PLACA}`}
        style={{ width:44,height:34,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280" }}>
        <MoreHorizontal style={{ width:15,height:15 }}/>
      </button>
      {open && (
        <div style={{ position:"absolute",right:0,top:"110%",background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:20,minWidth:170 }}>
          {(row.factura_key || row._origen==="manual") && (
            <a href={`${process.env.REACT_APP_BACKEND_URL||""}/api/consumptions/${row.id}/factura`} target="_blank" rel="noreferrer" onClick={()=>setOpen(false)}
              style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 12px",fontSize:13.5,color:"#374151",textDecoration:"none",borderBottom:"1px solid #F3F4F6" }}>
              <FileText style={{ width:14,height:14,color:"#8B3DFF" }}/> Ver factura
            </a>
          )}
          <button onClick={()=>{setOpen(false); onDelete(row);}} data-testid={`row-delete-${row.id||row.PLACA}`}
            style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 12px",fontSize:13.5,color:"#DC2626",background:"none",border:"none",cursor:"pointer",width:"100%",textAlign:"left" }}>
            <Trash2 style={{ width:14,height:14 }}/> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

// ── TAB: RESUMEN ──────────────────────────────────────────────────────────────
function TabResumen({ rows, totals, services, onOpenNuevaCarga }) {
  const showAhorro = services?.combustible === true;

  const invalidas = useMemo(() => {
    const list = rows.filter(r => {
      const gl = parseFloat(r.CANTIDAD_GL || 0);
      const imp = parseFloat(r.IMPORTE_TOTAL || 0);
      return !r.PLACA || gl <= 0 || imp <= 0;
    });
    const monto = list.reduce((s, r) => s + parseFloat(r.IMPORTE_TOTAL || 0), 0);
    return { count: list.length, monto };
  }, [rows]);

  const kpiValues = {
    gasto:    `S/ ${(totals.gasto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    galones:  `${Math.round(totals.gal || 0).toLocaleString("es-PE")}`,
    kmGal:    "—",   // TODO: cuando haya kilometraje entre cargas consecutivas por placa
    costoGal: totals.gal > 0 ? `S/ ${(totals.gasto / totals.gal).toFixed(2)}` : "—",
  };

  return (
    <div>
      {/* Big KPIs — SIN sparklines, solo números reales */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20 }}>
        {BIG_CARDS_META.map((k,i)=>{
          const Icon = k.ic;
          return (
            <div key={i} style={{ position:"relative",background:"#fff",borderRadius:20,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:"22px 24px",overflow:"hidden",minHeight:130 }}>
              <div style={{ fontSize:36,fontWeight:700,color:"#111827",lineHeight:1.1 }} data-testid={`combustible-kpi-${k.key}`}>{kpiValues[k.key]}</div>
              <div style={{ fontSize:15,color:"#6b7280",marginTop:10,maxWidth:"75%" }}>{k.lab}</div>
              <div style={{ position:"absolute",top:22,right:22,opacity:.85,color:k.col }}>
                <Icon style={{ width:26,height:26 }}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Small KPIs row 2 — Ahorro se oculta si no tiene servicios.combustible */}
      <div style={{ display:"grid",gridTemplateColumns:showAhorro?"repeat(4,1fr)":"repeat(3,1fr)",gap:20,marginTop:20 }}>
        <div style={{ borderRadius:16,padding:"16px 20px",minHeight:78,background:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,.05)",position:"relative",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <span style={{ fontSize:11,color:"#9ca3af",fontWeight:600,letterSpacing:".04em",textTransform:"uppercase" }}>Cargas</span>
          <span style={{ fontSize:26,fontWeight:700,color:"#111827",marginTop:2 }} data-testid="combustible-kpi-cargas">{rows.length}</span>
          <span style={{ position:"absolute",top:16,right:18,color:"#8B3DFF" }}><Droplet style={{ width:18,height:18 }}/></span>
        </div>
        <div style={{ borderRadius:16,padding:"16px 20px",minHeight:78,background:"#EF4444",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <span style={{ fontSize:14,opacity:.95,color:"#fff" }}>Cargas Inválidas</span>
          <span style={{ fontSize:26,fontWeight:700,color:"#fff",marginTop:2 }} data-testid="combustible-kpi-invalidas">{String(invalidas.count).padStart(2,"0")}</span>
        </div>
        <div style={{ borderRadius:16,padding:"16px 20px",minHeight:78,background:"#EF4444",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <span style={{ fontSize:14,opacity:.95,color:"#fff" }}>Monto Cargas Inválidas</span>
          <span style={{ fontSize:26,fontWeight:700,color:"#fff",marginTop:2 }} data-testid="combustible-kpi-monto-invalidas">S/ {invalidas.monto.toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
        {showAhorro && (
          <div style={{ borderRadius:16,padding:"16px 20px",minHeight:78,background:"#10B981",display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <span style={{ fontSize:14,opacity:.95,color:"#fff" }}>Ahorro Combustible</span>
            <span style={{ fontSize:26,fontWeight:700,color:"#fff",marginTop:2 }} data-testid="combustible-kpi-ahorro">S/ {(totals.ahorro || 0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ background:"#fff",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:"16px 18px",marginTop:20 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" }}>
          <span style={{ display:"flex",alignItems:"center",gap:8,color:"#6b7280",fontWeight:600,fontSize:13 }}>
            <Filter style={{ width:16,height:16 }}/>FILTROS
          </span>
          <FSel label="Empresa" grow/>
          <FSel label="Placa"/>
          <FSel label="Semana"/>
          <FSel label="Estación"/>
          <FSel label="Producto"/>
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:16,color:"#9ca3af" }}>
            {[Share2, Printer, Columns3, Download].map((Ic,i)=>(
              <Ic key={i} style={{ width:18,height:18,cursor:"pointer" }}/>
            ))}
            {!showAhorro && (
              <button
                onClick={onOpenNuevaCarga}
                data-testid="btn-nueva-carga"
                style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:10,height:38,padding:"0 16px",fontSize:13.5,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.25)",marginLeft:6 }}
              >
                <Plus style={{ width:16,height:16 }}/>Nueva carga
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop:18 }}>
        <div style={{ overflowX:"auto",borderRadius:14 }}>
          <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1500 }}>
            <thead>
              <tr style={{ background:HEADER_BG }}>
                {(showAhorro
                  ? ["","Placa","Controles","Empresa","Fecha e Hora","Ciudad / Estación","Kilometraje","Producto","Galones","Precio","Importe","Ahorro","GL/100 KM","Costo/km","Conductor",""]
                  : ["","Placa","Controles","Empresa","Fecha e Hora","Ciudad / Estación","Kilometraje","Producto","Galones","Precio","Importe","Factura","Conductor",""]
                ).map((h,i,arr)=>(
                  <th key={i} style={{ ...thSt, borderRadius:i===0?"12px 0 0 12px":i===arr.length-1?"0 12px 12px 0":"none" }}>{i===0?<input type="checkbox" style={{ width:16,height:16,accentColor:"#8B3DFF" }}/>:h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0,50).map((r,i)=>{
                const fecha = r.FECHA ? `${r.FECHA}${r.HORA?" "+r.HORA:""}` : "—";
                const ciudadEstacion = [r.CIUDAD, r.ESTACION].filter(Boolean).join(" / ") || "—";
                const galones = parseFloat(r.CANTIDAD_GL||0);
                const precio = parseFloat(r.PRECIO_UNITARIO||0);
                const importe = parseFloat(r.IMPORTE_TOTAL||0);
                const ahorro = parseFloat(r.AHORRO||0);
                return (
                  <tr key={r.id||i} style={{ borderBottom:"1px solid #E9EBEF" }}>
                    <td style={tdSt}><input type="checkbox" style={{ width:16,height:16,accentColor:"#8B3DFF" }}/></td>
                    <td style={{ ...tdSt,fontWeight:600,color:"#374151" }}>{r.PLACA||"—"}</td>
                    <td style={tdSt}>
                      <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <MapPin style={{ width:15,height:15,color:"#14B8A6" }}/>
                        <Camera style={{ width:15,height:15,color:"#EF4444" }}/>
                        <Receipt style={{ width:15,height:15,color:"#8B3DFF" }}/>
                        <CreditCard style={{ width:15,height:15,color:"#3B82F6" }}/>
                      </span>
                    </td>
                    <td style={tdSt}>{r.EMPRESA||"—"}</td>
                    <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{fecha}</td>
                    <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{ciudadEstacion}</td>
                    <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r.KILOMETRAJE?`${r.KILOMETRAJE} km`:"—"}</td>
                    <td style={tdSt}>{r.PRODUCTO||"—"}</td>
                    <td style={tdSt}>{galones? galones.toFixed(2):"—"}</td>
                    <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{precio? `S/ ${precio.toFixed(2)}`:"—"}</td>
                    <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{importe? `S/ ${importe.toFixed(2)}`:"—"}</td>
                    {showAhorro ? (
                      <>
                        <td style={{ ...tdSt,whiteSpace:"nowrap",color:"#059669",fontWeight:600 }}>{ahorro? `S/ ${ahorro.toFixed(2)}`:"—"}</td>
                        <td style={tdSt}>—</td>
                        <td style={{ ...tdSt,whiteSpace:"nowrap" }}>—</td>
                      </>
                    ) : (
                      <td style={tdSt}>
                        {r.factura_key || r._origen === "manual" ? (
                          <a href={`${process.env.REACT_APP_BACKEND_URL||""}/api/consumptions/${r.id}/factura`} target="_blank" rel="noreferrer" style={{ color:"#8B3DFF",fontSize:13,textDecoration:"none",fontWeight:600 }}>
                            <FileText style={{ width:14,height:14,display:"inline",verticalAlign:-2,marginRight:4 }}/>Ver
                          </a>
                        ) : "—"}
                      </td>
                    )}
                    <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r.CONDUCTOR||"—"}</td>
                    <td style={tdSt}>
                      <button style={{ width:44,height:34,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280" }}>
                        <MoreHorizontal style={{ width:15,height:15 }}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={showAhorro?16:14} style={{ padding:"40px 20px",textAlign:"center",color:"#9ca3af",fontSize:14 }}>
                    Aún no hay cargas registradas. {!showAhorro && "Haz clic en \"Nueva carga\" para registrar la primera."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 6px",fontSize:14,color:"#6b7280" }}>
          <span>Mostrando {Math.min(rows.length,50)} de {rows.length}</span>
        </div>
      </div>
    </div>
  );
}

// ── TAB: EVENTOS ──────────────────────────────────────────────────────────────
function TabEventos({ onToast }) {
  const [evOpen, setEvOpen] = useState(false);
  const [evSel, setEvSel]   = useState([]);
  const opts = Object.keys(EV_EST);
  const vis   = evSel.length ? MOCK_EVENTOS.filter(e=>evSel.includes(e.est)) : MOCK_EVENTOS;

  function toggleEv(o) { setEvSel(p=>p.includes(o)?p.filter(x=>x!==o):[...p,o]); }

  return (
    <div style={{ background:"#fff",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:20 }}>
      {/* Filters bar */}
      <div style={{ display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:6 }}>
        {[
          { icon:Calendar, label:"29/05 – 30/05" },
          { icon:User,     label:"Conductor" },
          { icon:Car,      label:"Vehículo" },
        ].map(({ icon:Icon, label },i)=>(
          <div key={i} style={{ position:"relative",height:40,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",display:"flex",alignItems:"center",gap:8,padding:"0 34px 0 12px",fontSize:13.5,color:"#4b5563",cursor:"pointer",userSelect:"none" }}>
            <Icon style={{ width:15,height:15,color:"#9ca3af" }}/>{label}
            <ChevronDown style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:15,height:15,color:"#9ca3af" }}/>
          </div>
        ))}
        {/* Estado dropdown */}
        <div style={{ position:"relative" }}>
          <div onClick={()=>setEvOpen(v=>!v)} style={{ height:40,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",display:"flex",alignItems:"center",padding:"0 34px 0 12px",fontSize:13.5,color:"#4b5563",cursor:"pointer",userSelect:"none",minWidth:100 }}>
            Estado<ChevronDown style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:15,height:15,color:"#9ca3af" }}/>
          </div>
          {evOpen && (
            <div style={{ position:"absolute",top:44,left:0,width:210,background:"#fff",border:"1px solid #F0F0F3",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:6,zIndex:30 }}>
              {opts.map(o=>(
                <label key={o} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 6px",fontSize:13.5,color:"#4b5563",cursor:"pointer",borderRadius:6 }}>
                  <input type="checkbox" style={{ accentColor:"#8B3DFF",width:15,height:15 }} checked={evSel.includes(o)} onChange={()=>toggleEv(o)}/>
                  {o}
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginLeft:"auto",display:"flex",gap:12 }}>
          <div style={{ height:40,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",display:"flex",alignItems:"center",gap:8,padding:"0 34px 0 12px",fontSize:13.5,color:"#4b5563",cursor:"pointer",position:"relative",userSelect:"none" }}>
            <ArrowUpDown style={{ width:15,height:15,color:"#9ca3af" }}/>Fecha (recientes)
            <ChevronDown style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:15,height:15,color:"#9ca3af" }}/>
          </div>
          <button onClick={()=>onToast("Carga registrada")} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:10,height:40,padding:"0 18px",fontSize:14,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.25)" }}>
            <Plus style={{ width:16,height:16 }}/>Registrar carga
          </button>
        </div>
      </div>

      {/* Events table */}
      <div style={{ overflowX:"auto",marginTop:8 }}>
        <table style={{ borderCollapse:"collapse",width:"100%",minWidth:900 }}>
          <thead>
            <tr style={{ background:HEADER_BG }}>
              {["Comportamiento","Conductor / ID","Vehículo","Fecha · Ubicación · Geocerca","Estado",""].map((h,i)=>(
                <th key={i} style={{ ...thSt, borderRadius:i===0?"12px 0 0 12px":i===5?"0 12px 12px 0":"none" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vis.map((e,i)=>{
              const s = EV_EST[e.est];
              return (
                <tr key={i} style={{ borderBottom:"1px solid #E9EBEF" }}>
                  <td style={{ ...tdSt,fontWeight:600,color:"#374151" }}>{e.tipo}</td>
                  <td style={tdSt}>{e.cond}</td>
                  <td style={tdSt}>{e.placa}</td>
                  <td style={{ ...tdSt,color:"#6b7280" }}>{e.info}</td>
                  <td style={tdSt}><Pill label={e.est} color={s.color} bg={s.bg}/></td>
                  <td style={tdSt}>
                    <button style={{ width:44,height:34,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280" }}>
                      <MoreHorizontal style={{ width:15,height:15 }}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display:"flex",padding:"14px 6px",fontSize:14,color:"#6b7280" }}>
        <span>Mostrando {vis.length} resultados</span>
      </div>

      {/* close dropdown on outside */}
      {evOpen && <div style={{ position:"fixed",inset:0,zIndex:20 }} onClick={()=>setEvOpen(false)}/>}
    </div>
  );
}

// ── TAB: CONTROL ──────────────────────────────────────────────────────────────
function TabControl({ onToast }) {
  const [showForm, setShowForm] = useState(false);
  const [ctrlList, setCtrlList] = useState([]);
  const [form, setForm] = useState({ tipo:CTRL_TYPES[0], placa:"", val:"", det:"" });

  function handleSend() {
    setCtrlList(p=>[{ ...form, est:"Pendiente" }, ...p]);
    setShowForm(false);
    setForm({ tipo:CTRL_TYPES[0], placa:"", val:"", det:"" });
    onToast("Solicitud enviada");
  }

  return (
    <div>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11,fontWeight:700,letterSpacing:".08em",color:"#8B3DFF",textTransform:"uppercase" }}>Restricciones y controles</div>
          <div style={{ fontSize:26,fontWeight:700,marginTop:2,color:"#111827" }}>Control Integral</div>
          <div style={{ color:"#6b7280",fontSize:13.5,marginTop:2 }}>Solicita y gestiona restricciones operativas sobre tu flota.</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:10,height:40,padding:"0 18px",fontSize:14,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.25)" }}>
          <Plus style={{ width:16,height:16 }}/>Nueva solicitud
        </button>
      </div>

      {showForm && (
        <div style={{ background:"#fff",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:22,marginBottom:16 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16 }}>
            <ShieldCheck style={{ color:"#8B3DFF",width:18,height:18 }}/>
            <b style={{ fontSize:15 }}>Nueva solicitud de control</b>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
            <select style={{ ...inputSt,...selSt }} value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
              {CTRL_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <input style={inputSt} placeholder="Placa (opcional)" value={form.placa} onChange={e=>setForm(p=>({...p,placa:e.target.value}))}/>
            <input style={{ ...inputSt,gridColumn:"1/3" }} placeholder="Valor / monto / lista (ej: 500 gal, LIMA, AREQUIPA)" value={form.val} onChange={e=>setForm(p=>({...p,val:e.target.value}))}/>
            <textarea style={{ ...inputSt,height:"auto",minHeight:92,padding:"10px 14px",resize:"vertical",gridColumn:"1/3" }} placeholder="Detalle de la solicitud" value={form.det} onChange={e=>setForm(p=>({...p,det:e.target.value}))}/>
          </div>
          <div style={{ display:"flex",gap:10,marginTop:16 }}>
            <button onClick={handleSend} style={{ display:"inline-flex",alignItems:"center",background:"#8B3DFF",color:"#fff",border:"none",borderRadius:10,height:40,padding:"0 18px",fontSize:14,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.25)" }}>Enviar</button>
            <button onClick={()=>setShowForm(false)} style={{ display:"inline-flex",alignItems:"center",height:40,padding:"0 18px",fontSize:14,fontWeight:500,color:"#374151",background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,cursor:"pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {ctrlList.length > 0 ? (
        <div style={{ background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:820 }}>
              <thead>
                <tr style={{ background:HEADER_BG }}>
                  {["Tipo de control","Placa","Valor / lista","Detalle","Estado",""].map((h,i)=>(
                    <th key={i} style={{ ...thSt, borderRadius:i===0?"12px 0 0 12px":i===5?"0 12px 12px 0":"none" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ctrlList.map((c,i)=>{
                  const s = CT_EST[c.est];
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #E9EBEF" }}>
                      <td style={{ ...tdSt,fontWeight:600,color:"#374151" }}>{c.tipo}</td>
                      <td style={tdSt}>{c.placa||"—"}</td>
                      <td style={tdSt}>{c.val||"—"}</td>
                      <td style={{ ...tdSt,color:"#6b7280" }}>{c.det||"—"}</td>
                      <td style={tdSt}><Pill label={c.est} color={s.color} bg={s.bg}/></td>
                      <td style={tdSt}>
                        <button style={{ width:44,height:34,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280" }}>
                          <MoreHorizontal style={{ width:15,height:15 }}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background:"#fff",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#9ca3af",padding:48 }}>
            <ShieldCheck style={{ width:34,height:34,color:"#cbd5e1",marginBottom:10 }}/>
            Sin solicitudes registradas. Crea una para empezar.
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB: QR ───────────────────────────────────────────────────────────────────
function TabQR({ onToast }) {
  const [qrq, setQrq] = useState("");
  const vis = QR_LIST.filter(q=>q[0].toLowerCase().includes(qrq.toLowerCase()));

  return (
    <div style={{ background:"#fff",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:"22px 24px" }}>
      <div style={{ fontSize:11,fontWeight:700,letterSpacing:".08em",color:"#8B3DFF",textTransform:"uppercase" }}>Códigos QR</div>
      <div style={{ fontSize:26,fontWeight:700,marginTop:2,color:"#111827" }}>Descarga tus QR</div>
      <div style={{ color:"#6b7280",fontSize:13.5,marginTop:2,marginBottom:16 }}>Códigos QR por unidad para uso en estaciones afiliadas a la red ENERED.</div>

      <div style={{ display:"flex",gap:12,marginBottom:18 }}>
        <div style={{ position:"relative",height:42,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",display:"flex",alignItems:"center",padding:"0 34px 0 14px",fontSize:14,color:"#4b5563",minWidth:220,cursor:"pointer",userSelect:"none" }}>
          Todas las empresas<ChevronDown style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:16,height:16,color:"#9ca3af" }}/>
        </div>
        <div style={{ position:"relative",flex:1,maxWidth:320 }}>
          <Search style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:16,height:16,color:"#9ca3af" }}/>
          <input style={{ ...inputSt,paddingLeft:36,height:42 }} placeholder="Buscar placa..." value={qrq} onChange={e=>setQrq(e.target.value)}/>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:18 }}>
        {vis.map(([placa, empresa],i)=>(
          <div key={i} style={{ background:"#fff",border:"1px solid #EFEFF3",borderRadius:16,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:14,display:"flex",flexDirection:"column",alignItems:"center" }}>
            <div style={{ width:"100%",aspectRatio:"1",borderRadius:12,background:"linear-gradient(135deg,#F5F1FF,#EDE7FA)",display:"flex",alignItems:"center",justifyContent:"center",padding:22 }}>
              <div dangerouslySetInnerHTML={{ __html: qrSvg(placa) }} style={{ width:"100%",height:"100%" }}/>
            </div>
            <div style={{ fontWeight:700,color:"#1f2937",fontSize:15,marginTop:12 }}>{placa}</div>
            <div style={{ fontSize:10.5,color:"#9ca3af",letterSpacing:".03em",textTransform:"uppercase",marginTop:2,textAlign:"center" }}>{empresa}</div>
            <button onClick={()=>onToast(`Descargando QR ${placa}`)}
              style={{ width:"100%",marginTop:12,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:10,height:40,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              <Download style={{ width:15,height:15 }}/>Descargar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MODAL: NUEVA CARGA MANUAL ─────────────────────────────────────────────────
function ModalNuevaCarga({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    placa: "", fecha: new Date().toISOString().slice(0,10), hora: "",
    estacion: "", ciudad: "", producto: "DIESEL B5",
    galones: "", precio_unitario: "", importe_total: "",
    kilometraje: "", conductor: "", numero_factura: "",
  });
  const [factura, setFactura] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const upd = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    setErr("");
    if (!form.placa || !form.fecha || !form.galones || !form.importe_total) {
      setErr("Placa, fecha, galones e importe son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== "" && v !== null && v !== undefined) fd.append(k, v); });
      if (factura) fd.append("factura", factura);
      const { data } = await api.post("/consumptions/manual", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved?.(data?.consumo);
      onClose();
    } catch (e) {
      console.error("Error al guardar carga manual:", e);
      setErr(e.response?.data?.detail || e.message || "Error al guardar la carga");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:16,padding:26,width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)" }} data-testid="modal-nueva-carga">
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
          <div>
            <div style={{ fontSize:11,fontWeight:700,letterSpacing:".08em",color:"#8B3DFF",textTransform:"uppercase" }}>Registro manual</div>
            <div style={{ fontSize:22,fontWeight:700,color:"#111827" }}>Nueva carga de combustible</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"#6b7280" }}><X style={{ width:22,height:22 }}/></button>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Placa *</label>
            <input style={inputSt} value={form.placa} onChange={upd("placa")} placeholder="ABC-123" data-testid="nc-placa"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Fecha *</label>
            <input type="date" style={inputSt} value={form.fecha} onChange={upd("fecha")} data-testid="nc-fecha"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Hora</label>
            <input type="time" style={inputSt} value={form.hora} onChange={upd("hora")}/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Producto</label>
            <select style={{ ...inputSt, ...selSt }} value={form.producto} onChange={upd("producto")}>
              <option>DIESEL B5</option><option>DIESEL DB5 S-50</option><option>GASOLINA 90</option><option>GASOLINA 95</option>
            </select></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Ciudad</label>
            <input style={inputSt} value={form.ciudad} onChange={upd("ciudad")} placeholder="Lima"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Estación</label>
            <input style={inputSt} value={form.estacion} onChange={upd("estacion")} placeholder="Primax San Isidro"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Galones *</label>
            <input type="number" step="0.01" style={inputSt} value={form.galones} onChange={upd("galones")} placeholder="20.5" data-testid="nc-galones"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Precio/gal (S/)</label>
            <input type="number" step="0.01" style={inputSt} value={form.precio_unitario} onChange={upd("precio_unitario")} placeholder="15.50"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Importe total (S/) *</label>
            <input type="number" step="0.01" style={inputSt} value={form.importe_total} onChange={upd("importe_total")} placeholder="317.75" data-testid="nc-importe"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Kilometraje</label>
            <input type="number" style={inputSt} value={form.kilometraje} onChange={upd("kilometraje")} placeholder="150000"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Conductor</label>
            <input style={inputSt} value={form.conductor} onChange={upd("conductor")} placeholder="Nombre del conductor"/></div>
          <div><label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>N° Factura</label>
            <input style={inputSt} value={form.numero_factura} onChange={upd("numero_factura")} placeholder="F001-1234"/></div>
          <div style={{ gridColumn:"1/3" }}>
            <label style={{ fontSize:12,color:"#6b7280",fontWeight:600 }}>Factura (PDF/PNG/JPG)</label>
            <div style={{ border:"2px dashed #E5E7EB",borderRadius:10,padding:14,textAlign:"center",background:"#F9FAFB" }}>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>setFactura(e.target.files?.[0]||null)} data-testid="nc-factura"/>
              {factura && <div style={{ fontSize:12,color:"#059669",marginTop:6 }}>✓ {factura.name}</div>}
            </div>
          </div>
        </div>

        {err && <div style={{ marginTop:12,color:"#DC2626",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 12px",fontSize:13.5 }}>{err}</div>}

        <div style={{ display:"flex",gap:10,marginTop:20,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"0 18px",height:40,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",fontSize:14,fontWeight:500,color:"#374151",cursor:"pointer" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} data-testid="nc-guardar"
            style={{ padding:"0 22px",height:40,border:"none",borderRadius:10,background:"#8B3DFF",color:"#fff",fontSize:14,fontWeight:600,cursor:saving?"wait":"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.25)",opacity:saving?0.7:1 }}>
            {saving ? "Guardando..." : "Guardar carga"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════ MAIN ══════════════════════════════════════
export default function Flotas() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Resumen");
  const [rows, setRows]           = useState([]);
  const [toast, setToast]         = useState(null);
  const [nuevaCargaOpen, setNuevaCargaOpen] = useState(false);
  const toastRef = useRef(null);

  const services = user?.servicios || { plataforma:true, combustible:true, gps:false };

  const reload = () => {
    api.get("/consumptions").then(r=>setRows(r.data||[])).catch(()=>{});
  };

  useEffect(reload, []);

  const totals = useMemo(()=>{
    let gal=0, gasto=0, ahorro=0;
    rows.forEach(r=>{ gal+=parseFloat(r.CANTIDAD_GL||0); gasto+=parseFloat(r.IMPORTE_TOTAL||0); ahorro+=parseFloat(r.AHORRO||0); });
    return { gal, gasto, ahorro, n:rows.length };
  }, [rows]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(()=>setToast(null), 2400);
  }

  const TABS = ["Resumen","Eventos","Control","QR"];

  return (
    <div style={{ padding:"22px 26px",background:"#EEF0F2",minHeight:"100%" }} data-testid="flotas-page">

      {/* TABS */}
      <div style={{ display:"flex",alignItems:"center",gap:38,marginBottom:20 }}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)} style={{
            fontSize:19,fontWeight:activeTab===t?700:500,
            color:activeTab===t?"#8B3DFF":"#4b5563",
            background:"none",border:"none",cursor:"pointer",padding:0
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {activeTab==="Resumen" && <TabResumen rows={rows} totals={totals} services={services} onOpenNuevaCarga={()=>setNuevaCargaOpen(true)}/>}
      {activeTab==="Eventos" && <TabEventos onToast={showToast}/>}
      {activeTab==="Control" && <TabControl onToast={showToast}/>}
      {activeTab==="QR"      && <TabQR onToast={showToast}/>}

      <ModalNuevaCarga open={nuevaCargaOpen} onClose={()=>setNuevaCargaOpen(false)} onSaved={(newConsumo)=>{ if (newConsumo) setRows(prev=>[newConsumo,...prev]); reload(); showToast("Carga registrada correctamente"); }}/>
      <Toast msg={toast}/>

      <div style={{ textAlign:"center",color:"#9ca3af",fontSize:11,padding:"26px 0 10px" }}>
        ENERED | Red Inteligente de Energías &nbsp;I Copyright © 2024 I Energix Peru I Todos los derechos son reservados.
      </div>
    </div>
  );
}
