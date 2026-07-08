import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  FileText, CheckCircle2, Clock, AlertTriangle, Plus, Download,
  ChevronDown, Calendar, Users, Truck, Tag, User, Activity,
  LayoutTemplate, MoreHorizontal, X, Route, Building2,
  Car, UploadCloud, Archive, RotateCcw, Trash2, Eye,
  Sparkles, Folder, Files, Loader2
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// ─── Data ─────────────────────────────────────────────────────────────────────
const SEED = {
  "Vehículos": [],
  "Personal": [
    { id:"30001", tipo:"Personal",      doc:"Licencia de conducir",   por:"Cindy Coach",  el:"02/01/25", emi:"15/03/24", ven:"15/03/27", atr:"—",       est:"Vigente", veh:1, grp:0, all:0, archived:0 },
    { id:"30002", tipo:"Personal",      doc:"Certificado médico",     por:"Bisma Ishfaq", el:"10/01/25", emi:"10/01/25", ven:"10/01/26", atr:"5 meses", est:"Vencido", veh:1, grp:0, all:0, archived:0 },
    { id:"30003", tipo:"Personal",      doc:"Antecedentes penales",   por:"Atif Safeer",  el:"20/02/25", emi:"20/02/25", ven:"20/08/26", atr:"—",       est:"Próximo", veh:0, grp:3, all:0, archived:0 },
  ],
  "Viajes": [
    { id:"40001", tipo:"Viajes", doc:"Guía de remisión",    por:"Cindy Coach",  el:"01/06/26", emi:"01/06/26", ven:"01/07/26", atr:"—",       est:"Vigente", veh:1, grp:0, all:0, archived:0 },
    { id:"40002", tipo:"Viajes", doc:"Manifiesto de carga", por:"Anwesha Ch.",  el:"20/05/26", emi:"20/05/26", ven:"20/05/26", atr:"10 días", est:"Vencido", veh:2, grp:0, all:0, archived:0 },
  ],
  "Empresa": [],
};

const TEMPLATES_INIT = [
  { id:"tp1", nombre:"Seguro vehicular",  tipo:"Vehículo",  campos:6, por:"Cindy Coach",  est:"Activa"  },
  { id:"tp2", nombre:"SOAT",              tipo:"Vehículo",  campos:5, por:"Bisma Ishfaq", est:"Activa"  },
  { id:"tp3", nombre:"Licencia de conducir", tipo:"Personal", campos:7, por:"Atif Safeer",  est:"Activa"  },
  { id:"tp4", nombre:"Guía de remisión",  tipo:"Viaje",     campos:4, por:"Anwesha Ch.",  est:"Borrador"},
];

const DOCTYPES = [
  ["Reporte de inspección anual",       true ],
  ["Tarjeta de cabina prorrateada",     true ],
  ["Registro de activo",                false],
  ["Documento de vehículo comercial",   true ],
  ["Documento de vehículo personalizado",false],
  ["Tarjeta de identificación de seguro",true ],
  ["Permiso",                           true ],
  ["Seguro vehicular",                  false],
  ["Tarjeta de propiedad",              false],
];

const ADD_OPTS = ["Documento de vehículo","Documento de viaje","Documento de empresa","Otro documento"];

const TABS = [
  { key:"Vehículos", icon:Car },
  { key:"Personal",  icon:Users },
  { key:"Viajes",    icon:Route },
  { key:"Empresa",   icon:Building2 },
  { key:"Plantilla", icon:LayoutTemplate },
];

// ─── Estado pill helper ───────────────────────────────────────────────────────
const EST_STYLES = {
  Vigente:  { color:"#059669", bg:"#ECFDF5" },
  Vencido:  { color:"#DC2626", bg:"#FEF2F2" },
  Próximo:  { color:"#D97706", bg:"#FFFBEB" },
  Archivado:{ color:"#64748B", bg:"#F1F5F9" },
  Activa:   { color:"#059669", bg:"#ECFDF5" },
  Borrador: { color:"#64748B", bg:"#F1F5F9" },
};

function Pill({ est }) {
  const s = EST_STYLES[est] || EST_STYLES.Vigente;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:6,borderRadius:999,fontWeight:600,fontSize:11,padding:"3px 10px",color:s.color,background:s.bg,whiteSpace:"nowrap" }}>
      <span style={{ width:6,height:6,borderRadius:"50%",background:s.color,display:"inline-block" }}/>
      {est}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon:Icon, value, label, iconColor, iconBg }) {
  return (
    <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)",padding:18,display:"flex",alignItems:"center",gap:16,transition:"box-shadow .2s",cursor:"default" }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,.07)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,.04)"}>
      <div style={{ width:48,height:48,borderRadius:12,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
        <Icon style={{ width:22,height:22,color:iconColor }}/>
      </div>
      <div>
        <div style={{ fontSize:30,fontWeight:700,color:"#111827",lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:11.5,color:"#9ca3af",fontWeight:500,letterSpacing:".04em",marginTop:5,textTransform:"uppercase" }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Filter button ────────────────────────────────────────────────────────────
function FBtn({ icon:Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"flex",alignItems:"center",gap:8,height:38,padding:"0 12px",fontSize:13,
      border:`1px solid ${active?"#8B3DFF":"#E5E7EB"}`,
      background: active?"#F1EAFF":"#fff",
      color: active?"#7A2FF0":"#4b5563",
      borderRadius:8,cursor:"pointer"
    }}>
      {Icon && <Icon style={{ width:15,height:15,color:active?"#8B3DFF":"#9ca3af" }}/>}
      {label}
      <ChevronDown style={{ width:13,height:13,color:active?"#8B3DFF":"#9ca3af" }}/>
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:8,background:"#059669",color:"#fff",fontWeight:600,fontSize:13.5,padding:"10px 18px",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.2)",zIndex:60,whiteSpace:"nowrap" }}>
      <CheckCircle2 style={{ width:17,height:17 }}/>{msg}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose, maxWidth=760 }) {
  return (
    <div style={{ position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:24 }}>
      <div style={{ position:"absolute",inset:0,background:"rgba(17,24,39,.5)" }} onClick={onClose}/>
      <div style={{ position:"relative",background:"#fff",borderRadius:16,boxShadow:"0 30px 80px rgba(0,0,0,.3)",width:"100%",maxWidth,maxHeight:"90vh",display:"flex",flexDirection:"column",zIndex:1 }}>
        {children}
      </div>
    </div>
  );
}

const inputSt = { width:"100%",height:38,border:"1px solid #E5E7EB",borderRadius:8,padding:"0 12px",fontSize:13,outline:"none",color:"#374151",boxSizing:"border-box" };
const lblSt   = { fontSize:11,color:"#6b7280",marginBottom:4,display:"block" };

// ═════════════════════════════════ MAIN ══════════════════════════════════════
export default function Documentacion() {
  const { user } = useAuth();
  const [tab, setTab]           = useState("Vehículos");
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [empresas, setEmpresas] = useState([]);

  const [templates, setTemplates] = useState(TEMPLATES_INIT);
  const [verArch, setVerArch]   = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // doc id with open row-menu
  const [addOpen, setAddOpen]   = useState(false);
  const [toast, setToast]       = useState(null);
  const toastRef = useRef(null);

  // file upload refs & state
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // modals
  const [typeModal, setTypeModal] = useState(false);
  const [addForm, setAddForm]     = useState(null); // doctype string | null
  const [tplModal, setTplModal]   = useState(false);
  const [newDoc, setNewDoc]       = useState({});
  const [newTpl, setNewTpl]       = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const url = user?.role === "admin_enered" && empresaFiltro
        ? `/documents?empresa=${encodeURIComponent(empresaFiltro)}`
        : "/documents";
      const { data } = await api.get(url);
      
      let mergedDocs = data || [];
      const hasPersonal = mergedDocs.some(d => d.tipo === "Personal");
      if (!hasPersonal) {
        mergedDocs = [...mergedDocs, ...SEED.Personal];
      }
      const hasViajes = mergedDocs.some(d => d.tipo === "Viajes");
      if (!hasViajes) {
        mergedDocs = [...mergedDocs, ...SEED.Viajes];
      }
      setDocs(mergedDocs);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [empresaFiltro]);

  useEffect(() => {
    if (user?.role === "admin_enered") {
      api.get("/admin/empresas").then(r => setEmpresas(r.data || [])).catch(() => {});
    }
  }, [user]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(()=>setToast(null), 2600);
  }

  const isTemplate = tab === "Plantilla";
  const tabDocs = useMemo(() => {
    if (isTemplate) return [];
    return docs.filter(d => d.tipo === tab);
  }, [tab, docs, isTemplate]);

  const visible = useMemo(() => {
    return tabDocs.filter(d => verArch ? true : !d.archived);
  }, [tabDocs, verArch]);

  // KPIs
  const kpis = useMemo(()=>{
    if (isTemplate) {
      return [
        { n:templates.length,                                    l:"PLANTILLAS", icon:Files,          iconColor:"#8B3DFF", iconBg:"#F1EAFF" },
        { n:templates.filter(t=>t.est==="Activa").length,        l:"ACTIVAS",    icon:CheckCircle2,   iconColor:"#059669", iconBg:"#ECFDF5" },
        { n:templates.filter(t=>t.est==="Borrador").length,      l:"BORRADORES", icon:Clock,          iconColor:"#D97706", iconBg:"#FFFBEB" },
        { n:0,                                                   l:"SIN USO",    icon:AlertTriangle,  iconColor:"#DC2626", iconBg:"#FEF2F2" },
      ];
    }
    const act = tabDocs.filter(d=>!d.archived);
    return [
      { n:act.length,                                  l:"DOCUMENTOS", icon:FileText,       iconColor:"#8B3DFF", iconBg:"#F1EAFF" },
      { n:act.filter(d=>d.est==="Vigente").length,     l:"VIGENTES",   icon:CheckCircle2,   iconColor:"#059669", iconBg:"#ECFDF5" },
      { n:act.filter(d=>d.est==="Próximo").length,     l:"PRÓXIMOS",   icon:Clock,          iconColor:"#D97706", iconBg:"#FFFBEB" },
      { n:act.filter(d=>d.est==="Vencido").length,     l:"VENCIDOS",   icon:AlertTriangle,  iconColor:"#DC2626", iconBg:"#FEF2F2" },
    ];
  }, [tab, tabDocs, templates, isTemplate]);

  // Actions
  const handleDelete = async (id) => {
    if (String(id).startsWith("300") || String(id).startsWith("400")) {
      setDocs(prev => prev.filter(d => d.id !== id));
      showToast("Documento eliminado");
      return;
    }
    if (!window.confirm("¿Seguro de que deseas eliminar este documento permanentemente?")) return;
    try {
      await api.delete(`/documents/${id}`);
      showToast("Documento eliminado correctamente");
      load();
    } catch (err) {
      alert("Error al eliminar documento: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleArchive = async (id, isArchive) => {
    if (String(id).startsWith("300") || String(id).startsWith("400")) {
      setDocs(prev => prev.map(d => d.id === id ? { ...d, archived: isArchive ? 1 : 0, est: isArchive ? "Archivado" : "Vigente" } : d));
      showToast(isArchive ? "Documento archivado" : "Documento restaurado");
      return;
    }
    try {
      await api.put(`/documents/${id}/archive?archived=${isArchive ? 1 : 0}`);
      showToast(isArchive ? "Documento archivado" : "Documento restaurado");
      load();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDownload = async (id, filename) => {
    if (String(id).startsWith("300") || String(id).startsWith("400")) {
      showToast("Descargando documento simulado...");
      return;
    }
    try {
      const r = await api.get(`/documents/${id}/download`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: r.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "documento";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast("Documento descargado");
    } catch (err) {
      alert("No se pudo descargar el documento.");
    }
  };

  const handleSaveDoc = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Por favor selecciona un archivo");
      return;
    }
    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("tipo", tab);
    fd.append("doc", newDoc.doc || addForm);
    if (newDoc.emi) fd.append("emi", newDoc.emi);
    if (newDoc.ven) fd.append("ven", newDoc.ven);
    if (newDoc.placa) fd.append("placa", newDoc.placa);

    try {
      await api.post("/documents", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setAddForm(null);
      setSelectedFile(null);
      setNewDoc({});
      showToast("Documento guardado correctamente");
      load();
    } catch (err) {
      alert("Error al guardar: " + (err.response?.data?.detail || err.message));
    }
  };

  function handleCreateTpl(e) {
    e.preventDefault();
    setTemplates(prev => [...prev, { id:`tp${Date.now()}`, nombre:newTpl.nombre||"Nueva plantilla", tipo:newTpl.tipo||"Vehículo", campos:0, por:"Admin", est:"Borrador" }]);
    setTplModal(false);
    setNewTpl({});
    showToast("Plantilla creada");
  }

  const TH = "#1F2430";
  const thSt = { textAlign:"left",color:"#fff",fontWeight:600,textTransform:"uppercase",fontSize:10.5,letterSpacing:".03em",padding:"13px 16px",whiteSpace:"nowrap" };
  const tdSt = { padding:"13px 16px",fontSize:13 };

  return (
    <div style={{ padding:"24px 32px",background:"#F3F4F6",minHeight:"100%" }} data-testid="page-documentacion">
      <Toast msg={toast}/>
      {/* TABS */}
      <div style={{ display:"flex",alignItems:"center",gap:28,borderBottom:"1px solid #E5E7EB",marginBottom:22 }}>
        {TABS.map(({ key, icon:Icon })=>(
          <button key={key} onClick={()=>{ setTab(key); setVerArch(false); setOpenMenu(null); }} style={{
            position:"relative",display:"flex",alignItems:"center",gap:8,paddingBottom:12,
            fontSize:14,fontWeight:tab===key?700:500,color:tab===key?"#8B3DFF":"#6B7280",
            background:"none",border:"none",cursor:"pointer"
          }}>
            <Icon style={{ width:16,height:16 }}/>{key}
            {tab===key && <span style={{ position:"absolute",left:0,right:0,bottom:-1,height:2.5,borderRadius:2,background:"#8B3DFF" }}/>}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,marginBottom:22 }}>
        {kpis.map((k,i)=>(
          <KpiCard key={i} icon={k.icon} value={k.n} label={k.l} iconColor={k.iconColor} iconBg={k.iconBg}/>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16 }}>
        <div style={{ display:"flex",alignItems:"center",flexWrap:"wrap",gap:10 }}>
          {user?.role === "admin_enered" && (
            <select
              value={empresaFiltro}
              onChange={e => setEmpresaFiltro(e.target.value)}
              style={{
                height: 38,
                padding: "0 12px",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                background: "#fff",
                color: "#374151",
                outline: "none",
                minWidth: 160
              }}
            >
              <option value="">Todas las empresas</option>
              {empresas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
          <FBtn icon={Calendar} label="Fecha de creación"/>
          <FBtn label="Grupos"/>
          <FBtn label="Vehículos"/>
          <FBtn label="Tipo"/>
          <FBtn label="Creado por"/>
          <FBtn label="Estado"/>
          {!isTemplate && (
            <button onClick={()=>setVerArch(v=>!v)} style={{
              display:"flex",alignItems:"center",gap:8,height:38,padding:"0 12px",fontSize:13,
              border:`1px solid ${verArch?"#8B3DFF":"#E5E7EB"}`,
              background:verArch?"#F1EAFF":"#fff",color:verArch?"#7A2FF0":"#4b5563",borderRadius:8,cursor:"pointer"
            }}>
              <Archive style={{ width:15,height:15,color:verArch?"#8B3DFF":"#9ca3af" }}/> Ver archivados
            </button>
          )}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:12,position:"relative" }}>
          {!isTemplate && (
            <div style={{ position:"relative" }}>
              <button onClick={()=>setAddOpen(v=>!v)} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 14px",fontSize:13,fontWeight:500,border:"1px solid #E5E7EB",background:"#fff",color:"#374151",borderRadius:8,cursor:"pointer" }}>
                <Plus style={{ width:15,height:15,color:"#8B3DFF" }}/> Agregar documento
                <ChevronDown style={{ width:13,height:13,color:"#9ca3af" }}/>
              </button>
              {addOpen && (
                <div style={{ position:"absolute",right:0,top:44,width:210,background:"#fff",border:"1px solid #F0F0F3",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.12)",padding:"4px 0",zIndex:30 }}>
                  {ADD_OPTS.map(o=>(
                    <button key={o} onClick={()=>{ setAddOpen(false); setTypeModal(true); }}
                      style={{ width:"100%",textAlign:"left",padding:"8px 12px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={()=>setTplModal(true)} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 16px",fontSize:13,fontWeight:600,color:"#fff",background:"#8B3DFF",border:"none",borderRadius:8,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.2)" }}>
            <LayoutTemplate style={{ width:15,height:15 }}/> Nueva plantilla
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)",overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          {!isTemplate ? (
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1120 }}>
              <thead>
                <tr style={{ background:TH }}>
                  {["Nº DOC","TIPO","PLACA","DOCUMENTO","CREADO POR / EL","EMISIÓN","VENCIMIENTO","ATRASO","COMPARTIDO CON","ESTADO","ACCIONES"].map((h,i)=>(
                    <th key={i} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "40px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: 8, color: "#8B3DFF", fontWeight: 600, fontSize: 14 }}>
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando documentos...
                      </div>
                    </td>
                  </tr>
                ) : visible.length===0 ? (
                  <tr><td colSpan={10} style={{ textAlign:"center",padding:"40px 16px",fontSize:13,color:"#9ca3af" }}>No hay documentos en esta categoría.</td></tr>
                ) : visible.map((d,i)=>{
                  const menuOpen = openMenu===d.id;
                  const sharedLabel = d.all
                    ? <span style={{ display:"flex",alignItems:"center",gap:6,color:"#4b5563" }}><Truck style={{ width:13,height:13,color:"#9ca3af" }}/>Todos los vehículos</span>
                    : <span style={{ color:"#4b5563" }}>
                        {d.veh>0 && <span style={{ textDecoration:"underline dotted" }}>{d.veh} {d.veh===1?"vehículo":"vehículos"} </span>}
                        {d.grp>0 && <span style={{ textDecoration:"underline dotted" }}>{d.grp} grupos</span>}
                        {d.veh===0&&d.grp===0&&"—"}
                      </span>;
                  return (
                    <tr key={d.id} style={{ borderTop:i===0?"none":"1px solid #F3F4F6",transition:"background .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ ...tdSt,fontWeight:600,color:"#374151",whiteSpace:"nowrap" }}>{d.id.substring(0,8)}</td>
                      <td style={{ ...tdSt,color:"#6b7280",whiteSpace:"nowrap" }}>{d.tipo}</td>
                      <td style={{ ...tdSt,color:"#374151",fontWeight:600 }}>{d.placa || "—"}</td>
                      <td style={{ ...tdSt,color:"#374151",fontWeight:500 }}>
                        {d.doc}
                      </td>
                      <td style={tdSt}>
                        <div style={{ color:"#374151",fontSize:12.5 }}>{d.por}</div>
                        <div style={{ color:"#9ca3af",fontSize:11 }}>{d.el}</div>
                      </td>
                      <td style={{ ...tdSt,color:"#6b7280",whiteSpace:"nowrap",fontSize:12.5 }}>{d.emi}</td>
                      <td style={{ ...tdSt,color:"#6b7280",whiteSpace:"nowrap",fontSize:12.5 }}>{d.ven}</td>
                      <td style={{ ...tdSt,whiteSpace:"nowrap",fontSize:12.5,color:d.est==="Vencido"?"#DC2626":"#9ca3af",fontWeight:d.est==="Vencido"?600:400 }}>{d.atr}</td>
                      <td style={tdSt}>{sharedLabel}</td>
                      <td style={tdSt}><Pill est={d.est}/></td>
                      <td style={{ ...tdSt,position:"relative" }}>
                        <button onClick={()=>setOpenMenu(menuOpen?null:d.id)}
                          style={{ width:30,height:30,border:"none",background:"none",color:"#6b7280",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#F3F4F6"}
                          onMouseLeave={e=>e.currentTarget.style.background="none"}>
                          <MoreHorizontal style={{ width:16,height:16 }}/>
                        </button>
                        {menuOpen && (
                          <div style={{ position:"absolute",right:8,top:44,width:220,background:"#fff",border:"1px solid #F0F0F3",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:"4px 0",zIndex:40 }}>
                            {[
                              { icon:Eye,      label:"Ver detalles del documento",  onClick: () => setOpenMenu(null) },
                              { icon:Download, label:"Descargar documento",         onClick: () => { setOpenMenu(null); handleDownload(d.id, d.filename); } },
                            ].map((item,j)=>(
                              <button key={j} onClick={item.onClick}
                                style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                                <item.icon style={{ width:15,height:15,color:"#9ca3af" }}/>{item.label}
                              </button>
                            ))}
                            <div style={{ height:1,background:"#F3F4F6",margin:"4px 0" }}/>
                            {d.archived ? (<>
                              <button onClick={() => { setOpenMenu(null); handleArchive(d.id, false); }}
                                style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                                <RotateCcw style={{ width:15,height:15,color:"#9ca3af" }}/>Restaurar documento
                              </button>
                              <button onClick={() => { setOpenMenu(null); handleDelete(d.id); }}
                                style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",fontSize:13,color:"#DC2626",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
                                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                                <Trash2 style={{ width:15,height:15,color:"#DC2626" }}/>Eliminar documento
                              </button>
                            </>) : (
                              <button onClick={() => { setOpenMenu(null); handleArchive(d.id, true); }}
                                style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",fontSize:13,color:"#DC2626",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
                                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                                <Archive style={{ width:15,height:15,color:"#DC2626" }}/>Archivar documento
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* PLANTILLAS TABLE */
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:760 }}>
              <thead>
                <tr style={{ background:TH }}>
                  {["Nombre de plantilla","Tipo","Campos","Creado por","Estado","Acciones"].map((h,i)=>(
                    <th key={i} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t,i)=>(
                  <tr key={t.id} style={{ borderTop:i===0?"none":"1px solid #F3F4F6",transition:"background .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={tdSt}>
                      <span style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <LayoutTemplate style={{ width:15,height:15,color:"#8B3DFF" }}/>
                        <span style={{ fontWeight:600,color:"#374151" }}>{t.nombre}</span>
                      </span>
                    </td>
                    <td style={{ ...tdSt,color:"#6b7280" }}>{t.tipo}</td>
                    <td style={{ ...tdSt,color:"#6b7280" }}>{t.campos} campos</td>
                    <td style={{ ...tdSt,color:"#6b7280" }}>{t.por}</td>
                    <td style={tdSt}><Pill est={t.est}/></td>
                    <td style={tdSt}>
                      <button style={{ width:30,height:30,border:"none",background:"none",color:"#6b7280",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <MoreHorizontal style={{ width:16,height:16 }}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Pager */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",height:48,borderTop:"1px solid #F3F4F6",fontSize:12.5,color:"#6B7280" }}>
          <span>Mostrando {isTemplate?templates.length:visible.length} de {isTemplate?templates.length:tabDocs.length}</span>
          {verArch && <span style={{ color:"#9ca3af" }}>Incluye documentos archivados</span>}
        </div>
      </div>

      {/* ══════ MODAL: SELECCIONAR TIPO ══════ */}
      {typeModal && (
        <ModalOverlay onClose={()=>setTypeModal(false)} maxWidth={760}>
          <div style={{ padding:28 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
              <h2 style={{ fontSize:19,fontWeight:700,color:"#1f2937" }}>Seleccionar tipo de documento</h2>
              <button onClick={()=>setTypeModal(false)} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af" }}><X style={{ width:20,height:20 }}/></button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
              {DOCTYPES.map(([name, premium],i)=>(
                <button key={i} onClick={()=>{ setTypeModal(false); setAddForm(name); setNewDoc({}); }}
                  style={{ display:"flex",alignItems:"center",gap:12,border:"1px solid #E5E7EB",borderRadius:12,padding:14,background:"#fff",cursor:"pointer",textAlign:"left",transition:"border-color .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#DDD0FF"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#E5E7EB"}>
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",width:40,flexShrink:0,color:"#9ca3af" }}>
                    <FileText style={{ width:20,height:20 }}/>
                    <span style={{ fontSize:8,fontWeight:700,marginTop:2 }}>ÚNICO</span>
                  </div>
                  <span style={{ flex:1,fontSize:13,fontWeight:500,color:"#374151" }}>{name}</span>
                  {premium && <Sparkles style={{ width:14,height:14,color:"#8B3DFF",flexShrink:0 }}/>}
                </button>
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ══════ MODAL: AGREGAR DOCUMENTO ══════ */}
      {addForm && (
        <ModalOverlay onClose={()=>setAddForm(null)} maxWidth={560}>
          {/* sticky header */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:60,borderBottom:"1px solid #EEF0F2",flexShrink:0 }}>
            <h2 style={{ fontSize:16,fontWeight:700,color:"#1f2937" }}>Agregar: {addForm}</h2>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setAddForm(null)} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 14px",fontSize:13,fontWeight:500,border:"1px solid #E5E7EB",background:"#fff",color:"#374151",borderRadius:8,cursor:"pointer" }}>Cancelar</button>
              <button onClick={handleSaveDoc} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 16px",fontSize:13,fontWeight:600,color:"#fff",background:"#8B3DFF",border:"none",borderRadius:8,cursor:"pointer" }}>Guardar</button>
            </div>
          </div>
          <div style={{ overflowY:"auto",padding:24 }}>
            {/* Drop zone */}
            <div style={{ fontSize:13,fontWeight:600,color:"#374151",marginBottom:10 }}>Adjuntos</div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: "pointer", border: "2px dashed #DDD6F3", borderRadius: 12, padding: "28px 16px", background: "#FAF9FF", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}
            >
              <UploadCloud style={{ width: 26, height: 26, color: "#8B3DFF" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8B3DFF", marginTop: 8 }}>
                {selectedFile ? selectedFile.name : "Agregar adjunto"}
              </div>
              <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>
                {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "o haz clic para seleccionar un archivo"}
              </div>
            </div>
            {/* Fields */}
            <div style={{ fontSize:13,fontWeight:600,color:"#374151",marginBottom:10 }}>Detalles</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <div>
                <label style={lblSt}>Tipo</label>
                <input style={{ ...inputSt,background:"#F9FAFB",color:"#6b7280" }} readOnly value={addForm}/>
              </div>
              <div>
                <label style={lblSt}>N° de referencia</label>
                <input style={inputSt} placeholder="Ej. 20008" value={newDoc.ref||""} onChange={e=>setNewDoc(p=>({...p,ref:e.target.value}))}/>
              </div>
              <div>
                <label style={lblSt}>Fecha de emisión</label>
                <input type="date" style={inputSt} value={newDoc.emi||""} onChange={e=>setNewDoc(p=>({...p,emi:e.target.value}))}/>
              </div>
              <div>
                <label style={lblSt}>Fecha de vencimiento</label>
                <input type="date" style={inputSt} value={newDoc.ven||""} onChange={e=>setNewDoc(p=>({...p,ven:e.target.value}))}/>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lblSt}>Nombre del documento</label>
                <input style={inputSt} placeholder="Ej. Seguro Vehicular 2026" value={newDoc.doc||""} onChange={e=>setNewDoc(p=>({...p,doc:e.target.value}))}/>
              </div>
              {tab === "Vehículos" && (
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lblSt}>Placa del vehículo</label>
                  <input style={inputSt} placeholder="Ej. ABC-123" value={newDoc.placa||""} onChange={e=>setNewDoc(p=>({...p,placa:e.target.value.toUpperCase()}))}/>
                </div>
              )}
              <div style={{ gridColumn:"1/-1" }}>
                <label style={lblSt}>Descripción</label>
                <textarea style={{ ...inputSt,height:"auto",minHeight:64,padding:"8px 12px",resize:"none" }} placeholder="Agrega una nota o descripción…" value={newDoc.desc||""} onChange={e=>setNewDoc(p=>({...p,desc:e.target.value}))}/>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ══════ MODAL: NUEVA PLANTILLA ══════ */}
      {tplModal && (
        <ModalOverlay onClose={()=>setTplModal(false)} maxWidth={460}>
          <div style={{ padding:26 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <h2 style={{ fontSize:17,fontWeight:700,color:"#1f2937" }}>Nueva plantilla</h2>
              <button onClick={()=>setTplModal(false)} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af" }}><X style={{ width:20,height:20 }}/></button>
            </div>
            <form onSubmit={handleCreateTpl} style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div>
                <label style={lblSt}>Nombre de la plantilla</label>
                <input required style={inputSt} placeholder="Ej. Seguro vehicular" value={newTpl.nombre||""} onChange={e=>setNewTpl(p=>({...p,nombre:e.target.value}))}/>
              </div>
              <div>
                <label style={lblSt}>Tipo de documento</label>
                <select style={inputSt} value={newTpl.tipo||""} onChange={e=>setNewTpl(p=>({...p,tipo:e.target.value}))}>
                  <option value="">Vehículo · Personal · Viaje · Empresa</option>
                  {["Vehículo","Personal","Viaje","Empresa"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <button type="submit" style={{ display:"flex",alignItems:"center",justifyContent:"center",height:40,background:"#8B3DFF",color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer",marginTop:18,boxShadow:"0 4px 12px rgba(139,61,255,.2)" }}>
                Crear plantilla
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Toast */}
      <Toast msg={toast}/>

      {/* Close menus on outside click */}
      {(openMenu||addOpen) && (
        <div style={{ position:"fixed",inset:0,zIndex:20 }} onClick={()=>{ setOpenMenu(null); setAddOpen(false); }}/>
      )}

      <div style={{ textAlign:"center",color:"#9ca3af",fontSize:11,padding:"24px 0 8px" }}>
        ENERED | Red Inteligente de Energías &nbsp;I Copyright © 2024 I Energix Peru I Todos los derechos son reservados.
      </div>
    </div>
  );
}
