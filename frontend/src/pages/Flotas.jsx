import React, { useEffect, useRef, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";
import {
  Receipt, Fuel, Gauge, Coins, Droplet, MapPin, Camera,
  FileText, CreditCard, MoreHorizontal, ShieldCheck, Plus,
  ChevronDown, Download, Share2, Printer, Columns3, Upload,
  Filter, Calendar, User, Car, ArrowUpDown, Search, X,
  CheckCircle2
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

const BIG_CARDS = [
  { num:"$52.500",  lab:"Gasto Total de Combustible",  ic:Receipt, col:"#8B3DFF" },
  { num:"134",      lab:"Total de Galones Consumidos",  ic:Fuel,    col:"#10B981" },
  { num:"0,0",      lab:"Promedio de KM/Galón",         ic:Gauge,   col:"#3B82F6" },
  { num:"$391,8",   lab:"Promedio de Costo/Galón",      ic:Coins,   col:"#334155" },
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

// ── TAB: RESUMEN ──────────────────────────────────────────────────────────────
// ── TAB: RESUMEN ──────────────────────────────────────────────────────────────
function TabResumen({ rows, totals, onDelete, onAddClick, onDownloadPdf }) {
  const [openMenuRow, setOpenMenuRow] = useState(null);

  const cards = [
    { num: formatSoles(totals.gasto), lab: "Gasto Total de Combustible", ic: Receipt, col: "#8B3DFF" },
    { num: totals.gal.toLocaleString("es-PE", { maximumFractionDigits: 0 }), lab: "Total de Galones Consumidos", ic: Fuel, col: "#10B981" },
    { num: "—", lab: "Promedio de KM/Galón", ic: Gauge, col: "#3B82F6" },
    { num: totals.gal > 0 ? formatSoles(totals.gasto / totals.gal) : "—", lab: "Promedio de Costo/Galón", ic: Coins, col: "#334155" },
  ];

  return (
    <div>
      {/* Big KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20 }}>
        {cards.map((k,i)=>{
          const Icon = k.ic;
          return (
            <div key={i} style={{ position:"relative",background:"#fff",borderRadius:20,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:"22px 24px",overflow:"hidden",minHeight:170 }}>
              <div style={{ fontSize:38,fontWeight:700,color:"#111827",lineHeight:1 }}>{k.num}</div>
              <div style={{ fontSize:16,color:"#6b7280",marginTop:8,maxWidth:"60%" }}>{k.lab}</div>
              <div style={{ position:"absolute",top:22,right:22,opacity:.85,color:k.col }}>
                <Icon style={{ width:26,height:26 }}/>
              </div>
              <svg style={{ position:"absolute",left:0,right:0,bottom:0,height:70,width:"100%" }} viewBox="0 0 200 70" preserveAspectRatio="none">
                <path d={AREA_PATH} fill={k.col} opacity="0.16"/>
                <path d={LINE_PATH} fill="none" stroke={k.col} strokeWidth="2.5" opacity="0.55"/>
              </svg>
            </div>
          );
        })}
      </div>

      {/* Small KPIs row 2 */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,marginTop:20 }}>
        <div style={{ borderRadius:16,padding:"16px 20px",minHeight:78,background:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,.05)",position:"relative",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <span style={{ fontSize:11,color:"#9ca3af",fontWeight:600,letterSpacing:".04em",textTransform:"uppercase" }}>Cargas</span>
          <span style={{ fontSize:26,fontWeight:700,color:"#111827",marginTop:2 }}>{rows.length}</span>
          <span style={{ position:"absolute",top:16,right:18,color:"#8B3DFF" }}><Droplet style={{ width:18,height:18 }}/></span>
        </div>
        {[
          { label:"Cargas Inválidas",        val:"00",           bg:"#EF4444" },
          { label:"Monto Cargas Inválidas",   val:"S/ 0.00", bg:"#EF4444" },
          { label:"Ahorro Combustible",       val: formatSoles(totals.ahorro), bg:"#10B981" },
        ].map((k,i)=>(
          <div key={i} style={{ borderRadius:16,padding:"16px 20px",minHeight:78,background:k.bg,display:"flex",flexDirection:"column",justifyContent:"center" }}>
            <span style={{ fontSize:14,opacity:.95,color:"#fff" }}>{k.label}</span>
            <span style={{ fontSize:26,fontWeight:700,color:"#fff",marginTop:2 }}>{k.val}</span>
          </div>
        ))}
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
            {[Share2, Printer, Columns3, Download, Upload].map((Ic,i)=>(
              <Ic key={i} style={{ width:18,height:18,cursor:"pointer" }}/>
            ))}
            <button 
              onClick={onAddClick} 
              style={{ display:"inline-flex",alignItems:"center",gap:8,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:10,height:40,padding:"0 18px",fontSize:14,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.25)",marginLeft:8 }}
            >
              <Plus style={{ width:16,height:16 }}/>Nueva carga
            </button>
          </div>
        </div>
      </div>

      {/* Overlay to close dropdown */}
      {openMenuRow !== null && (
        <div style={{ position:"fixed",inset:0,zIndex:40 }} onClick={() => setOpenMenuRow(null)}/>
      )}

      {/* Table */}
      <div style={{ marginTop:18 }}>
        <div style={{ overflowX:"auto",borderRadius:14 }}>
          <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1500 }}>
            <thead>
              <tr style={{ background:HEADER_BG }}>
                {["","Placa","Controles","Empresa","Fecha e Hora","Ciudad / Estación","Kilometraje","Producto","Galones","Precio","Importe","Ahorro","GL/100 KM","Costo/km","Conductor",""].map((h,i)=>(
                  <th key={i} style={{ ...thSt, borderRadius:i===0?"12px 0 0 12px":i===15?"0 12px 12px 0":"none" }}>{i===0?<input type="checkbox" style={{ width:16,height:16,accentColor:"#8B3DFF" }}/>:h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows.length > 0 ? rows.map(r=>([
                r.PLACA||"—",
                r.EMPRESA||"—",
                r.FECHA||"—",
                r.ESTACION && r.CIUDAD ? `${r.CIUDAD} / ${r.ESTACION}` : r.ESTACION || r.CIUDAD || "—",
                r.KILOMETRAJE || r.KM || "—",
                r.KILOMETRAJE || r.KM || "—",
                r.PRODUCTO||"Diesel",
                r.CANTIDAD_GL||"0",
                r.PRECIO_UNITARIO != null ? formatSoles(r.PRECIO_UNITARIO) : r.PRECIO ? formatSoles(r.PRECIO) : "—",
                r.IMPORTE_TOTAL != null ? formatSoles(r.IMPORTE_TOTAL) : "—",
                r.AHORRO != null ? formatSoles(r.AHORRO) : "—",
                "—",
                "—",
                r.CONDUCTOR||"—",
                r.id || r._id || "",
                r.pdf_filename || ""
              ])) : [
                ["ABC123","Rosandina","06/01/26 15:10","Trujillo / ES Los Postes","10000 km","100000 km","Diesel","8.58","S/24.41","S/209.44","S/13.56","9.7","S/10.9","Luis Galvez","",""],
                ["BJO894","Rosandina","06/01/26 12:40","Lima / ES Primax 45","152030 km","152030 km","Diesel","32.1","S/15.90","S/510.39","S/28.10","3.2","S/2.1","Carlos Ríos","",""],
                ["V2P481","Care Perú","05/01/26 09:15","Arequipa / Repsol Sur","89050 km","89050 km","Diesel","28.4","S/15.80","S/448.72","S/24.00","3.5","S/1.9","Ana Rojas","",""],
                ["BRO700","Rosandina","05/01/26 18:22","Piura / Petroperú","203110 km","203110 km","Diesel","30.8","S/15.95","S/491.26","S/26.50","3.1","S/2.0","Javier Q.","",""],
                ["BTP808","Rosandina","04/01/26 07:48","Chiclayo / Pecsa","44120 km","44120 km","Gasolina","19.6","S/17.40","S/341.04","S/12.20","4.0","S/2.4","Luis Galvez","",""],
                ["C3K915","Care Perú","04/01/26 16:05","Trujillo / ES Los Postes","310540 km","310540 km","Diesel","26.9","S/15.90","S/427.71","S/22.80","3.4","S/2.1","Ana Rojas","",""],
                ["D9L307","Rosandina","03/01/26 11:30","Lima / Primax 45","178900 km","178900 km","Diesel","31.5","S/16.00","S/504.00","S/27.00","3.0","S/2.0","Carlos Ríos","",""],
              ]).map((r,i)=>(
                <tr key={i} style={{ borderBottom:"1px solid #E9EBEF" }}>
                  <td style={tdSt}><input type="checkbox" style={{ width:16,height:16,accentColor:"#8B3DFF" }}/></td>
                  <td style={{ ...tdSt,fontWeight:600,color:"#374151" }}>{r[0]}</td>
                  <td style={tdSt}>
                    <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <MapPin style={{ width:15,height:15,color:"#14B8A6" }}/>
                      <Camera style={{ width:15,height:15,color:"#EF4444" }}/>
                      {r[15] ? (
                        <button 
                          onClick={() => onDownloadPdf(r[14], r[0])}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}
                          title="Descargar Comprobante PDF"
                        >
                          <Receipt style={{ width:15,height:15,color:"#8B3DFF" }}/>
                        </button>
                      ) : (
                        <Receipt style={{ width:15,height:15,color:"#cbd5e1" }}/>
                      )}
                      <CreditCard style={{ width:15,height:15,color:"#3B82F6" }}/>
                    </span>
                  </td>
                  <td style={tdSt}>{r[1]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r[2]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r[3]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>
                    <div>{r[4]} {r[4] !== "—" && !String(r[4]).includes("km") ? "km" : ""}</div>
                    <div style={{ color:"#9ca3af",fontSize:11 }}>{r[5]} {r[5] !== "—" && !String(r[5]).includes("km") ? "km" : ""}</div>
                  </td>
                  <td style={tdSt}>{r[6]}</td>
                  <td style={tdSt}>{r[7]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r[8]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r[9]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap",color:"#059669",fontWeight:600 }}>{r[10]}</td>
                  <td style={tdSt}>{r[11]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r[12]}</td>
                  <td style={{ ...tdSt,whiteSpace:"nowrap" }}>{r[13]}</td>
                  <td style={{ ...tdSt, position: "relative" }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuRow(openMenuRow === i ? null : i);
                      }}
                      style={{ width:44,height:34,border:"1px solid #E5E7EB",borderRadius:10,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280" }}
                    >
                      <MoreHorizontal style={{ width:15,height:15 }}/>
                    </button>
                    {openMenuRow === i && (
                      <div style={{ position:"absolute",right:14,top:38,background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,.1)",zIndex:50,minWidth:100,padding:4 }}>
                        <button 
                          onClick={() => {
                            setOpenMenuRow(null);
                            onDelete(r[14]);
                          }}
                          style={{ width:"100%",padding:"8px 12px",fontSize:13,color:"#DC2626",border:"none",background:"none",cursor:"pointer",textAlign:"left",borderRadius:6,fontWeight:600 }}
                          onMouseEnter={(e) => e.target.style.background = "#FEF2F2"}
                          onMouseLeave={(e) => e.target.style.background = "none"}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 6px",fontSize:14,color:"#6b7280" }}>
          <span>Mostrando 1 - {Math.min(rows.length, 50)} de {rows.length || 155}</span>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <span>Anterior</span>
            <span style={{ color:"#374151",fontWeight:600 }}>1 / 1</span>
            <span style={{ background:"#fff",border:"1px solid #E5E7EB",borderRadius:8,padding:"6px 14px",fontWeight:600,color:"#374151",cursor:"pointer" }}>Siguiente</span>
          </div>
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

// ── GESTIÓN DE CONSUMOS MAIN ──────────────────────────────────────────────────
export default function Flotas() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Resumen");
  const [rows, setRows]           = useState([]);
  const [toast, setToast]         = useState(null);
  const toastRef = useRef(null);

  // Modal de Nueva Carga
  const [showCargaModal, setShowCargaModal] = useState(false);
  const [cargaForm, setCargaForm] = useState({
    placa: "",
    empresa: user?.empresa || "",
    fecha: new Date().toISOString().split("T")[0],
    hora: "12:00",
    ciudad: "",
    estacion: "",
    producto: "DIESEL B5 S50",
    galones: "",
    precio: "",
    conductor: "",
    kilometraje: "",
    ruc_emisor: "",
    numero_documento: "",
    file: null,
  });

  useEffect(() => {
    // Sincronizar campo empresa en cargaForm cuando cargue el user
    if (user?.empresa) {
      setCargaForm(p => ({ ...p, empresa: user.empresa }));
    }
  }, [user]);

  const loadConsumptions = () => {
    api.get("/consumptions").then(r => setRows(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    loadConsumptions();
  }, []);

  const totals = useMemo(() => {
    let gal = 0, gasto = 0, ahorro = 0;
    rows.forEach(r => {
      gal += parseFloat(r.CANTIDAD_GL || 0);
      gasto += parseFloat(r.IMPORTE_TOTAL || 0);
      ahorro += parseFloat(r.AHORRO || 0);
    });
    return { gal, gasto, ahorro, n: rows.length };
  }, [rows]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2400);
  }

  const handleDelete = async (id) => {
    if (!id) {
      showToast("No se puede eliminar este registro simulado");
      return;
    }
    if (!window.confirm("¿Seguro de que deseas eliminar este registro de consumo?")) return;
    try {
      await api.delete(`/consumptions/${id}`);
      setRows(prev => prev.filter(r => (r.id || r._id) !== id));
      showToast("Consumo eliminado correctamente");
    } catch (err) {
      alert("Error al eliminar consumo: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDownloadPdf = async (id, placa) => {
    try {
      const r = await api.get(`/invoices/${id}/download/pdf`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura_${placa || "Combustible"}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("No se pudo descargar el comprobante para esta carga.");
    }
  };


  const handleCargaSubmit = async (e) => {
    e.preventDefault();
    if (!cargaForm.placa || !cargaForm.fecha || !cargaForm.galones || !cargaForm.precio) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }
    const gal = parseFloat(cargaForm.galones);
    const pre = parseFloat(cargaForm.precio);
    const imp = Math.round(gal * pre * 100) / 100;
    
    const fd = new FormData();
    fd.append("PLACA", cargaForm.placa.trim().toUpperCase());
    fd.append("EMPRESA", cargaForm.empresa.trim() || user?.empresa || "Manual");
    fd.append("FECHA", `${cargaForm.fecha} ${cargaForm.hora || "00:00"}`);
    fd.append("HORA", cargaForm.hora || "00:00");
    if (cargaForm.ciudad) fd.append("CIUDAD", cargaForm.ciudad.trim());
    if (cargaForm.estacion) fd.append("ESTACION", cargaForm.estacion.trim());
    fd.append("PRODUCTO", cargaForm.producto);
    fd.append("CANTIDAD_GL", gal);
    fd.append("PRECIO_UNITARIO", pre);
    fd.append("IMPORTE_TOTAL", imp);
    if (cargaForm.conductor) fd.append("CONDUCTOR", cargaForm.conductor.trim());
    fd.append("KILOMETRAJE", cargaForm.kilometraje ? parseInt(cargaForm.kilometraje) : 0);
    if (cargaForm.ruc_emisor) fd.append("RUC_EMISOR", cargaForm.ruc_emisor.trim());
    if (cargaForm.numero_documento) fd.append("NUMERO_DOCUMENTO", cargaForm.numero_documento.trim());
    if (cargaForm.file) {
      fd.append("file", cargaForm.file);
    }

    try {
      const { data } = await api.post("/consumptions", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setRows(prev => [data, ...prev]);
      setShowCargaModal(false);
      // Reset form
      setCargaForm({
        placa: "",
        empresa: user?.empresa || "",
        fecha: new Date().toISOString().split("T")[0],
        hora: "12:00",
        ciudad: "",
        estacion: "",
        producto: "DIESEL B5 S50",
        galones: "",
        precio: "",
        conductor: "",
        kilometraje: "",
        ruc_emisor: "",
        numero_documento: "",
        file: null,
      });
      showToast("Carga registrada con éxito");
    } catch (err) {
      alert("Error al registrar carga: " + (err.response?.data?.detail || err.message));
    }
  };

  const TABS = ["Resumen", "Eventos", "Control", "QR"];

  return (
    <div style={{ padding: "22px 26px", background: "#EEF0F2", minHeight: "100%" }} data-testid="flotas-page">

      {/* TABS */}
      <div style={{ display: "flex", alignItems: "center", gap: 38, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            fontSize: 19, fontWeight: activeTab === t ? 700 : 500,
            color: activeTab === t ? "#8B3DFF" : "#4b5563",
            background: "none", border: "none", cursor: "pointer", padding: 0
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {activeTab === "Resumen" && (
        <TabResumen 
          rows={rows} 
          totals={totals} 
          onDelete={handleDelete} 
          onAddClick={() => setShowCargaModal(true)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}
      {activeTab === "Eventos" && <TabEventos onToast={showToast} />}
      {activeTab === "Control" && <TabControl onToast={showToast} />}
      {activeTab === "QR"      && <TabQR onToast={showToast} />}

      <Toast msg={toast} />

      {/* MODAL NUEVA CARGA */}
      {showCargaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", width: "90%", maxWidth: 600, padding: 28, position: "relative", maxHeight: "90vh", overflowY: "auto", alignSelf: "center" }}>
            <button onClick={() => setShowCargaModal(false)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              <X style={{ width: 20, height: 20 }} />
            </button>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "#8B3DFF", textTransform: "uppercase" }}>Combustible</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: "#111827", marginBottom: 20 }}>Registrar Nueva Carga</div>
            
            <form onSubmit={handleCargaSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Placa *</label>
                <input required style={inputSt} value={cargaForm.placa} onChange={e => setCargaForm(p => ({ ...p, placa: e.target.value }))} placeholder="ABC-123" />
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Empresa</label>
                <input style={inputSt} value={cargaForm.empresa} onChange={e => setCargaForm(p => ({ ...p, empresa: e.target.value }))} placeholder="Nombre de empresa" disabled={user?.role !== "admin_enered"} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Fecha *</label>
                <input type="date" required style={inputSt} value={cargaForm.fecha} onChange={e => setCargaForm(p => ({ ...p, fecha: e.target.value }))} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Hora</label>
                <input type="time" style={inputSt} value={cargaForm.hora} onChange={e => setCargaForm(p => ({ ...p, hora: e.target.value }))} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Ciudad</label>
                <input style={inputSt} value={cargaForm.ciudad} onChange={e => setCargaForm(p => ({ ...p, ciudad: e.target.value }))} placeholder="Ej: Lima" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Estación / Grifo</label>
                <input style={inputSt} value={cargaForm.estacion} onChange={e => setCargaForm(p => ({ ...p, estacion: e.target.value }))} placeholder="Ej: Primax Javier Prado" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Producto *</label>
                <select style={{ ...inputSt, ...selSt }} value={cargaForm.producto} onChange={e => setCargaForm(p => ({ ...p, producto: e.target.value }))}>
                  <option value="DIESEL B5 S50">DIESEL B5 S50</option>
                  <option value="DIESEL B5">DIESEL B5</option>
                  <option value="DIESEL B20">DIESEL B20</option>
                  <option value="GASOHOL 90">GASOHOL 90</option>
                  <option value="GASOHOL 95">GASOHOL 95</option>
                  <option value="GASOHOL 97">GASOHOL 97</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Kilometraje</label>
                <input type="number" style={inputSt} value={cargaForm.kilometraje} onChange={e => setCargaForm(p => ({ ...p, kilometraje: e.target.value }))} placeholder="Ej: 145000" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Cantidad (Galones) *</label>
                <input type="number" step="any" required style={inputSt} value={cargaForm.galones} onChange={e => setCargaForm(p => ({ ...p, galones: e.target.value }))} placeholder="0.00" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Precio por Galón *</label>
                <input type="number" step="any" required style={inputSt} value={cargaForm.precio} onChange={e => setCargaForm(p => ({ ...p, precio: e.target.value }))} placeholder="0.00" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1/3" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Conductor</label>
                <input style={inputSt} value={cargaForm.conductor} onChange={e => setCargaForm(p => ({ ...p, conductor: e.target.value }))} placeholder="Nombre del conductor" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>RUC Emisor / Grifo</label>
                <input style={inputSt} value={cargaForm.ruc_emisor} onChange={e => setCargaForm(p => ({ ...p, ruc_emisor: e.target.value }))} placeholder="11 dígitos" maxLength={11} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>N° Documento (Factura)</label>
                <input style={inputSt} value={cargaForm.numero_documento} onChange={e => setCargaForm(p => ({ ...p, numero_documento: e.target.value }))} placeholder="Ej: F001-0001234" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1/3" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>Comprobante de Pago (PDF)</label>
                <input 
                  type="file" 
                  accept=".pdf" 
                  style={{ ...inputSt, padding: "8px 14px", height: "auto" }} 
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    setCargaForm(p => ({ ...p, file: f }));
                  }}
                />
              </div>

              <div style={{ gridColumn: "1/3", display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowCargaModal(false)} style={{ height: 42, padding: "0 20px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, cursor: "pointer", color: "#4b5563" }}>Cancelar</button>
                <button type="submit" style={{ height: 42, padding: "0 20px", borderRadius: 10, border: "none", background: "#8B3DFF", color: "#fff", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(139,61,255,.25)" }}>Guardar Carga</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 11, padding: "26px 0 10px" }}>
        ENERED | Red Inteligente de Energías &nbsp;I Copyright © 2024 I Energix Peru I Todos los derechos son reservados.
      </div>
    </div>
  );
}

