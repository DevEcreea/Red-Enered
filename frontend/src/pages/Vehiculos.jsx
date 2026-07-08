import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  Car, Plus, ChevronDown, Eye, Pencil, Copy,
  Wrench, CalendarDays, Search, Upload, Download, X,
  MapPin, Cog, Warehouse, FileText, UserCheck, Fuel,
  Cpu, Wifi, WifiOff, Unlink, Tag, Shield, Layers,
  Clock, Truck, Bus, Bike
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

// ─── Estado config (pill color + label) ──────────────────────────────────────
const ESTADOS = [
  { value:"OPERATIVO", label:"Operativo",   bg:"#059669", text:"#fff" },
  { value:"OEM",       label:"OEM",         bg:"#14B8A6", text:"#fff" },
  { value:"TALLER",    label:"En Taller",   bg:"#F26B6B", text:"#fff" },
  { value:"INACTIVO",  label:"Inactivo",    bg:"#6B7280", text:"#fff" },
  { value:"ACCIDENTE", label:"Accidente",   bg:"#DC2626", text:"#fff" },
  { value:"DISPONIBLE",label:"Disponible",  bg:"#8B3DFF", text:"#fff" },
];

function estadoStyle(val) {
  return ESTADOS.find(e => e.value === (val || "").toUpperCase()) || { bg:"#6B7280", text:"#fff", label: val };
}

// ─── Cost breakdown & controls ────────────────────────────────────────────────
const COSTO_COMP = [
  { name:"Correctivo",   v:0, c:"#7FB3D5" },
  { name:"Infracciones", v:0, c:"#BDC3C7" },
  { name:"Aditivo",      v:0, c:"#34495E" },
  { name:"Preventivo",   v:0, c:"#F5A623" },
  { name:"Combustibles", v:0, c:"#F4D03F" },
  { name:"Hospedaje",    v:0, c:"#E74C3C" },
  { name:"Vencimiento",  v:0, c:"#26C6B0" },
];

const CONTROLES = [
  { icon:MapPin,    color:"#14B8A6", label:"GPS" },
  { icon:Cog,       color:"#7FB3D5", label:"Config" },
  { icon:Warehouse, color:"#F26B6B", label:"Taller" },
  { icon:FileText,  color:"#F26B6B", label:"Docs" },
  { icon:UserCheck, color:"#F26B6B", label:"Conductor" },
  { icon:Shield,    color:"#F26B6B", label:"Infracciones" },
  { icon:Fuel,      color:"#F26B6B", label:"Combustible" },
];

// ─── Catalog initial data ────────────────────────────────────────────────────
const INIT_MARCAS = [
  { id:"m1", marca:"Chevrolet",     n:0, estado:"Activo", icono:"Car" },
  { id:"m2", marca:"Ford",          n:0, estado:"Activo", icono:"Truck" },
  { id:"m3", marca:"Mercedes-Benz", n:0, estado:"Activo", icono:"Bus" },
  { id:"m4", marca:"Kenworth",      n:0, estado:"Activo", icono:"Truck" },
  { id:"m5", marca:"Volvo",         n:0, estado:"Activo", icono:"Truck" },
  { id:"m6", marca:"International", n:0, estado:"Activo", icono:"Truck" },
];
const INIT_MODELOS = [
  { id:"mo1", modelo:"Corsa",        marca:"Chevrolet",     tipo:"Sedán",      n:0 },
  { id:"mo2", modelo:"F-150 XL 4x4", marca:"Ford",          tipo:"Pick Up",    n:0 },
  { id:"mo3", modelo:"T800",         marca:"Kenworth",      tipo:"Tractomula", n:0 },
  { id:"mo4", modelo:"Sprinter",     marca:"Mercedes-Benz", tipo:"Furgón",     n:0 },
  { id:"mo5", modelo:"FH",           marca:"Volvo",         tipo:"Tractomula", n:0 },
];
const INIT_TIPOS = [
  { id:"t1", tipo:"Sedán",      configuracion:"2 ejes · 4 neumáticos",  n:0 },
  { id:"t2", tipo:"Pick Up",    configuracion:"2 ejes · 4 neumáticos",  n:0 },
  { id:"t3", tipo:"Tractomula", configuracion:"3 ejes · 10 neumáticos", n:0 },
  { id:"t4", tipo:"Furgón",     configuracion:"2 ejes · 6 neumáticos",  n:0 },
  { id:"t5", tipo:"Autobús",    configuracion:"2 ejes · 6 neumáticos",  n:0 },
];



// ─── Brand icon ───────────────────────────────────────────────────────────────
function BrandIcon({ icono, size=12, color="#8B3DFF" }) {
  const s = { width:size, height:size, color };
  if (icono==="Truck") return <Truck style={s} />;
  if (icono==="Bus")   return <Bus   style={s} />;
  if (icono==="Bike")  return <Bike  style={s} />;
  return <Car style={s} />;
}

// ─── Donut CSS conic-gradient ─────────────────────────────────────────────────
function Donut({ data, total="$0" }) {
  const hasData = data.some(d => d.v > 0);
  const bg = hasData
    ? `conic-gradient(${(() => { let a=0; return data.map(s=>{ const p=a; a+=s.v; return `${s.c} ${p.toFixed(1)}% ${a.toFixed(1)}%`; }).join(","); })()})`
    : "#E5E7EB";
  return (
    <div style={{ width:150,height:150,borderRadius:"50%",background:bg,position:"relative",flexShrink:0 }}>
      <div style={{ position:"absolute",inset:26,background:"#FAF7FF",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <span style={{ fontSize:14,fontWeight:700,color:"#1f2937" }}>{total}</span>
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, foot, icon:Icon, color }) {
  return (
    <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)",padding:16,minHeight:96,display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
        <span style={{ fontSize:12,color:"#6B7280",lineHeight:1.2,maxWidth:"70%" }}>{label}</span>
        <Icon style={{ width:22,height:22,color,flexShrink:0,marginLeft:4 }} />
      </div>
      <div>
        <div style={{ fontSize:30,fontWeight:700,color:"#111827" }}>{value}</div>
        {foot && <div style={{ fontSize:12,color:"#6B7280",marginTop:4 }}>{foot}</div>}
      </div>
    </div>
  );
}

// ─── Filter field (underline) ──────────────────────────────────────────────────
function FilterField({ label, dropdown, value, onChange, options }) {
  const base = { border:"none",outline:"none",background:"transparent",fontSize:13,color:value?"#374151":"#9ca3af",flex:1 };
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #D5D8DE",paddingBottom:4 }}>
      {dropdown && options
        ? <select value={value} onChange={e=>onChange(e.target.value)} style={{ ...base,cursor:"pointer" }}>
            <option value="">{label}</option>
            {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
          </select>
        : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={label} style={base} />
      }
      {dropdown && <ChevronDown style={{ width:15,height:15,color:"#9ca3af",flexShrink:0 }} />}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <span style={{ fontSize:13,color:"#6B7280" }}>{label}</span>
      <div onClick={()=>onChange(!checked)} style={{ width:42,height:22,borderRadius:999,background:checked?"#14B8A6":"#E5E7EB",padding:2,display:"flex",justifyContent:checked?"flex-end":"flex-start",cursor:"pointer",transition:"background .2s" }}>
        <div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#DC2626" }}>{!checked&&"✕"}</div>
      </div>
    </div>
  );
}

// ─── Estado selector (colored pills) ─────────────────────────────────────────
function EstadoSelector({ value, onChange, disabled }) {
  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:4 }}>
        {ESTADOS.map(e => {
          const active = (value||"OPERATIVO").toUpperCase() === e.value;
          return (
            <button key={e.value} type="button" disabled={disabled}
              onClick={() => !disabled && onChange(e.value)}
              style={{
                display:"flex",alignItems:"center",gap:6,padding:"7px 10px",borderRadius:8,cursor:disabled?"default":"pointer",
                border: active ? `2px solid ${e.bg}` : "2px solid transparent",
                background: active ? `${e.bg}18` : "#F9FAFB",
                transition:"all .15s"
              }}>
              <span style={{ width:10,height:10,borderRadius:"50%",background:e.bg,flexShrink:0 }} />
              <span style={{ fontSize:12,fontWeight: active?700:500,color: active?e.bg:"#6B7280",whiteSpace:"nowrap" }}>{e.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth=500 }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.45)",padding:16 }} onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.2)",width:"100%",maxWidth,maxHeight:"90vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:"1px solid #F0F0F3",position:"sticky",top:0,background:"#fff",zIndex:1 }}>
          <span style={{ fontWeight:700,fontSize:16,color:"#1f2937" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"#6B7280" }}><X style={{ width:20,height:20 }} /></button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

const inputSt = { width:"100%",border:"1px solid #D1D5DB",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",color:"#374151",marginTop:4,boxSizing:"border-box" };
const labelSt = { fontSize:11,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:2 };

// ─── Action button row ────────────────────────────────────────────────────────
function ActionBtns({ onView, onEdit, onCopy, onWrench, onDelete }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
      {[
        { Ic:Eye,         fn:onView,   title:"Ver" },
        { Ic:Pencil,      fn:onEdit,   title:"Editar" },
        { Ic:Copy,        fn:onCopy,   title:"Duplicar" },
        { Ic:Wrench,      fn:onWrench, title:"Mantenimiento" },
        { Ic:CalendarDays,fn:onDelete, title:"Eliminar" },
      ].map(({ Ic, fn, title }, j) => (
        <button key={j} onClick={fn} title={title}
          style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:0,transition:"color .15s" }}
          onMouseEnter={e=>e.currentTarget.style.color="#8B3DFF"}
          onMouseLeave={e=>e.currentTarget.style.color="#9ca3af"}>
          <Ic style={{ width:15,height:15 }} />
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════ MAIN ══════════════════════════════════════
export default function Vehiculos() {
  const { user } = useAuth();

  const [tab, setTab]             = useState("vehiculos");
  const [catTab, setCatTab]       = useState("Marcas");
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [errMsg, setErrMsg]       = useState("");

  // data
  const [vehiculos, setVehiculos]     = useState([]);
  const [conductores, setConductores] = useState([]);

  // vehicle modal
  const [vModal, setVModal] = useState(null); // null|"create"|"edit"
  const [vForm, setVForm]   = useState({});

  // catalog state (local)
  const [marcas, setMarcas]   = useState(INIT_MARCAS);
  const [modelos, setModelos] = useState(INIT_MODELOS);
  const [tipos, setTipos]     = useState(INIT_TIPOS);

  // catalog modal
  const [catModal, setCatModal] = useState(null);
  const [catForm, setCatForm]   = useState({});

  // filters
  const [q, setQ]               = useState("");
  const [fMarca, setFMarca]     = useState("");
  const [fEstado, setFEstado]   = useState("");
  const [fUnidad, setFUnidad]   = useState("");
  const [fChasis, setFChasis]   = useState("");
  const [fModelo, setFModelo]   = useState("");
  const [fTipo, setFTipo]       = useState("");
  const [fBase, setFBase]       = useState("");
  const [fTitular, setFTitular] = useState("");
  const [fFuncion, setFFuncion] = useState("");
  const [fCC, setFCC]           = useState("");
  const [fMedMin, setFMedMin]   = useState("");
  const [fMedMax, setFMedMax]   = useState("");
  const [fInact, setFInact]     = useState(false);
  const [fPers, setFPers]       = useState(false);

  // ── API ──
  async function loadAll() {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        api.get("/vehiculos"),
        api.get("/conductores").catch(()=>({ data:[] }))
      ]);
      const real = (v.data||[]);
      setVehiculos(real.length > 0 ? real : []);
      setConductores(c.data||[]);
    } catch {
      setVehiculos([]);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ loadAll(); }, []);

  // ── Filtered list ──
  const lista = useMemo(()=>{
    const qq = q.trim().toLowerCase();
    return vehiculos.filter(v=>{
      if (qq && !`${v.placa||""} ${v.marca||""} ${v.modelo||""} ${v.veh||""} ${v.unidad||""}`.toLowerCase().includes(qq)) return false;
      if (fMarca  && (v.marca||"").toLowerCase()!==fMarca.toLowerCase()) return false;
      if (fEstado && (v.estado||"").toLowerCase()!==fEstado.toLowerCase()) return false;
      if (fUnidad && !(String(v.unidad||"")).toLowerCase().includes(fUnidad.toLowerCase())) return false;
      if (fChasis && !(String(v.chasis||"")).toLowerCase().includes(fChasis.toLowerCase())) return false;
      if (fModelo && !(String(v.modelo||"")).toLowerCase().includes(fModelo.toLowerCase())) return false;
      if (fTipo   && !(String(v.tipo||"")).toLowerCase().includes(fTipo.toLowerCase())) return false;
      if (fBase   && !(String(v.base||"")).toLowerCase().includes(fBase.toLowerCase())) return false;
      if (fTitular&& !(String(v.titular||"")).toLowerCase().includes(fTitular.toLowerCase())) return false;
      if (fCC     && !(String(v.cc||"")).toLowerCase().includes(fCC.toLowerCase())) return false;
      if (!fInact && (String(v.estado||"")).toUpperCase()==="INACTIVO") return false;
      return true;
    });
  }, [vehiculos,q,fMarca,fEstado,fUnidad,fChasis,fModelo,fTipo,fBase,fTitular,fCC,fInact]);

  // ── Vehicle CRUD ──
  function openVCreate() { setErrMsg(""); setVForm({ estado:"OPERATIVO" }); setVModal("create"); }
  function openVEdit(v)  { setErrMsg(""); setVForm({ ...v }); setVModal("edit"); }

  async function handleVSave(e) {
    e.preventDefault();
    setSaving(true); setErrMsg("");
    try {
      const body = { ...vForm };
      if (body.año) body.año = parseInt(body.año, 10) || undefined;
      const id = body.id || body._id;
      delete body._id;
      if (vModal === "edit") {
        await api.put(`/vehiculos/${id}`, body);
      } else {
        await api.post("/vehiculos", body);
      }
      setVModal(null); setVForm({});
      await loadAll();
    } catch(e2) { setErrMsg(e2?.response?.data?.detail || "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleVDelete(id) {
    if (!window.confirm("¿Eliminar este vehículo?")) return;
    try { await api.delete(`/vehiculos/${id}`); await loadAll(); }
    catch(e) { alert(e?.response?.data?.detail || "Error al eliminar"); }
  }

  // ── Catalog CRUD (local) ──
  function openCatCreate(type) {
    const d = type==="marca"  ? { marca:"",  n:0, estado:"Activo", icono:"Car" }
             : type==="modelo" ? { modelo:"", marca:"", tipo:"", n:0 }
             :                   { tipo:"",   configuracion:"", n:0 };
    setCatForm(d); setCatModal({ type, mode:"create" });
  }
  function openCatEdit(type, data)  { setCatForm({...data}); setCatModal({ type, mode:"edit", id:data.id }); }
  function openCatView(type, data)  { setCatForm({...data}); setCatModal({ type, mode:"view" }); }

  function handleCatSave(e) {
    e.preventDefault();
    const { type, mode, id } = catModal;
    if (type==="marca") {
      if (mode==="create") setMarcas(p=>[...p, { ...catForm, id:`m${Date.now()}` }]);
      else setMarcas(p=>p.map(m=>m.id===id ? { ...catForm, id } : m));
    } else if (type==="modelo") {
      if (mode==="create") setModelos(p=>[...p, { ...catForm, id:`mo${Date.now()}` }]);
      else setModelos(p=>p.map(m=>m.id===id ? { ...catForm, id } : m));
    } else {
      if (mode==="create") setTipos(p=>[...p, { ...catForm, id:`t${Date.now()}` }]);
      else setTipos(p=>p.map(t=>t.id===id ? { ...catForm, id } : t));
    }
    setCatModal(null);
  }

  function handleCatDelete(type, id) {
    if (!window.confirm("¿Eliminar este registro?")) return;
    if (type==="marca")  setMarcas(p=>p.filter(m=>m.id!==id));
    if (type==="modelo") setModelos(p=>p.filter(m=>m.id!==id));
    if (type==="tipo")   setTipos(p=>p.filter(t=>t.id!==id));
  }

  function handleCatCopy(type, data) {
    const key = type==="marca"?"marca":type==="modelo"?"modelo":"tipo";
    const copy = { ...data, id:`${type[0]}c${Date.now()}`, [key]: data[key]+" (copia)" };
    if (type==="marca")  setMarcas(p=>[...p, copy]);
    if (type==="modelo") setModelos(p=>[...p, copy]);
    if (type==="tipo")   setTipos(p=>[...p, copy]);
  }

  // ── Exports ──
  function exportExcel() {
    const rows = lista.map(v=>({ Placa:v.veh||v.placa, Marca:v.marca||"", Modelo:v.modelo||"", Tipo:v.tipo||"", Estado:v.estado||"" }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Vehiculos");
    XLSX.writeFile(wb, `vehiculos_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  function exportPDF() {
    const doc = new jsPDF({ orientation:"landscape" });
    doc.setFontSize(14); doc.text("ENERED — Administración de Vehículos",14,14);
    let y=24;
    const line=(cols,bold)=>{ doc.setFont(undefined,bold?"bold":"normal"); cols.forEach((c,i)=>doc.text(String(c??""),14+i*48,y)); y+=6; if(y>195){doc.addPage();y=14;} };
    line(["Placa","Marca","Modelo","Tipo","Estado"],true);
    lista.forEach(v=>line([v.veh||v.placa||"",v.marca||"",v.modelo||"",v.tipo||"",v.estado||""]));
    doc.save(`vehiculos_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // ══════════════════════════════ RENDER ══════════════════════════════════════
  return (
    <div style={{ padding:"20px 24px",background:"#F3F4F6",minHeight:"100%" }} data-testid="page-vehiculos">

      {/* TABS */}
      <div style={{ display:"flex",alignItems:"center",gap:32,borderBottom:"1px solid #E5E7EB",marginBottom:20 }}>
        {[["vehiculos","Vehículos"],["catalogos","Catálogos"],["dispositivos","Dispositivos GPS"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ position:"relative",paddingBottom:12,fontSize:15,fontWeight:tab===id?700:500,color:tab===id?"#8B3DFF":"#6B7280",background:"none",border:"none",cursor:"pointer" }}>
            {lbl}{tab===id&&<span style={{ position:"absolute",left:0,right:0,bottom:-1,height:2.5,borderRadius:2,background:"#8B3DFF" }}/>}
          </button>
        ))}
      </div>

      {/* ══════════ VEHÍCULOS ══════════ */}
      {tab==="vehiculos"&&(<>

        {/* KPIs — todos en 0 hasta conectar */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:16,marginBottom:16 }}>
          <KpiCard label="GPS" value="0" foot="Sin GPS" icon={MapPin} color="#14B8A6" />
          <KpiCard label="En Taller"                icon={Warehouse}  color="#F26B6B" value="0" />
          <KpiCard label="Doc. Vehículo Vencida"    icon={FileText}   color="#F26B6B" value="0" />
          <KpiCard label="Doc. Chofer Vencida"      icon={UserCheck}  color="#F26B6B" value="0" />
          <KpiCard label="Vh. con Infracciones"     icon={Shield}     color="#F26B6B" value="0" />
          <KpiCard label="Vh. con Cargas Inválidas" icon={Fuel}       color="#F26B6B" value="0" />
        </div>

        {/* FABs */}
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:panelOpen?0:12 }}>
          <button onClick={openVCreate} style={{ width:52,height:52,borderRadius:"50%",background:"#14B8A6",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.18)" }}>
            <Plus style={{ width:26,height:26 }} />
          </button>
          <button onClick={()=>setPanelOpen(p=>!p)} style={{ width:44,height:44,borderRadius:"50%",background:"#1F2937",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.18)" }}>
            <ChevronDown style={{ width:20,height:20,transform:panelOpen?"rotate(180deg)":"none",transition:"transform .2s" }} />
          </button>
        </div>

        {/* Filter Panel */}
        {panelOpen&&(
          <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)",padding:22,marginBottom:16 }}>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:12,marginBottom:14 }}>
              <button onClick={exportExcel} style={{ width:34,height:34,border:"none",borderRadius:8,background:"#F3F4F6",color:"#6b7280",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Upload style={{ width:16,height:16 }}/></button>
              <button onClick={exportPDF}   style={{ width:34,height:34,border:"none",borderRadius:8,background:"#F3F4F6",color:"#6b7280",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Download style={{ width:16,height:16 }}/></button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"22px 32px" }}>
              <FilterField label="Marca"    dropdown value={fMarca}  onChange={setFMarca}   options={["Chevrolet","Ford","Mercedes-Benz","Kenworth","Volvo"]} />
              <FilterField label="Estados"  dropdown value={fEstado} onChange={setFEstado}  options={ESTADOS.map(e=>({ value:e.value, label:e.label }))} />
              <FilterField label="Unidad"           value={fUnidad}  onChange={setFUnidad} />
              <FilterField label="Chasis"           value={fChasis}  onChange={setFChasis} />
              <FilterField label="Vehículo"         value={q}        onChange={setQ} />
              <FilterField label="Modelo"           value={fModelo}  onChange={setFModelo} />
              <FilterField label="Tipo"    dropdown value={fTipo}    onChange={setFTipo}    options={["SEDAN","PICK UP","FURGÓN","TRACTOMULA","AUTOBÚS"]} />
              <FilterField label="Base"    dropdown value={fBase}    onChange={setFBase}    options={["EPEC","VECFLEET","ACOZAC"]} />
              <FilterField label="Titular" dropdown value={fTitular} onChange={setFTitular} options={["Transp. Andes","Log. del Sur","APYMSA","Distrib. Lima"]} />
              <FilterField label="Función" dropdown value={fFuncion} onChange={setFFuncion} options={["Carga","Pasajeros","Servicio"]} />
              <FilterField label="Centro de Costos" dropdown value={fCC} onChange={setFCC} options={["100000 - SEDE CENTRAL","APYMSA -001"]} />
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                <FilterField label="Medidor desde" value={fMedMin} onChange={setFMedMin} />
                <FilterField label="Medidor hasta" value={fMedMax} onChange={setFMedMax} />
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginTop:22 }}>
              <div style={{ display:"flex",alignItems:"center",gap:32 }}>
                <Toggle label="Ver Inactivos"     checked={fInact} onChange={setFInact} />
                <Toggle label="Persistir Filtros" checked={fPers}  onChange={setFPers} />
              </div>
              <button onClick={()=>setPanelOpen(false)} style={{ display:"flex",alignItems:"center",gap:8,background:"#14B8A6",color:"#fff",border:"none",borderRadius:8,height:40,padding:"0 22px",fontSize:14,fontWeight:600,cursor:"pointer" }}>
                <Search style={{ width:16,height:16 }}/> Buscar
              </button>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)",overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1200 }}>
              <thead>
                <tr style={{ background:"#2A2A3C" }}>
                  {["","MARCA","ESTADO","UNIDAD","CHASIS","VEHÍCULO","MODELO","PRÓX. TAREA","TIPO","BASE","TITULAR","CENTRO DE COSTOS","MEDIDOR","ACTUALIZAR","ACCIONES"].map((h,i)=>(
                    <th key={i} style={{ textAlign:"left",color:"#fff",fontWeight:600,textTransform:"uppercase",fontSize:10.5,letterSpacing:".03em",padding:"12px 14px",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading?(
                  <tr><td colSpan={15} style={{ textAlign:"center",padding:40,color:"#9ca3af",fontSize:14 }}>Cargando...</td></tr>
                ):lista.length===0?(
                  <tr><td colSpan={15} style={{ textAlign:"center",padding:48,color:"#9ca3af",fontSize:14 }}>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10 }}>
                      <Car style={{ width:40,height:40,color:"#D1D5DB" }}/>
                      <span>No hay vehículos registrados aún</span>
                      <button onClick={openVCreate} style={{ marginTop:4,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                        <Plus style={{ width:14,height:14 }}/> Registrar primer vehículo
                      </button>
                    </div>
                  </td></tr>
                ):lista.map((v,i)=>{
                  const open=expanded===v.id;
                  const est=estadoStyle(v.estado);
                  return (
                    <React.Fragment key={v.id}>
                      <tr style={{ borderTop:i===0?"none":"1px solid #F3F4F6",background:open?"#FAF7FF":"transparent",transition:"background .15s" }}
                        onMouseEnter={e=>{ if(!open) e.currentTarget.style.background="#f9fafb"; }}
                        onMouseLeave={e=>{ if(!open) e.currentTarget.style.background=open?"#FAF7FF":"transparent"; }}>
                        <td style={{ padding:"10px 14px" }}><input type="checkbox"/></td>
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
                            <button onClick={()=>setExpanded(open?null:v.id)} style={{ background:"none",border:"none",cursor:"pointer",display:"flex",color:open?"#8B3DFF":"#9ca3af",padding:0 }}>
                              <ChevronDown style={{ width:15,height:15,transition:"transform .2s",transform:open?"rotate(180deg)":"none" }}/>
                            </button>
                            <div style={{ width:24,height:24,borderRadius:6,background:"#F1EAFF",display:"flex",alignItems:"center",justifyContent:"center" }}>
                              <Car style={{ width:12,height:12,color:"#8B3DFF" }}/>
                            </div>
                            <span style={{ color:"#374151",fontSize:12.5 }}>{v.marca||"—"}</span>
                          </div>
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ borderRadius:999,fontWeight:700,fontSize:9.5,padding:"3px 9px",color:est.text,background:est.bg,whiteSpace:"nowrap" }}>
                            {est.label||v.estado}
                          </span>
                        </td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#374151",fontWeight:500,whiteSpace:"nowrap" }}>{v.unidad||"—"}</td>
                        <td style={{ padding:"10px 14px",fontSize:12,color:"#6b7280",whiteSpace:"nowrap" }}>{v.chasis||"—"}</td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#374151",whiteSpace:"nowrap" }}>
                          {v.veh||v.placa||"—"}<span style={{ color:"#DC2626" }}> ●</span>
                        </td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#4b5563",whiteSpace:"nowrap" }}>{v.modelo||"—"}</td>
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex",gap:4 }}>
                            <b style={{ borderRadius:4,fontSize:9,fontWeight:700,padding:"1px 4px",color:"#fff",background:"#F26B6B" }}>P</b>
                            <b style={{ borderRadius:4,fontSize:9,fontWeight:700,padding:"1px 4px",color:"#fff",background:"#8B3DFF" }}>V</b>
                          </div>
                        </td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#4b5563",whiteSpace:"nowrap" }}>{v.tipo||"—"}</td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#4b5563",whiteSpace:"nowrap" }}>{v.base||"—"}</td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#4b5563",whiteSpace:"nowrap" }}>{v.titular||"—"}</td>
                        <td style={{ padding:"10px 14px",fontSize:12.5,color:"#4b5563",whiteSpace:"nowrap" }}>{v.cc||"—"}</td>
                        <td style={{ padding:"10px 14px" }}>
                          <div style={{ display:"flex",alignItems:"center",gap:4,color:"#4b5563",whiteSpace:"nowrap" }}>
                            <Clock style={{ width:13,height:13,color:"#9ca3af" }}/>
                            <span style={{ fontSize:12.5 }}>{v.kilometraje || 0} Kms</span>
                          </div>
                        </td>
                        <td style={{ padding:"10px 14px",minWidth:90 }}>
                          <div style={{ borderBottom:"1.5px solid #14B8A6",height:20,minWidth:80 }}/>
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <ActionBtns
                            onView={()=>openVEdit(v)}
                            onEdit={()=>openVEdit(v)}
                            onCopy={undefined}
                            onWrench={undefined}
                            onDelete={()=>handleVDelete(v.id)}
                          />
                        </td>
                      </tr>

                      {/* EXPANDED ROW */}
                      {open&&(
                        <tr><td colSpan={15} style={{ background:"#FAF7FF",borderTop:"1px solid #F1EAFF",padding:0 }}>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,padding:24 }}>
                            {/* LEFT: costo total (todo 0) */}
                            <div>
                              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
                                <b style={{ fontSize:18,color:"#1f2937" }}>Costo Total</b>
                                <span style={{ fontSize:12,color:"#9ca3af" }}>· Período: Todo</span>
                              </div>
                              <div style={{ display:"flex",alignItems:"center",gap:16 }}>
                                <Donut data={COSTO_COMP} total="$0"/>
                                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px",flex:1 }}>
                                  {COSTO_COMP.map((s,j)=>(
                                    <div key={j} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11 }}>
                                      <span style={{ display:"flex",alignItems:"center",gap:6,color:"#4b5563" }}>
                                        <span style={{ width:8,height:8,borderRadius:"50%",background:s.c,display:"inline-block" }}/>{s.name}
                                      </span>
                                      <span style={{ fontWeight:600,color:"#374151" }}>0%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {/* RIGHT: stats + controles */}
                            <div style={{ borderLeft:"1px solid #E5E7EB",paddingLeft:24 }}>
                              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
                                {[["$0","Costo/km"],["0","Promedio Km/Día"],["0","Recorrido Km"]].map(([val,sub],j)=>(
                                  <div key={j}>
                                    <div style={{ fontWeight:700,color:"#1f2937",fontSize:20 }}>{val}</div>
                                    <div style={{ fontSize:11,color:"#9ca3af" }}>{sub}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ borderRadius:999,background:"#E8ECEF",height:42,display:"flex",alignItems:"center",padding:"0 20px",marginBottom:12 }}>
                                <b style={{ fontSize:15,color:"#4b5563" }}>Controles</b>
                              </div>
                              <div style={{ display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
                                {CONTROLES.map((ctrl,j)=>{
                                  const CIcon=ctrl.icon;
                                  return (
                                    <button key={j} title={ctrl.label} style={{ width:48,height:48,borderRadius:"50%",background:"#fff",border:"1px solid #EEF0F2",boxShadow:"0 1px 2px rgba(0,0,0,.05)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                                      <CIcon style={{ width:20,height:20,color:ctrl.color }}/>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:16,height:48,padding:"0 16px",borderTop:"1px solid #F3F4F6",fontSize:12.5,color:"#6B7280" }}>
            <span>Mostrar 10</span>
            <span>Mostrando 1 a {lista.length} de {vehiculos.length}</span>
          </div>
        </div>
      </>)}

      {/* ══════════ CATÁLOGOS ══════════ */}
      {tab==="catalogos"&&(
        <div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",gap:4,background:"#fff",border:"1px solid #F0F0F3",borderRadius:999,padding:4 }}>
              {["Marcas","Modelos","Tipos de vehículo"].map(x=>(
                <button key={x} onClick={()=>setCatTab(x)} style={{ border:"none",borderRadius:999,fontSize:13,fontWeight:500,padding:"7px 16px",cursor:"pointer",background:catTab===x?"#8B3DFF":"none",color:catTab===x?"#fff":"#6B7280" }}>{x}</button>
              ))}
            </div>
            <button onClick={()=>openCatCreate(catTab==="Marcas"?"marca":catTab==="Modelos"?"modelo":"tipo")}
              style={{ display:"flex",alignItems:"center",gap:8,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:8,height:38,padding:"0 16px",fontSize:13,fontWeight:600,cursor:"pointer" }}>
              <Plus style={{ width:16,height:16 }}/> Agregar {catTab==="Marcas"?"marca":catTab==="Modelos"?"modelo":"tipo"}
            </button>
          </div>
          <div style={{ display:"flex",alignItems:"flex-start",gap:8,background:"#F1EAFF",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12.5,color:"#4b5563" }}>
            <Tag style={{ width:15,height:15,color:"#8B3DFF",marginTop:1,flexShrink:0 }}/>
            <span>Estos catálogos son de baja frecuencia: al registrar un vehículo con su <b>VIN/Chasis</b>, la marca y el modelo se autocompletan. También puedes crearlos al vuelo desde la ficha del vehículo.</span>
          </div>

          <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
            {catTab==="Marcas"&&(
              <table style={{ borderCollapse:"collapse",width:"100%" }}>
                <thead><tr style={{ background:"#2A2A3C" }}>
                  {["Marca","N° de vehículos","Icono","Estado","Acciones"].map((h,i)=>(
                    <th key={i} style={{ textAlign:"left",color:"#fff",fontWeight:600,textTransform:"uppercase",fontSize:10.5,letterSpacing:".03em",padding:"12px 18px",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{marcas.map((m,i)=>(
                  <tr key={m.id} style={{ borderTop:i>0?"1px solid #F3F4F6":"none" }}>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ width:28,height:28,borderRadius:6,background:"#F1EAFF",display:"flex",alignItems:"center",justifyContent:"center" }}>
                          <BrandIcon icono={m.icono}/>
                        </div>
                        <span style={{ fontWeight:600,color:"#374151",fontSize:13.5 }}>{m.marca}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 18px",color:"#4b5563",fontSize:13.5 }}>{m.n}</td>
                    <td style={{ padding:"12px 18px",fontSize:12,color:"#6B7280" }}>{m.icono}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:6,borderRadius:999,fontWeight:600,fontSize:11,padding:"3px 10px",color:m.estado==="Activo"?"#059669":"#6B7280",background:m.estado==="Activo"?"#ECFDF5":"#F3F4F6" }}>{m.estado}</span>
                    </td>
                    <td style={{ padding:"12px 18px" }}>
                      <ActionBtns onView={()=>openCatView("marca",m)} onEdit={()=>openCatEdit("marca",m)} onCopy={()=>handleCatCopy("marca",m)} onWrench={()=>openCatEdit("marca",m)} onDelete={()=>handleCatDelete("marca",m.id)}/>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}

            {catTab==="Modelos"&&(
              <table style={{ borderCollapse:"collapse",width:"100%" }}>
                <thead><tr style={{ background:"#2A2A3C" }}>
                  {["Modelo","Marca","Tipo de vehículo","N° vehículos","Acciones"].map((h,i)=>(
                    <th key={i} style={{ textAlign:"left",color:"#fff",fontWeight:600,textTransform:"uppercase",fontSize:10.5,letterSpacing:".03em",padding:"12px 18px",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{modelos.map((m,i)=>(
                  <tr key={m.id} style={{ borderTop:i>0?"1px solid #F3F4F6":"none" }}>
                    <td style={{ padding:"12px 18px",fontWeight:600,color:"#374151",fontSize:13.5 }}>{m.modelo}</td>
                    <td style={{ padding:"12px 18px",color:"#4b5563",fontSize:13.5 }}>{m.marca}</td>
                    <td style={{ padding:"12px 18px" }}><span style={{ borderRadius:999,fontSize:11.5,padding:"3px 10px",color:"#7A2FF0",background:"#F1EAFF" }}>{m.tipo}</span></td>
                    <td style={{ padding:"12px 18px",color:"#4b5563",fontSize:13.5 }}>{m.n}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <ActionBtns onView={()=>openCatView("modelo",m)} onEdit={()=>openCatEdit("modelo",m)} onCopy={()=>handleCatCopy("modelo",m)} onWrench={()=>openCatEdit("modelo",m)} onDelete={()=>handleCatDelete("modelo",m.id)}/>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}

            {catTab==="Tipos de vehículo"&&(
              <table style={{ borderCollapse:"collapse",width:"100%" }}>
                <thead><tr style={{ background:"#2A2A3C" }}>
                  {["Tipo de vehículo","Configuración","N° vehículos","Acciones"].map((h,i)=>(
                    <th key={i} style={{ textAlign:"left",color:"#fff",fontWeight:600,textTransform:"uppercase",fontSize:10.5,letterSpacing:".03em",padding:"12px 18px",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{tipos.map((t,i)=>(
                  <tr key={t.id} style={{ borderTop:i>0?"1px solid #F3F4F6":"none" }}>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <Layers style={{ width:15,height:15,color:"#8B3DFF" }}/>
                        <span style={{ fontWeight:600,color:"#374151",fontSize:13.5 }}>{t.tipo}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 18px",color:"#4b5563",fontSize:13.5 }}>{t.configuracion}</td>
                    <td style={{ padding:"12px 18px",color:"#4b5563",fontSize:13.5 }}>{t.n}</td>
                    <td style={{ padding:"12px 18px" }}>
                      <ActionBtns onView={()=>openCatView("tipo",t)} onEdit={()=>openCatEdit("tipo",t)} onCopy={()=>handleCatCopy("tipo",t)} onWrench={()=>openCatEdit("tipo",t)} onDelete={()=>handleCatDelete("tipo",t.id)}/>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════ DISPOSITIVOS GPS ══════════ */}
      {tab==="dispositivos"&&(
        <div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:16 }}>
            {[
              { label:"Dispositivos",v:"0",icon:Cpu,    color:"#8B3DFF",bg:"#F1EAFF" },
              { label:"Reportando",  v:"0",icon:Wifi,   color:"#059669",bg:"#ECFDF5" },
              { label:"No reportan", v:"0",icon:WifiOff,color:"#DC2626",bg:"#FEF2F2" },
              { label:"Sin asignar", v:"0",icon:Unlink, color:"#B45309",bg:"#FFFBEB" },
            ].map((k,i)=>{ const KIc=k.icon; return (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:16,background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)" }}>
                <div style={{ width:42,height:42,borderRadius:12,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <KIc style={{ width:21,height:21,color:k.color }}/>
                </div>
                <div>
                  <div style={{ fontSize:26,fontWeight:700,color:"#111827",lineHeight:1 }}>{k.v}</div>
                  <div style={{ fontSize:12.5,color:"#6B7280",marginTop:4 }}>{k.label}</div>
                </div>
              </div>
            ); })}
          </div>
          <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:14 }}>
            <button style={{ display:"flex",alignItems:"center",gap:8,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:8,height:38,padding:"0 16px",fontSize:13,fontWeight:600,cursor:"pointer" }}>
              <Plus style={{ width:16,height:16 }}/> Registrar dispositivo
            </button>
          </div>
          <div style={{ padding:"60px 20px",textAlign:"center",background:"#fff",borderRadius:16,border:"1px dashed #D1D5DB" }}>
            <Cpu style={{ width:40,height:40,color:"#D1D5DB",marginBottom:12 }}/>
            <div style={{ fontSize:16,fontWeight:600,color:"#374151" }}>Módulo en construcción</div>
            <div style={{ fontSize:13.5,color:"#6B7280",marginTop:4,maxWidth:400,margin:"4px auto 0" }}>Pronto podrás gestionar tus dispositivos GPS desde aquí.</div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL VEHÍCULO ═══════════ */}
      <Modal open={!!vModal} onClose={()=>setVModal(null)} title={vModal==="edit"?"Editar Vehículo":"Registrar Vehículo"} maxWidth={560}>
        <form onSubmit={handleVSave} style={{ display:"flex",flexDirection:"column",gap:14 }}>

          {/* Sección 1: Identificación */}
          <div style={{ padding:"10px 12px",background:"#F9FAFB",borderRadius:8,marginBottom:2 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#8B3DFF",textTransform:"uppercase",letterSpacing:".06em" }}>Identificación</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div>
              <label style={labelSt}>Placa *</label>
              <input required maxLength={8} value={vForm.placa||""} placeholder="Ej: ABC-123"
                onChange={e=>setVForm({...vForm,placa:e.target.value.toUpperCase().trim()})} style={inputSt}/>
            </div>
            <div>
              <label style={labelSt}>Chasis / VIN</label>
              <input value={vForm.chasis||""} placeholder="Ej: VF37H9HF3JJ519998"
                onChange={e=>setVForm({...vForm,chasis:e.target.value.trim()})} style={inputSt}/>
            </div>
            <div>
              <label style={labelSt}>Unidad</label>
              <input value={vForm.unidad||""} placeholder="Ej: 567"
                onChange={e=>setVForm({...vForm,unidad:e.target.value})} style={inputSt}/>
            </div>
            <div>
              <label style={labelSt}>Año</label>
              <input type="number" value={vForm.año||""} placeholder="Ej: 2024" min={1900} max={2100}
                onChange={e=>setVForm({...vForm,año:e.target.value})} style={inputSt}/>
            </div>
          </div>

          {/* Sección 2: Vehículo */}
          <div style={{ padding:"10px 12px",background:"#F9FAFB",borderRadius:8,marginBottom:2 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#8B3DFF",textTransform:"uppercase",letterSpacing:".06em" }}>Datos del Vehículo</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div>
              <label style={labelSt}>Marca</label>
              <input value={vForm.marca||""} placeholder="Ej: Toyota"
                onChange={e=>setVForm({...vForm,marca:e.target.value})} style={inputSt}/>
            </div>
            <div>
              <label style={labelSt}>Modelo</label>
              <input value={vForm.modelo||""} placeholder="Ej: Hilux"
                onChange={e=>setVForm({...vForm,modelo:e.target.value})} style={inputSt}/>
            </div>
            <div>
              <label style={labelSt}>Tipo</label>
              <select value={vForm.tipo||""} onChange={e=>setVForm({...vForm,tipo:e.target.value})} style={inputSt}>
                <option value="">Seleccionar...</option>
                {["SEDAN","PICK UP","FURGÓN","TRACTOMULA","AUTOBÚS","CAMIÓN"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Base</label>
              <input value={vForm.base||""} placeholder="Ej: EPEC"
                onChange={e=>setVForm({...vForm,base:e.target.value})} style={inputSt}/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={labelSt}>Titular</label>
              <input value={vForm.titular||""} placeholder="Ej: Transportes Andes"
                onChange={e=>setVForm({...vForm,titular:e.target.value})} style={inputSt}/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={labelSt}>Centro de Costos</label>
              <input value={vForm.cc||""} placeholder="Ej: 100000 - SEDE CENTRAL"
                onChange={e=>setVForm({...vForm,cc:e.target.value})} style={inputSt}/>
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={labelSt}>Kilometraje</label>
              <input type="number" value={vForm.kilometraje||""} placeholder="Ej: 150000"
                onChange={e=>setVForm({...vForm,kilometraje:parseInt(e.target.value)||0})} style={inputSt}/>
            </div>
          </div>

          {/* Sección 3: Estado */}
          <div style={{ padding:"10px 12px",background:"#F9FAFB",borderRadius:8,marginBottom:2 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#8B3DFF",textTransform:"uppercase",letterSpacing:".06em" }}>Estado del Vehículo</span>
          </div>
          <EstadoSelector value={vForm.estado||"OPERATIVO"} onChange={v=>setVForm(f=>({...f,estado:v}))}/>

          {/* Sección 4: Conductor */}
          <div style={{ padding:"10px 12px",background:"#F9FAFB",borderRadius:8,marginBottom:2 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#8B3DFF",textTransform:"uppercase",letterSpacing:".06em" }}>Conductor Principal</span>
          </div>
          <div>
            <select value={vForm.conductor_principal_id||""} onChange={e=>setVForm({...vForm,conductor_principal_id:e.target.value})} style={inputSt}>
              <option value="">Sin conductor asignado</option>
              {conductores.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellidos}</option>)}
            </select>
          </div>

          {errMsg&&<div style={{ color:"#DC2626",fontSize:12,fontWeight:600,background:"#FEF2F2",padding:"8px 12px",borderRadius:8 }}>{errMsg}</div>}

          <div style={{ display:"flex",justifyContent:"flex-end",gap:8,borderTop:"1px solid #F0F0F3",paddingTop:14 }}>
            <button type="button" onClick={()=>setVModal(null)} style={{ padding:"8px 16px",border:"1px solid #D1D5DB",borderRadius:8,fontSize:13,fontWeight:600,color:"#374151",background:"#fff",cursor:"pointer" }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ padding:"8px 24px",background:"#8B3DFF",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",opacity:saving?.6:1 }}>
              {saving?"Guardando...":"Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ MODAL CATÁLOGO ═══════════ */}
      <Modal open={!!catModal} onClose={()=>setCatModal(null)}
        title={catModal?.mode==="view"?"Ver detalle":catModal?.mode==="edit"?"Editar registro":"Nuevo registro"}>
        {catModal&&(
          <form onSubmit={catModal.mode==="view"?e=>{e.preventDefault();setCatModal(null);}:handleCatSave}
            style={{ display:"flex",flexDirection:"column",gap:14 }}>

            {catModal.type==="marca"&&(<>
              <div>
                <label style={labelSt}>Nombre de Marca *</label>
                <input required value={catForm.marca||""} placeholder="Ej: Toyota" readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,marca:e.target.value})} style={inputSt}/>
              </div>
              <div>
                <label style={labelSt}>N° de Vehículos</label>
                <input type="number" value={catForm.n||0} readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,n:parseInt(e.target.value)||0})} style={inputSt}/>
              </div>
              <div>
                <label style={labelSt}>Icono representativo</label>
                <select value={catForm.icono||"Car"} disabled={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,icono:e.target.value})} style={inputSt}>
                  {["Car","Truck","Bus","Bike"].map(o=><option key={o}>{o}</option>)}
                </select>
                <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#F9FAFB",borderRadius:8 }}>
                  <span style={{ fontSize:12,color:"#6B7280" }}>Vista previa:</span>
                  <div style={{ width:32,height:32,borderRadius:8,background:"#F1EAFF",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <BrandIcon icono={catForm.icono||"Car"} size={16}/>
                  </div>
                </div>
              </div>
              <div>
                <label style={labelSt}>Estado</label>
                <select value={catForm.estado||"Activo"} disabled={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,estado:e.target.value})} style={inputSt}>
                  {["Activo","Inactivo"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </>)}

            {catModal.type==="modelo"&&(<>
              <div>
                <label style={labelSt}>Nombre del Modelo *</label>
                <input required value={catForm.modelo||""} placeholder="Ej: Hilux" readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,modelo:e.target.value})} style={inputSt}/>
              </div>
              <div>
                <label style={labelSt}>Marca</label>
                <input value={catForm.marca||""} placeholder="Ej: Toyota" readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,marca:e.target.value})} style={inputSt}/>
              </div>
              <div>
                <label style={labelSt}>Tipo de Carrocería</label>
                <select value={catForm.tipo||""} disabled={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,tipo:e.target.value})} style={inputSt}>
                  <option value="">Seleccionar...</option>
                  {["Sedán","Pick Up","Furgón","Tractomula","Autobús"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>N° de Vehículos</label>
                <input type="number" value={catForm.n||0} readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,n:parseInt(e.target.value)||0})} style={inputSt}/>
              </div>
            </>)}

            {catModal.type==="tipo"&&(<>
              <div>
                <label style={labelSt}>Tipo de Vehículo *</label>
                <input required value={catForm.tipo||""} placeholder="Ej: Pick Up" readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,tipo:e.target.value})} style={inputSt}/>
              </div>
              <div>
                <label style={labelSt}>Configuración</label>
                <input value={catForm.configuracion||""} placeholder="Ej: 2 ejes · 4 neumáticos" readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,configuracion:e.target.value})} style={inputSt}/>
              </div>
              <div>
                <label style={labelSt}>N° de Vehículos</label>
                <input type="number" value={catForm.n||0} readOnly={catModal.mode==="view"}
                  onChange={e=>setCatForm({...catForm,n:parseInt(e.target.value)||0})} style={inputSt}/>
              </div>
            </>)}

            <div style={{ display:"flex",justifyContent:"flex-end",gap:8,borderTop:"1px solid #F0F0F3",paddingTop:14 }}>
              <button type="button" onClick={()=>setCatModal(null)} style={{ padding:"8px 16px",border:"1px solid #D1D5DB",borderRadius:8,fontSize:13,fontWeight:600,color:"#374151",background:"#fff",cursor:"pointer" }}>
                {catModal.mode==="view"?"Cerrar":"Cancelar"}
              </button>
              {catModal.mode!=="view"&&(
                <button type="submit" style={{ padding:"8px 20px",background:"#8B3DFF",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer" }}>Guardar</button>
              )}
            </div>
          </form>
        )}
      </Modal>

      <div style={{ textAlign:"center",color:"#9ca3af",fontSize:11,padding:"24px 0 8px" }}>
        ENERED | Red Inteligente de Energías &nbsp;I Copyright © 2024 I Energix Peru I Todos los derechos son reservados.
      </div>
    </div>
  );
}
