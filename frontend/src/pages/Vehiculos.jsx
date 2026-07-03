import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  Car, Plus, ChevronDown, ChevronUp, Eye, Pencil, Copy,
  Wrench, CalendarDays, Search, Upload, Download, X,
  MapPin, Cog, Warehouse, FileText, UserCheck, Fuel,
  Cpu, Wifi, WifiOff, Unlink, Tag, Shield, Layers,
  Clock
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

// ─── helpers ─────────────────────────────────────────────────────────────────
const cls = (...a) => a.filter(Boolean).join(" ");

const COSTO_COMP = [
  { name: "Correctivo",   v: 78.1, c: "#7FB3D5" },
  { name: "Infracciones", v: 10.8, c: "#BDC3C7" },
  { name: "Aditivo",      v: 5.8,  c: "#34495E" },
  { name: "Preventivo",   v: 3.2,  c: "#F5A623" },
  { name: "Combustibles", v: 1.3,  c: "#F4D03F" },
  { name: "Hospedaje",    v: 0.6,  c: "#E74C3C" },
  { name: "Vencimiento",  v: 0.3,  c: "#26C6B0" },
];

const CONTROLES = [
  { icon: MapPin,    color: "#14B8A6", label: "GPS" },
  { icon: Cog,       color: "#7FB3D5", label: "Config" },
  { icon: Warehouse, color: "#F26B6B", label: "Taller" },
  { icon: FileText,  color: "#F26B6B", label: "Docs" },
  { icon: UserCheck, color: "#F26B6B", label: "Conductor" },
  { icon: Shield,    color: "#F26B6B", label: "Infracciones" },
  { icon: Fuel,      color: "#F26B6B", label: "Combustible" },
];

const MOCK_VEHICULOS = [
  { id:"1", marca:"Chevrolet", estado:"OEM",      ec:"#14B8A6", unidad:"chevrolet 16", chasis:"VF37H9HF3JJ519998", veh:"T-151116.1", modelo:"CORSA",        tipo:"SEDAN",    base:"ACOZAC",   titular:"Transp. Andes", cc:"100000 - SEDE CENTRAL", med:"1.910.101.001" },
  { id:"2", marca:"Chevrolet", estado:"OPERATIVO", ec:"#059669", unidad:"567",          chasis:"8AC903552CE061670", veh:"BB265GT",    modelo:"CORSA",        tipo:"SEDAN",    base:"VECFLEET", titular:"Log. del Sur",  cc:"100000 - SEDE CENTRAL", med:"150.000.000"   },
  { id:"3", marca:"Chevrolet", estado:"OPERATIVO", ec:"#059669", unidad:"AEQQQA",       chasis:"123_1",            veh:"AE456OK",    modelo:"CORSA",        tipo:"SEDAN",    base:"EPEC",     titular:"Log. del Sur",  cc:"100000 - SEDE CENTRAL", med:"1.500.030"     },
  { id:"4", marca:"Ford",      estado:"OPERATIVO", ec:"#059669", unidad:"504",          chasis:"218497821478",     veh:"AA265GQ",    modelo:"F-150 XL 4X4", tipo:"PICK UP",  base:"EPEC",     titular:"APYMSA",        cc:"APYMSA -001",           med:"703.215"       },
  { id:"5", marca:"Mercedes-Benz", estado:"OPERATIVO", ec:"#059669", unidad:"21",      chasis:"664545333333_2",   veh:"AE456OV",    modelo:"SPRINTER",     tipo:"FURGÓN",   base:"EPEC",     titular:"Distrib. Lima", cc:"100000 - SEDE CENTRAL", med:"21.345.234"    },
];

const MOCK_MARCAS   = [["Chevrolet",128],["Ford",96],["Mercedes-Benz",42],["Kenworth",30],["Volvo",24],["International",18]];
const MOCK_MODELOS  = [["Corsa","Chevrolet","Sedán",64],["F-150 XL 4x4","Ford","Pick Up",40],["T800","Kenworth","Tractomula",30],["Sprinter","Mercedes-Benz","Furgón",22],["FH","Volvo","Tractomula",18]];
const MOCK_TIPOS    = [["Sedán","2 ejes · 4 neumáticos",210],["Pick Up","2 ejes · 4 neumáticos",88],["Tractomula","3 ejes · 10 neumáticos",60],["Furgón","2 ejes · 6 neumáticos",34],["Autobús","2 ejes · 6 neumáticos",20]];
const MOCK_DISPS    = [
  ["356938035…801","Teltonika FMC150","900 123 456 · Claro","Reportando","chevrolet 16 · T-151116","hace 2 min"],
  ["356938035…802","Teltonika FMC150","900 123 457 · Movistar","Reportando","567 · BB265GT","hace 5 min"],
  ["356938035…803","Teltonika FMB920","900 123 458 · Claro","No reporta","123_1 · AE456OK","hace 3 días"],
  ["356938035…804","Queclink GV75","900 123 459 · Entel","Reportando","504 · AA265GQ","hace 1 min"],
  ["356938035…805","Teltonika FMC150","— sin SIM","Sin asignar","—","—"],
];

// ─── Donut (CSS conic-gradient, igual que el HTML) ───────────────────────────
function Donut({ data, total = "$190276" }) {
  let acc = 0;
  const stops = data.map(s => {
    const a = acc;
    acc += s.v;
    return `${s.c} ${a.toFixed(1)}% ${acc.toFixed(1)}%`;
  });
  const bg = `conic-gradient(${stops.join(",")})`;
  return (
    <div style={{ width:150, height:150, borderRadius:"50%", background:bg, position:"relative", flexShrink:0 }}>
      <div style={{
        position:"absolute", inset:26, background:"#FAF7FF",
        borderRadius:"50%", display:"flex", alignItems:"center",
        justifyContent:"center", flexDirection:"column"
      }}>
        <span style={{ fontSize:14, fontWeight:700, color:"#1f2937" }}>{total}</span>
      </div>
    </div>
  );
}

// ─── KPI card (diseño HTML: top-label + icon, big number abajo) ──────────────
function KpiCard({ label, value, valueSub, foot, icon: Icon, color, gps }) {
  return (
    <div style={{
      background:"#fff", border:"1px solid #F0F0F3", borderRadius:16,
      boxShadow:"0 1px 2px rgba(0,0,0,.04)", padding:16, minHeight:96,
      display:"flex", flexDirection:"column", justifyContent:"space-between"
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <span style={{ fontSize:12, color:"#6B7280", lineHeight:1.2, maxWidth:"70%" }}>{label}</span>
        <Icon style={{ width:22, height:22, color, flexShrink:0, marginLeft:4 }} />
      </div>
      <div>
        {gps ? (
          <div style={{ fontSize:22, fontWeight:700, color:"#111827" }}>
            {value} <span style={{ fontSize:12, fontWeight:500, color:"#6B7280" }}>{valueSub}</span>
          </div>
        ) : (
          <div style={{ fontSize:30, fontWeight:700, color:"#111827" }}>{value}</div>
        )}
        {foot && <div style={{ fontSize:12, color:"#6B7280", marginTop:4 }}>{foot}</div>}
      </div>
    </div>
  );
}

// ─── Filter field (underline style) ─────────────────────────────────────────
function FilterField({ label, dropdown, value, onChange, options }) {
  if (dropdown && options) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #D5D8DE", paddingBottom:4 }}>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ border:"none", outline:"none", background:"transparent", fontSize:13, color: value ? "#374151" : "#9ca3af", flex:1, cursor:"pointer" }}>
          <option value="">{label}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown style={{ width:15, height:15, color:"#9ca3af", flexShrink:0 }} />
      </div>
    );
  }
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #D5D8DE", paddingBottom:4 }}>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={label}
        style={{ border:"none", outline:"none", background:"transparent", fontSize:13, color:"#374151", flex:1 }}
      />
    </div>
  );
}

// ─── Toggle switch ───────────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:13, color:"#6B7280" }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width:42, height:22, borderRadius:999,
          background: checked ? "#14B8A6" : "#E5E7EB",
          padding:2, display:"flex",
          justifyContent: checked ? "flex-end" : "flex-start",
          cursor:"pointer", transition:"background .2s"
        }}
      >
        <div style={{
          width:18, height:18, borderRadius:"50%", background:"#fff",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:700, color:"#DC2626"
        }}>
          {!checked && "✕"}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.4)", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,.2)", width:"100%", maxWidth:480 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px", borderBottom:"1px solid #F0F0F3" }}>
          <span style={{ fontWeight:700, fontSize:16, color:"#1f2937" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#6B7280" }}>
            <X style={{ width:20, height:20 }} />
          </button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

const inputSt = {
  width:"100%", border:"1px solid #D1D5DB", borderRadius:8,
  padding:"8px 12px", fontSize:13, outline:"none", color:"#374151"
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Vehiculos() {
  const { user } = useAuth();
  const isAdmin = ["admin_enered","administrador","logistica"].includes(user?.role);

  const [tab, setTab]             = useState("vehiculos");
  const [catTab, setCatTab]       = useState("Marcas");
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [errMsg, setErrMsg]       = useState("");
  const [loading, setLoading]     = useState(false);

  // API data
  const [vehiculos, setVehiculos]     = useState([]);
  const [conductores, setConductores] = useState([]);

  // Filters
  const [q, setQ]                       = useState("");
  const [fMarca, setFMarca]             = useState("");
  const [fEstado, setFEstado]           = useState("");
  const [fUnidad, setFUnidad]           = useState("");
  const [fChasis, setFChasis]           = useState("");
  const [fModelo, setFModelo]           = useState("");
  const [fTipo, setFTipo]               = useState("");
  const [fBase, setFBase]               = useState("");
  const [fTitular, setFTitular]         = useState("");
  const [fFuncion, setFFuncion]         = useState("");
  const [fCC, setFCC]                   = useState("");
  const [fMedMin, setFMedMin]           = useState("");
  const [fMedMax, setFMedMax]           = useState("");
  const [fInactivos, setFInactivos]     = useState(false);
  const [fPersistir, setFPersistir]     = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        api.get("/vehiculos"),
        api.get("/conductores").catch(() => ({ data: [] })),
      ]);
      // Merge mock + real; if real has data, use real only
      const real = v.data || [];
      setVehiculos(real.length > 0 ? real : MOCK_VEHICULOS);
      setConductores(c.data || []);
    } catch {
      setVehiculos(MOCK_VEHICULOS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // filtered list
  const lista = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return vehiculos.filter(v => {
      if (qq && !`${v.placa||""} ${v.marca||""} ${v.modelo||""} ${v.veh||""} ${v.unidad||""}`.toLowerCase().includes(qq)) return false;
      if (fMarca   && (v.marca||"").toLowerCase() !== fMarca.toLowerCase()) return false;
      if (fEstado  && (v.estado||"").toLowerCase() !== fEstado.toLowerCase()) return false;
      if (fUnidad  && !(v.unidad||"").toLowerCase().includes(fUnidad.toLowerCase())) return false;
      if (fChasis  && !(v.chasis||"").toLowerCase().includes(fChasis.toLowerCase())) return false;
      if (fModelo  && !(v.modelo||"").toLowerCase().includes(fModelo.toLowerCase())) return false;
      if (fTipo    && !(v.tipo||"").toLowerCase().includes(fTipo.toLowerCase())) return false;
      if (fBase    && !(v.base||"").toLowerCase().includes(fBase.toLowerCase())) return false;
      if (fTitular && !(v.titular||"").toLowerCase().includes(fTitular.toLowerCase())) return false;
      if (fCC      && !(v.cc||"").toLowerCase().includes(fCC.toLowerCase())) return false;
      if (!fInactivos && (v.estado||"").toUpperCase() === "INACTIVO") return false;
      return true;
    });
  }, [vehiculos, q, fMarca, fEstado, fUnidad, fChasis, fModelo, fTipo, fBase, fTitular, fCC, fInactivos]);

  function clearFilters() {
    setFMarca(""); setFEstado(""); setFUnidad(""); setFChasis(""); setFModelo("");
    setFTipo(""); setFBase(""); setFTitular(""); setFFuncion(""); setFCC("");
    setFMedMin(""); setFMedMax(""); setFInactivos(false); setQ("");
  }

  // CRUD
  function openCreate() { setErrMsg(""); setForm({ estado:"OPERATIVO" }); setModal("create"); }
  function openEdit(v)  { setErrMsg(""); setForm({...v}); setModal("edit"); }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setErrMsg("");
    try {
      const body = { ...form };
      if (body.año) body.año = parseInt(body.año, 10);
      if (modal === "edit") await api.put(`/vehiculos/${form.id}`, body);
      else                  await api.post("/vehiculos", body);
      setModal(null); setForm({});
      await loadAll();
    } catch (e2) { setErrMsg(e2?.response?.data?.detail || "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este vehículo?")) return;
    try { await api.delete(`/vehiculos/${id}`); await loadAll(); }
    catch (e) { alert(e?.response?.data?.detail || "Error al eliminar"); }
  }

  // Exports
  function exportExcel() {
    const rows = lista.map(v => ({ Placa:v.veh||v.placa, Marca:v.marca||"", Modelo:v.modelo||"", Tipo:v.tipo||"", Estado:v.estado||"", Empresa:v.empresa||v.cc||"" }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehiculos");
    XLSX.writeFile(wb, `vehiculos_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  function exportPDF() {
    const doc = new jsPDF({ orientation:"landscape" });
    doc.setFontSize(14); doc.text("ENERED — Administración de Vehículos", 14, 14);
    let y = 24;
    const line = (cols, bold) => {
      doc.setFont(undefined, bold ? "bold" : "normal");
      cols.forEach((c, i) => doc.text(String(c ?? ""), 14 + i * 48, y));
      y += 6; if (y > 195) { doc.addPage(); y = 14; }
    };
    line(["Placa","Marca","Modelo","Tipo","Estado"], true);
    lista.forEach(v => line([v.veh||v.placa||"", v.marca||"", v.modelo||"", v.tipo||"", v.estado||""]));
    doc.save(`vehiculos_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:"20px 24px", background:"#F3F4F6", minHeight:"100%" }} data-testid="page-vehiculos">

      {/* ── TABS ── */}
      <div style={{ display:"flex", alignItems:"center", gap:32, borderBottom:"1px solid #E5E7EB", marginBottom:20 }}>
        {[["vehiculos","Vehículos"],["catalogos","Catálogos"],["dispositivos","Dispositivos GPS"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            position:"relative", paddingBottom:12, fontSize:15, fontWeight: tab===id ? 700 : 500,
            color: tab===id ? "#8B3DFF" : "#6B7280", background:"none", border:"none", cursor:"pointer"
          }}>
            {lbl}
            {tab===id && <span style={{ position:"absolute", left:0, right:0, bottom:-1, height:2.5, borderRadius:2, background:"#8B3DFF" }} />}
          </button>
        ))}
      </div>

      {/* ════════════════════════ VEHICULOS ════════════════════════ */}
      {tab === "vehiculos" && (<>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:16, marginBottom:16 }}>
          <KpiCard gps label="GPS" value="0" valueSub="no reportan" foot="478 sin GPS" icon={MapPin} color="#14B8A6" />
          <KpiCard label="En Taller"                icon={Warehouse}  color="#F26B6B" value="40" />
          <KpiCard label="Doc. Vehículo Vencida"    icon={FileText}   color="#F26B6B" value="107" />
          <KpiCard label="Doc. Chofer Vencida"      icon={UserCheck}  color="#F26B6B" value="39" />
          <KpiCard label="Vh. con Infracciones"     icon={Shield}     color="#F26B6B" value="33" />
          <KpiCard label="Vh. con Cargas Inválidas" icon={Fuel}       color="#F26B6B" value="2" />
        </div>

        {/* FABs + export */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom: panelOpen ? 0 : 12 }}>
          {/* + button (teal circle) */}
          <button onClick={openCreate} style={{
            width:52, height:52, borderRadius:"50%", background:"#14B8A6",
            border:"none", color:"#fff", cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 12px rgba(0,0,0,.18)"
          }}>
            <Plus style={{ width:26, height:26 }} />
          </button>
          {/* chevron (dark circle) — toggles filter panel */}
          <button onClick={() => setPanelOpen(p => !p)} style={{
            width:44, height:44, borderRadius:"50%", background:"#1F2937",
            border:"none", color:"#fff", cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 12px rgba(0,0,0,.18)"
          }}>
            <ChevronDown style={{ width:20, height:20, transform: panelOpen ? "rotate(180deg)" : "none", transition:"transform .2s" }} />
          </button>
        </div>

        {/* Filter Panel */}
        {panelOpen && (
          <div style={{
            background:"#fff", border:"1px solid #F0F0F3", borderRadius:16,
            boxShadow:"0 1px 2px rgba(0,0,0,.04)", padding:22, marginBottom:16
          }}>
            {/* export icons row */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:12, marginBottom:14 }}>
              <button onClick={exportExcel} style={{ width:34, height:34, border:"none", borderRadius:8, background:"#F3F4F6", color:"#6b7280", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Upload style={{ width:16, height:16 }} />
              </button>
              <button onClick={exportPDF} style={{ width:34, height:34, border:"none", borderRadius:8, background:"#F3F4F6", color:"#6b7280", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Download style={{ width:16, height:16 }} />
              </button>
            </div>

            {/* Row 1: 4 columns */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"22px 32px" }}>
              <FilterField label="Marca"    dropdown value={fMarca}   onChange={setFMarca}   options={["Chevrolet","Ford","Mercedes-Benz","Kenworth","Volvo"]} />
              <FilterField label="Estados"  dropdown value={fEstado}  onChange={setFEstado}  options={["OPERATIVO","OEM","TALLER","INACTIVO"]} />
              <FilterField label="Unidad"           value={fUnidad}  onChange={setFUnidad} />
              <FilterField label="Chasis"           value={fChasis}  onChange={setFChasis} />
              <FilterField label="Vehículo"         value={q}        onChange={setQ} />
              <FilterField label="Modelo"           value={fModelo}  onChange={setFModelo} />
              <FilterField label="Tipo"    dropdown value={fTipo}    onChange={setFTipo}    options={["SEDAN","PICK UP","FURGÓN","TRACTOMULA","AUTOBÚS"]} />
              <FilterField label="Base"    dropdown value={fBase}    onChange={setFBase}    options={["EPEC","VECFLEET","ACOZAC"]} />
              <FilterField label="Titular" dropdown value={fTitular} onChange={setFTitular} options={["Transp. Andes","Log. del Sur","APYMSA","Distrib. Lima"]} />
              <FilterField label="Función" dropdown value={fFuncion} onChange={setFFuncion} options={["Carga","Pasajeros","Servicio"]} />
              <FilterField label="Centro de Costos" dropdown value={fCC} onChange={setFCC} options={["100000 - SEDE CENTRAL","APYMSA -001"]} />
              {/* Medidor range */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <FilterField label="Medidor desde" value={fMedMin} onChange={setFMedMin} />
                <FilterField label="Medidor hasta" value={fMedMax} onChange={setFMedMax} />
              </div>
            </div>

            {/* bottom: toggles + buscar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, marginTop:22 }}>
              <div style={{ display:"flex", alignItems:"center", gap:32 }}>
                <Toggle label="Ver Inactivos"     checked={fInactivos} onChange={setFInactivos} />
                <Toggle label="Persistir Filtros" checked={fPersistir} onChange={setFPersistir} />
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                style={{ display:"flex", alignItems:"center", gap:8, background:"#14B8A6", color:"#fff", border:"none", borderRadius:8, height:40, padding:"0 22px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                <Search style={{ width:16, height:16 }} /> Buscar
              </button>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div style={{ background:"#fff", border:"1px solid #F0F0F3", borderRadius:16, boxShadow:"0 1px 2px rgba(0,0,0,.04)", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", width:"100%", minWidth:1200 }}>
              <thead>
                <tr style={{ background:"#2A2A3C" }}>
                  {["","MARCA","ESTADO","UNIDAD","CHASIS","VEHÍCULO","MODELO","PRÓX. TAREA","TIPO","BASE","TITULAR","CENTRO DE COSTOS","MEDIDOR","ACTUALIZAR","ACCIONES"].map((h,i) => (
                    <th key={i} style={{ textAlign:"left", color:"#fff", fontWeight:600, textTransform:"uppercase", fontSize:10.5, letterSpacing:".03em", padding:"12px 14px", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={15} style={{ textAlign:"center", padding:40, color:"#9ca3af", fontSize:14 }}>Cargando...</td></tr>
                ) : lista.length === 0 ? (
                  <tr><td colSpan={15} style={{ textAlign:"center", padding:40, color:"#9ca3af", fontSize:14 }}>Sin vehículos registrados</td></tr>
                ) : lista.map((v, i) => {
                  const open = expanded === v.id;
                  return (
                    <React.Fragment key={v.id}>
                      <tr style={{ borderTop: i===0 ? "none" : "1px solid #F3F4F6", background: open ? "#FAF7FF" : "transparent", transition:"background .15s" }}
                        onMouseEnter={e => { if(!open) e.currentTarget.style.background="#f9fafb"; }}
                        onMouseLeave={e => { if(!open) e.currentTarget.style.background="transparent"; }}>
                        {/* checkbox */}
                        <td style={{ padding:"10px 14px" }}><input type="checkbox" /></td>
                        {/* marca + expand btn */}
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
                            <button onClick={() => setExpanded(open ? null : v.id)} style={{
                              background:"none", border:"none", cursor:"pointer", display:"flex",
                              color: open ? "#8B3DFF" : "#9ca3af", padding:0
                            }}>
                              <ChevronDown style={{ width:15, height:15, transition:"transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
                            </button>
                            <div style={{ width:24, height:24, borderRadius:6, background:"#F1EAFF", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Car style={{ width:12, height:12, color:"#8B3DFF" }} />
                            </div>
                            <span style={{ color:"#374151", fontSize:12.5 }}>{v.marca}</span>
                          </div>
                        </td>
                        {/* estado pill */}
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ borderRadius:999, fontWeight:700, fontSize:9.5, padding:"3px 9px", color:"#fff", background: v.ec || "#6B7280", whiteSpace:"nowrap" }}>
                            {v.estado}
                          </span>
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#374151", fontWeight:500, whiteSpace:"nowrap" }}>{v.unidad}</td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#6b7280", whiteSpace:"nowrap" }}>{v.chasis}</td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#374151", whiteSpace:"nowrap" }}>
                          {v.veh || v.placa}<span style={{ color:"#DC2626" }}> ●</span>
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#4b5563", whiteSpace:"nowrap" }}>{v.modelo}</td>
                        {/* próx tarea */}
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex", gap:4 }}>
                            <b style={{ borderRadius:4, fontSize:9, fontWeight:700, padding:"1px 4px", color:"#fff", background:"#F26B6B" }}>P</b>
                            <b style={{ borderRadius:4, fontSize:9, fontWeight:700, padding:"1px 4px", color:"#fff", background:"#8B3DFF" }}>V</b>
                          </div>
                        </td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#4b5563", whiteSpace:"nowrap" }}>{v.tipo}</td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#4b5563", whiteSpace:"nowrap" }}>{v.base}</td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#4b5563", whiteSpace:"nowrap" }}>{v.titular}</td>
                        <td style={{ padding:"10px 14px", fontSize:12.5, color:"#4b5563", whiteSpace:"nowrap" }}>{v.cc}</td>
                        {/* medidor */}
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:4, color:"#4b5563", whiteSpace:"nowrap" }}>
                            <Clock style={{ width:13, height:13, color:"#9ca3af" }} />
                            <span style={{ fontSize:12.5 }}>{v.med || "0"} Kms</span>
                          </div>
                        </td>
                        {/* actualizar: underline teal */}
                        <td style={{ padding:"10px 14px", minWidth:90 }}>
                          <div style={{ borderBottom:"1.5px solid #14B8A6", height:20, minWidth:80 }} />
                        </td>
                        {/* actions */}
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            {[Eye, Pencil, Copy, Wrench, CalendarDays].map((Ic, j) => (
                              <button key={j}
                                onClick={ j===1 ? () => openEdit(v) : j===4 ? () => handleDelete(v.id) : undefined }
                                style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", display:"flex" }}>
                                <Ic style={{ width:15, height:15 }} />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED ROW */}
                      {open && (
                        <tr style={{ background:"#FAF7FF" }}>
                          <td colSpan={15} style={{ background:"#FAF7FF", borderTop:"1px solid #F1EAFF", padding:0 }}>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, padding:24 }}>
                              {/* LEFT: costo total */}
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                                  <b style={{ fontSize:18, color:"#1f2937" }}>Costo Total</b>
                                  <span style={{ fontSize:12, color:"#9ca3af" }}>· Período: Todo</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                                  <Donut data={COSTO_COMP} total="$190276" />
                                  {/* legend 2 cols */}
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px", flex:1 }}>
                                    {COSTO_COMP.map((s,j) => (
                                      <div key={j} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11 }}>
                                        <span style={{ display:"flex", alignItems:"center", gap:6, color:"#4b5563" }}>
                                          <span style={{ width:8, height:8, borderRadius:"50%", background:s.c, display:"inline-block" }} />
                                          {s.name}
                                        </span>
                                        <span style={{ fontWeight:600, color:"#374151" }}>{s.v}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* RIGHT: stats + controles */}
                              <div style={{ borderLeft:"1px solid #E5E7EB", paddingLeft:24 }}>
                                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
                                  {[
                                    { v:"$0",             s:"Costo/km",       big:true },
                                    { v:"1.287.989,89",   s:"Promedio Km/Día" },
                                    { v:"1.910.089.001",  s:"Recorrido Km" },
                                  ].map((st, j) => (
                                    <div key={j}>
                                      <div style={{ fontWeight:700, color:"#1f2937", fontSize: st.big ? 22 : 18 }}>{st.v}</div>
                                      <div style={{ fontSize:11, color:"#9ca3af" }}>{st.s}</div>
                                    </div>
                                  ))}
                                </div>
                                {/* Controles bar */}
                                <div style={{ borderRadius:999, background:"#E8ECEF", height:42, display:"flex", alignItems:"center", padding:"0 20px", marginBottom:12 }}>
                                  <b style={{ fontSize:15, color:"#4b5563" }}>Controles</b>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                                  {CONTROLES.map((ctrl, j) => {
                                    const CIcon = ctrl.icon;
                                    return (
                                      <button key={j} title={ctrl.label} style={{
                                        width:48, height:48, borderRadius:"50%", background:"#fff",
                                        border:"1px solid #EEF0F2", boxShadow:"0 1px 2px rgba(0,0,0,.05)",
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        cursor:"pointer"
                                      }}>
                                        <CIcon style={{ width:20, height:20, color: ctrl.color }} />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* pager */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:16, height:48, padding:"0 16px", borderTop:"1px solid #F3F4F6", fontSize:12.5, color:"#6B7280" }}>
            <span>Mostrar 10</span>
            <span>Mostrando 1 a {lista.length} de {vehiculos.length}</span>
          </div>
        </div>
      </>)}

      {/* ════════════════════════ CATÁLOGOS ════════════════════════ */}
      {tab === "catalogos" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:16 }}>
            {/* subtabs pill */}
            <div style={{ display:"flex", alignItems:"center", gap:4, background:"#fff", border:"1px solid #F0F0F3", borderRadius:999, padding:4 }}>
              {["Marcas","Modelos","Tipos de vehículo"].map(x => (
                <button key={x} onClick={() => setCatTab(x)} style={{
                  border:"none", borderRadius:999, fontSize:13, fontWeight:500,
                  padding:"7px 16px", cursor:"pointer",
                  background: catTab===x ? "#8B3DFF" : "none",
                  color:       catTab===x ? "#fff"    : "#6B7280"
                }}>{x}</button>
              ))}
            </div>
            <button style={{ display:"flex", alignItems:"center", gap:8, background:"#8B3DFF", color:"#fff", border:"none", borderRadius:8, height:38, padding:"0 16px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              <Plus style={{ width:16, height:16 }} />
              Agregar {catTab === "Marcas" ? "marca" : catTab === "Modelos" ? "modelo" : "tipo"}
            </button>
          </div>

          {/* note */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:8, background:"#F1EAFF", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12.5, color:"#4b5563" }}>
            <Tag style={{ width:15, height:15, color:"#8B3DFF", marginTop:1, flexShrink:0 }} />
            <span>Estos catálogos son de baja frecuencia: al registrar un vehículo con su <b>VIN/Chasis</b>, la marca y el modelo se autocompletan. También puedes crearlos al vuelo desde la ficha del vehículo.</span>
          </div>

          <div style={{ background:"#fff", border:"1px solid #F0F0F3", borderRadius:16, overflow:"hidden", boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
            <table style={{ borderCollapse:"collapse", width:"100%" }}>
              <thead>
                <tr style={{ background:"#2A2A3C" }}>
                  {(catTab==="Marcas"
                    ? ["Marca","N° de vehículos","Estado","Acciones"]
                    : catTab==="Modelos"
                    ? ["Modelo","Marca","Tipo de vehículo","N° vehículos","Acciones"]
                    : ["Tipo de vehículo","Configuración","N° vehículos","Acciones"]
                  ).map((h,i) => (
                    <th key={i} style={{ textAlign:"left", color:"#fff", fontWeight:600, textTransform:"uppercase", fontSize:10.5, letterSpacing:".03em", padding:"12px 18px", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catTab==="Marcas" && MOCK_MARCAS.map(([m,n],i) => (
                  <tr key={i} style={{ borderTop: i>0 ? "1px solid #F3F4F6" : "none" }}>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:24, height:24, borderRadius:6, background:"#F1EAFF", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Car style={{ width:12, height:12, color:"#8B3DFF" }} />
                        </div>
                        <span style={{ fontWeight:600, color:"#374151", fontSize:13.5 }}>{m}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 18px", color:"#4b5563", fontSize:13.5 }}>{n}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:6, borderRadius:999, fontWeight:600, fontSize:11, padding:"3px 10px", color:"#059669", background:"#ECFDF5" }}>Activo</span>
                    </td>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex", gap:10 }}>
                        {[Eye,Pencil,Copy,Wrench,CalendarDays].map((Ic,j) => (
                          <button key={j} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><Ic style={{ width:15, height:15 }} /></button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {catTab==="Modelos" && MOCK_MODELOS.map(([m,marca,tipo,n],i) => (
                  <tr key={i} style={{ borderTop: i>0 ? "1px solid #F3F4F6" : "none" }}>
                    <td style={{ padding:"12px 18px", fontWeight:600, color:"#374151", fontSize:13.5 }}>{m}</td>
                    <td style={{ padding:"12px 18px", color:"#4b5563", fontSize:13.5 }}>{marca}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <span style={{ borderRadius:999, fontSize:11.5, padding:"3px 10px", color:"#7A2FF0", background:"#F1EAFF" }}>{tipo}</span>
                    </td>
                    <td style={{ padding:"12px 18px", color:"#4b5563", fontSize:13.5 }}>{n}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex", gap:10 }}>
                        {[Eye,Pencil,Copy,Wrench,CalendarDays].map((Ic,j) => (
                          <button key={j} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><Ic style={{ width:15, height:15 }} /></button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {catTab==="Tipos de vehículo" && MOCK_TIPOS.map(([t,conf,n],i) => (
                  <tr key={i} style={{ borderTop: i>0 ? "1px solid #F3F4F6" : "none" }}>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Layers style={{ width:15, height:15, color:"#8B3DFF" }} />
                        <span style={{ fontWeight:600, color:"#374151", fontSize:13.5 }}>{t}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 18px", color:"#4b5563", fontSize:13.5 }}>{conf}</td>
                    <td style={{ padding:"12px 18px", color:"#4b5563", fontSize:13.5 }}>{n}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex", gap:10 }}>
                        {[Eye,Pencil,Copy,Wrench,CalendarDays].map((Ic,j) => (
                          <button key={j} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}><Ic style={{ width:15, height:15 }} /></button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════ DISPOSITIVOS GPS ════════════════════════ */}
      {tab === "dispositivos" && (
        <div>
          {/* KPIs horizontales */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:16 }}>
            {[
              { label:"Dispositivos", v:"199", icon:Cpu,    color:"#8B3DFF", bg:"#F1EAFF" },
              { label:"Reportando",   v:"191", icon:Wifi,   color:"#059669", bg:"#ECFDF5" },
              { label:"No reportan",  v:"5",   icon:WifiOff,color:"#DC2626", bg:"#FEF2F2" },
              { label:"Sin asignar",  v:"3",   icon:Unlink, color:"#B45309", bg:"#FFFBEB" },
            ].map((k,i) => {
              const KIc = k.icon;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:16, background:"#fff", border:"1px solid #F0F0F3", borderRadius:16, boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
                  <div style={{ width:42, height:42, borderRadius:12, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <KIc style={{ width:21, height:21, color:k.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize:26, fontWeight:700, color:"#111827", lineHeight:1 }}>{k.v}</div>
                    <div style={{ fontSize:12.5, color:"#6B7280", marginTop:4 }}>{k.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <button style={{ display:"flex", alignItems:"center", gap:8, background:"#8B3DFF", color:"#fff", border:"none", borderRadius:8, height:38, padding:"0 16px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              <Plus style={{ width:16, height:16 }} /> Registrar dispositivo
            </button>
          </div>

          <div style={{ background:"#fff", border:"1px solid #F0F0F3", borderRadius:16, overflow:"hidden", boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", width:"100%", minWidth:900 }}>
                <thead>
                  <tr style={{ background:"#2A2A3C" }}>
                    {["Serie / IMEI","Modelo","SIM / Operador","Estado","Vehículo asignado","Última comunicación","Acciones"].map((h,i) => (
                      <th key={i} style={{ textAlign:"left", color:"#fff", fontWeight:600, textTransform:"uppercase", fontSize:10.5, letterSpacing:".03em", padding:"12px 16px", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DISPS.map((d,i) => {
                    const { c, b } = d[3]==="Reportando" ? { c:"#059669", b:"#ECFDF5" } : d[3]==="No reporta" ? { c:"#DC2626", b:"#FEF2F2" } : { c:"#B45309", b:"#FFFBEB" };
                    const btn = d[3]==="Sin asignar" ? "Asignar" : "Reasignar";
                    return (
                      <tr key={i} style={{ borderTop: i>0 ? "1px solid #F3F4F6" : "none" }}>
                        <td style={{ padding:"12px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <Cpu style={{ width:14, height:14, color:"#8B3DFF" }} />
                            <span style={{ fontWeight:600, color:"#374151", fontSize:13 }}>{d[0]}</span>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", color:"#4b5563", fontSize:13, whiteSpace:"nowrap" }}>{d[1]}</td>
                        <td style={{ padding:"12px 16px", color:"#4b5563", fontSize:13, whiteSpace:"nowrap" }}>{d[2]}</td>
                        <td style={{ padding:"12px 16px" }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:6, borderRadius:999, fontWeight:600, fontSize:11, padding:"3px 10px", color:c, background:b }}>
                            <span style={{ width:6, height:6, borderRadius:"50%", background:c, display:"inline-block" }} />{d[3]}
                          </span>
                        </td>
                        <td style={{ padding:"12px 16px", color:"#374151", fontSize:13, whiteSpace:"nowrap" }}>{d[4]}</td>
                        <td style={{ padding:"12px 16px", color:"#6b7280", fontSize:13, whiteSpace:"nowrap" }}>{d[5]}</td>
                        <td style={{ padding:"12px 16px" }}>
                          <button style={{ border:"none", borderRadius:8, fontSize:12, fontWeight:600, padding:"5px 12px", color:"#8B3DFF", background:"#F1EAFF", cursor:"pointer" }}>{btn}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL CREAR/EDITAR ═══════════ */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal==="edit" ? "Editar Vehículo" : "Registrar Vehículo"}>
        <form onSubmit={handleSave} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:".05em" }}>Placa *</label>
              <input required maxLength={7} value={form.placa||""} placeholder="ABC-123"
                onChange={e => setForm({...form, placa: e.target.value.toUpperCase().trim()})}
                style={{ ...inputSt, marginTop:4 }} />
            </div>
            {[
              ["Marca",   "marca",  "Ej: Chevrolet"],
              ["Modelo",  "modelo", "Ej: Corsa"],
              ["Año",     "año",    "Ej: 2024"],
              ["Unidad",  "unidad", "Ej: 567"],
            ].map(([lbl, key, ph]) => (
              <div key={key}>
                <label style={{ fontSize:12, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:".05em" }}>{lbl}</label>
                <input value={form[key]||""} placeholder={ph}
                  onChange={e => setForm({...form, [key]: e.target.value})}
                  style={{ ...inputSt, marginTop:4 }} />
              </div>
            ))}
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:".05em" }}>Estado</label>
              <select value={form.estado||"OPERATIVO"} onChange={e => setForm({...form, estado: e.target.value})}
                style={{ ...inputSt, marginTop:4 }}>
                {["OPERATIVO","OEM","TALLER","INACTIVO"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:12, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:".05em" }}>Conductor Principal</label>
              <select value={form.conductor_principal_id||""} onChange={e => setForm({...form, conductor_principal_id: e.target.value})}
                style={{ ...inputSt, marginTop:4 }}>
                <option value="">Seleccionar conductor...</option>
                {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellidos}</option>)}
              </select>
            </div>
          </div>
          {errMsg && <div style={{ color:"#DC2626", fontSize:12, fontWeight:600 }}>{errMsg}</div>}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, borderTop:"1px solid #F0F0F3", paddingTop:14 }}>
            <button type="button" onClick={() => setModal(null)}
              style={{ padding:"8px 16px", border:"1px solid #D1D5DB", borderRadius:8, fontSize:13, fontWeight:600, color:"#374151", background:"#fff", cursor:"pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ padding:"8px 20px", background:"#8B3DFF", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", opacity: saving ? .6 : 1 }}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* footer */}
      <div style={{ textAlign:"center", color:"#9ca3af", fontSize:11, padding:"24px 0 8px" }}>
        ENERED | Red Inteligente de Energías &nbsp;I Copyright © 2024 I Energix Peru I Todos los derechos son reservados.
      </div>
    </div>
  );
}
