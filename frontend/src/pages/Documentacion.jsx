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
import PdfViewerModal from "../components/PdfViewerModal";

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

const VEHICULO_SLOTS = ["Tarjeta de propiedad", "SOAT", "Revisión técnica", "TUC", "Póliza"];
const DRIVER_SLOTS = ["DNI", "Brevete", "SCTR", "Seguro", "Certificado"];
const VIAJE_SLOTS = ["Guía de remisión producto", "Guía de transportista", "Factura", "Pesos y medidas", "OC"];
const EMPRESA_SLOTS = ["RUC", "Vigencia de poder", "Testimonio", "Licencia de funcionamiento", "Cuenta bancaria"];

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

function FSel({ label, icon:Icon, grow, value, onChange, options = [] }) {
  return (
    <div style={{ position:"relative",height:38,border:"1px solid #E5E7EB",borderRadius:8,background:"#fff",display:"flex",alignItems:"center",padding:"0",fontSize:13,minWidth:grow?undefined:130,flex:grow?"1":undefined,cursor:"pointer" }}>
      {Icon && <Icon style={{ width:15,height:15,color:"#9ca3af",marginLeft:12,marginRight:4 }}/>}
      <select 
        value={value} 
        onChange={onChange}
        style={{ width:"100%", height:"100%", border:"none", background:"transparent", padding: Icon ? "0 30px 0 4px" : "0 30px 0 12px", appearance:"none", outline:"none", color: value ? "#111827" : "#6b7280", fontWeight: value ? 600 : 400, cursor:"pointer" }}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#9ca3af", pointerEvents:"none" }}/>
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
  const [filtros, setFiltros] = useState({ estado: "", placa: "", creado_por: "" });
  const updFiltro = (k) => (e) => setFiltros(p => ({ ...p, [k]: e.target.value }));

  const filterOpts = useMemo(() => {
    const estados = new Set();
    const placas = new Set();
    const creadores = new Set();
    docs.forEach(d => {
      if (d.est) estados.add(d.est);
      if (d.placa) placas.add(d.placa);
      if (d.por) creadores.add(d.por);
    });
    return {
      estado: Array.from(estados).sort(),
      placa: Array.from(placas).sort(),
      creador: Array.from(creadores).sort(),
    };
  }, [docs]);
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [empresas, setEmpresas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [expandedVeh, setExpandedVeh] = useState({});
  const [conductores, setConductores] = useState([]);
  const [expandedCond, setExpandedCond] = useState({});
  const [expandedViajes, setExpandedViajes] = useState({});

  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem("doc_templates");
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return TEMPLATES_INIT;
  });

  useEffect(() => {
    localStorage.setItem("doc_templates", JSON.stringify(templates));
  }, [templates]);
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
  const [multiAddOpen, setMultiAddOpen] = useState(false);
  const [multiAddData, setMultiAddData] = useState({ identifier: "", docs: {} });
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState("");

  const calculateStatus = (doc) => {
    if (!doc.ven) return doc;
    let venDate;
    if (doc.ven.includes("/")) {
      const parts = doc.ven.split("/");
      if (parts.length === 3) {
        const [d, m, y] = parts;
        const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
        venDate = new Date(year, parseInt(m) - 1, parseInt(d));
      }
    } else if (doc.ven.includes("-")) {
      venDate = new Date(doc.ven + "T00:00:00");
    }
    
    if (!venDate || isNaN(venDate.getTime())) return doc;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = venDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let est = "Vigente";
    let atr = "—";

    if (diffDays < 0) {
      est = "Vencido";
      const absDays = Math.abs(diffDays);
      if (absDays > 30) {
        const months = Math.floor(absDays / 30);
        atr = `${months} mes${months > 1 ? 'es' : ''}`;
      } else {
        atr = `${absDays} día${absDays > 1 ? 's' : ''}`;
      }
    } else if (diffDays <= 30) {
      est = "Próximo";
      atr = `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }

    if (doc.archived) {
      est = "Archivado";
    }

    return { ...doc, est, atr };
  };

  const load = async () => {
    setLoading(true);
    try {
      const url = user?.role === "admin_enered" && empresaFiltro
        ? `/documents?empresa=${encodeURIComponent(empresaFiltro)}`
        : "/documents";
      const { data } = await api.get(url);
      
      let mergedDocs = data || [];
      const hasPersonal = mergedDocs.some(d => d.tipo === "Personal");
      if (!hasPersonal && !localStorage.getItem("hideSeedPersonal")) {
        mergedDocs = [...mergedDocs, ...SEED.Personal];
      }
      const hasViajes = mergedDocs.some(d => d.tipo === "Viajes");
      if (!hasViajes && !localStorage.getItem("hideSeedViajes")) {
        mergedDocs = [...mergedDocs, ...SEED.Viajes];
      }
      
      const miNombre = user?.nombre || "Soporte";
      const dummyNombres = ["Cindy Coach", "Bisma Ishfaq", "Atif Safeer", "Anwesha Ch.", "Cliente (Subsidio)", "Admin"];
      mergedDocs = mergedDocs.map(d => dummyNombres.includes(d.por) ? { ...d, por: miNombre } : d);

      mergedDocs = mergedDocs.map(calculateStatus);
      setDocs(mergedDocs);

      // Fetch global vehiculos to populate the Vehículos tab accordion
      try {
        const urlVeh = user?.role === "admin_enered" && empresaFiltro
          ? `/vehiculos?empresa=${encodeURIComponent(empresaFiltro)}`
          : "/vehiculos";
        const resVeh = await api.get(urlVeh);
        setVehiculos(resVeh.data || []);
      } catch (errVeh) {
        console.error("Error loading vehicles:", errVeh);
      }

      // Fetch global drivers to populate the Personal tab accordion
      try {
        const resCond = await api.get("/conductores");
        setConductores(resCond.data || []);
      } catch (errCond) {
        console.error("Error loading drivers:", errCond);
      }
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
    return tabDocs.filter(d => {
      if (!verArch && d.archived) return false;
      if (filtros.placa && (d.placa||"").toUpperCase() !== filtros.placa.toUpperCase()) return false;
      if (filtros.estado && d.est !== filtros.estado) return false;
      if (filtros.creado_por && d.por !== filtros.creado_por) return false;
      return true;
    });
  }, [tabDocs, verArch, filtros]);

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
  const handleDeleteDriver = async (cid) => {
    if (!window.confirm("¿Estás seguro de eliminar este conductor y sus documentos?")) return;
    const cidLower = (cid || "").toLowerCase();
    const toDelete = docs.filter(d => d.tipo === "Personal" && (d.conductor_id === cid || (!d.conductor_id && d.por && cidLower.includes(d.por.toLowerCase()))));
    for (const d of toDelete) {
      if (!String(d.id).startsWith("300") && !String(d.id).startsWith("400")) {
        await api.delete(`/documents/${d.id}`).catch(()=>({}));
      } else {
        localStorage.setItem("hideSeedPersonal", "true");
      }
    }
    setDocs(prev => prev.filter(d => !toDelete.includes(d)));
    showToast("Conductor eliminado");
  };

  const handleDeleteVehiculo = async (pl) => {
    if (!window.confirm("¿Estás seguro de eliminar este vehículo y sus documentos?")) return;
    const plLower = (pl || "").toLowerCase();
    const toDelete = docs.filter(d => d.tipo === "Vehículos" && (d.placa || "").toLowerCase() === plLower);
    for (const d of toDelete) {
      if (!String(d.id).startsWith("300") && !String(d.id).startsWith("400")) {
        await api.delete(`/documents/${d.id}`).catch(()=>({}));
      }
    }
    setDocs(prev => prev.filter(d => !toDelete.includes(d)));
    showToast("Vehículo eliminado");
  };

  const handleDeleteViaje = async (vid) => {
    if (!window.confirm("¿Estás seguro de eliminar este viaje y sus documentos?")) return;
    let v_idx = 0;
    const toDelete = docs.filter(d => {
      if (d.tipo !== "Viajes") return false;
      const code = d.viaje_id || `VIAJE-${100 + (v_idx % 2)}`;
      v_idx++;
      return code === vid;
    });
    for (const d of toDelete) {
      if (!String(d.id).startsWith("300") && !String(d.id).startsWith("400")) {
        await api.delete(`/documents/${d.id}`).catch(()=>({}));
      } else {
        localStorage.setItem("hideSeedViajes", "true");
      }
    }
    setDocs(prev => prev.filter(d => !toDelete.includes(d)));
    showToast("Viaje eliminado");
  };

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

  const handleView = async (id, filename) => {
    if (String(id).startsWith("300") || String(id).startsWith("400")) {
      showToast("Visualizando documento simulado...");
      return;
    }
    try {
      const r = await api.get(`/documents/${id}/download`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: r.headers["content-type"] });
      const url = URL.createObjectURL(blob);
      setViewerUrl(url);
      setViewerTitle(filename || "Documento");
      setViewerOpen(true);
    } catch (err) {
      alert("No se pudo cargar el documento.");
    }
  };

  const handleSaveMulti = async () => {
    if (!multiAddData.identifier) {
      alert("Por favor ingresa un identificador principal (Placa, Nombre o Código)");
      return;
    }
    const uploads = [];
    for (const [slot, data] of Object.entries(multiAddData.docs)) {
      if (!data.file) continue;
      const fd = new FormData();
      fd.append("file", data.file);
      fd.append("tipo", tab);
      fd.append("doc", slot);
      if (data.emi) fd.append("emi", data.emi);
      if (data.ven) fd.append("ven", data.ven);
      
      if (tab === "Vehículos") fd.append("placa", multiAddData.identifier.toUpperCase());
      else if (tab === "Personal") fd.append("por", multiAddData.identifier);
      else if (tab === "Viajes") fd.append("viaje_id", multiAddData.identifier.toUpperCase());
      else fd.append("ref", multiAddData.identifier);

      uploads.push(api.post("/documents", fd));
    }
    
    if (uploads.length === 0) {
      alert("No has adjuntado ningún documento");
      return;
    }
    
    try {
      setLoading(true);
      await Promise.all(uploads);
      showToast("Documentos guardados correctamente");
      setMultiAddOpen(false);
      setMultiAddData({ identifier: "", docs: {} });
      load();
    } catch (err) {
      alert("Hubo un error al guardar los documentos: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const setMultiField = (slot, field, val) => {
    setMultiAddData(prev => ({
      ...prev,
      docs: {
        ...prev.docs,
        [slot]: { ...(prev.docs[slot] || {}), [field]: val }
      }
    }));
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
    if (newDoc.conductor_id) fd.append("conductor_id", newDoc.conductor_id);
    if (newDoc.viaje_id) fd.append("viaje_id", newDoc.viaje_id);
    if (newDoc.ref) fd.append("ref", newDoc.ref);
    if (newDoc.desc) fd.append("desc", newDoc.desc);

    try {
      const isReplacement = !!(newDoc.doc || addForm);
      if (isReplacement) {
        const slotName = (newDoc.doc || addForm).toLowerCase().replace(/[^a-z0-9]/g,"");
        
        const existings = docs.filter(d => {
          if (d.tipo !== tab) return false;
          if (String(d.id).startsWith("300") || String(d.id).startsWith("400")) return false;
          const dName = (d.doc || "").toLowerCase().replace(/[^a-z0-9]/g,"");
          
          let isMatch = dName.includes(slotName) || slotName.includes(dName);
          if (slotName === "sctrsalud" && (dName.includes("sctr") || dName.includes("salud"))) isMatch = true;
          if (slotName === "sctrpension" && (dName.includes("sctr") || dName.includes("pension"))) isMatch = true;
          if (slotName === "brevete" && (dName.includes("licencia") || dName.includes("breve"))) isMatch = true;
          
          if (!isMatch) return false;
          
          if (tab === "Vehículos" && newDoc.placa && d.placa === newDoc.placa) return true;
          if (tab === "Personal" && newDoc.conductor_id && d.conductor_id === newDoc.conductor_id) return true;
          if (tab === "Viajes" && newDoc.viaje_id && d.viaje_id === newDoc.viaje_id) return true;
          if (tab === "Empresa") return true;
          if (newDoc.id && d.id === newDoc.id) return true;
          return false;
        });

        for (const ex of existings) {
          await api.delete(`/documents/${ex.id}`).catch(()=>{});
        }
      }

      await api.post("/documents", fd);
      
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
    setTemplates(prev => {
      let updated;
      if (newTpl.id) {
        updated = prev.map(t => t.id === newTpl.id ? { ...t, nombre:newTpl.nombre||"Nueva plantilla", tipo:newTpl.tipo||"Vehículo", campos:newTpl.campos||0 } : t);
      } else {
        updated = [...prev, { id:`tp${Date.now()}`, nombre:newTpl.nombre||"Nueva plantilla", tipo:newTpl.tipo||"Vehículo", campos:newTpl.campos||0, por:user?.nombre||"Soporte", est:"Borrador" }];
      }
      localStorage.setItem("doc_templates", JSON.stringify(updated));
      return updated;
    });
    setTplModal(false);
    setNewTpl({});
    showToast(newTpl.id ? "Plantilla actualizada" : "Plantilla creada");
  }

  const TH = "#1F2430";
  const thSt = { textAlign:"left",color:"#fff",fontWeight:600,textTransform:"uppercase",fontSize:10.5,letterSpacing:".03em",padding:"13px 16px",whiteSpace:"nowrap" };
  const tdSt = { padding:"13px 16px",fontSize:13 };

  return (
    <div style={{ padding:"24px 32px",background:"transparent",minHeight:"100%" }} data-testid="page-documentacion">
      <Toast msg={toast}/>
      <PdfViewerModal open={viewerOpen} url={viewerUrl} title={viewerTitle} onClose={() => setViewerOpen(false)} />
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
          <FSel label="Vehículos / Placa" value={filtros.placa} onChange={updFiltro("placa")} options={filterOpts.placa} />
          <FSel label="Creado por" value={filtros.creado_por} onChange={updFiltro("creado_por")} options={filterOpts.creador} />
          <FSel label="Estado" value={filtros.estado} onChange={updFiltro("estado")} options={filterOpts.estado} />
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
            <button onClick={()=>setMultiAddOpen(true)} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 14px",fontSize:13,fontWeight:500,border:"1px solid #E5E7EB",background:"#fff",color:"#374151",borderRadius:8,cursor:"pointer" }}>
              <Plus style={{ width:15,height:15,color:"#8B3DFF" }}/> 
              {tab === "Vehículos" ? "Agregar vehículo" : tab === "Personal" ? "Agregar personal" : tab === "Viajes" ? "Agregar viaje" : "Agregar empresa"}
            </button>
          )}
          <button onClick={()=>setTplModal(true)} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 16px",fontSize:13,fontWeight:600,color:"#fff",background:"#8B3DFF",border:"none",borderRadius:8,cursor:"pointer",boxShadow:"0 4px 12px rgba(139,61,255,.2)" }}>
            <LayoutTemplate style={{ width:15,height:15 }}/> Nueva plantilla
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background:"#fff",border:"1px solid #F0F0F3",borderRadius:16,boxShadow:"0 1px 2px rgba(0,0,0,.04)",overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          {!isTemplate && tab === "Vehículos" ? (() => {
            // ── VEHÍCULOS ACCORDION ────────────────────────────────────────
            const SLOTS = [
              "Tarjeta de propiedad",
              "SOAT",
              "Revisión técnica",
              "TUC",
              "Póliza",
            ];

            // Build a lookup: placa → { slotName → doc }
            const docsByPlaca = {};
            docs.filter(d => d.tipo === "Vehículos").forEach(d => {
              const pl = (d.placa || "").toUpperCase();
              if (!pl) return;
              if (!docsByPlaca[pl]) docsByPlaca[pl] = {};
              // match slot by doc name (case-insensitive fuzzy)
              SLOTS.forEach(slot => {
                const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,"");
                if (norm(d.doc || "").includes(norm(slot))) {
                  docsByPlaca[pl][slot] = d;
                }
              });
            });

            // List of vehicles: from vehiculos state, merged with placas from docs
            let vehList = vehiculos.length > 0 ? [...vehiculos] : [];
            const existingPlacas = new Set(vehList.map(v => (v.placa || "").toUpperCase()));
            const extraPlacas = [...new Set(docs.filter(d => d.tipo === "Vehículos" && d.placa).map(d => d.placa.toUpperCase()))];
            extraPlacas.forEach(pl => {
              if (pl && !existingPlacas.has(pl)) {
                vehList.push({ id: pl, placa: pl, empresa: "", tipo: "" });
                existingPlacas.add(pl);
              }
            });
            if (filtros.placa) vehList = vehList.filter(v => (v.placa||"").toUpperCase() === filtros.placa.toUpperCase());
            if (filtros.estado || filtros.creado_por) {
              vehList = vehList.filter(v => {
                const sDocs = docsByPlaca[(v.placa||"").toUpperCase()] || {};
                return Object.values(sDocs).some(d => {
                  let ok = true;
                  if (filtros.estado && d.est !== filtros.estado) ok = false;
                  if (filtros.creado_por && d.por !== filtros.creado_por) ok = false;
                  return ok;
                });
              });
            }

            if (loading) return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1100 }}>
                <tbody>
                  <tr><td colSpan={10} style={{ padding:"40px",textAlign:"center",color:"#8B3DFF",fontWeight:600,fontSize:14 }}>
                    <span style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                      <Loader2 className="w-5 h-5 animate-spin"/> Cargando...
                    </span>
                  </td></tr>
                </tbody>
              </table>
            );

            if (vehList.length === 0) return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1100 }}>
                <tbody>
                  <tr><td colSpan={10} style={{ textAlign:"center",padding:"40px",fontSize:13,color:"#9ca3af" }}>
                    No hay vehículos registrados. Agrega unidades en el módulo de Flotas.
                  </td></tr>
                </tbody>
              </table>
            );

            const thSt2 = { ...thSt, fontSize:11.5, padding:"12px 14px" };

            return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1200 }}>
                <thead>
                  <tr style={{ background:"#241B4A" }}>
                    {["","TIPO","PLACA","EMPRESA","DOCUMENTO","ESTADO","EMISIÓN","VENCIMIENTO","ATRASO","CREADO POR / EL","ACCIONES"].map((h,i)=>(
                      <th key={i} style={thSt2}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehList.map((v, vi) => {
                    const pl = (v.placa || "").toUpperCase();
                    const isOpen = !!expandedVeh[pl];
                    const slotDocs = docsByPlaca[pl] || {};
                    const vigentes = SLOTS.filter(s => slotDocs[s]).length;
                    const pendientes = SLOTS.length - vigentes;

                    return (
                      <React.Fragment key={pl}>
                        {/* ── VEHICLE HEADER ROW ── */}
                        <tr
                          style={{
                            borderTop: vi === 0 ? "none" : "1px solid #E5E7EB",
                            background: isOpen ? "#F5F3FF" : "#fff",
                            cursor: "pointer",
                            transition: "background .15s",
                          }}
                          onClick={() => setExpandedVeh(p => ({ ...p, [pl]: !p[pl] }))}
                          onMouseEnter={e => { if(!isOpen) e.currentTarget.style.background="#F9FAFB"; }}
                          onMouseLeave={e => { if(!isOpen) e.currentTarget.style.background="#fff"; }}
                        >
                          {/* chevron */}
                          <td style={{ ...tdSt, width:36, textAlign:"center", color:"#8B3DFF" }}>
                            <span style={{ display:"inline-flex", transform: isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}>
                              <ChevronDown style={{ width:16,height:16 }}/>
                            </span>
                          </td>
                          <td style={{ ...tdSt, color:"#6b7280", whiteSpace:"nowrap", fontSize:12.5 }}>
                            {v.tipo || "Vehículo"}
                          </td>
                          <td style={{ ...tdSt, fontWeight:700, color:"#1f2937", fontSize:13 }}>
                            <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
                              <Car style={{ width:14,height:14,color:"#8B3DFF" }}/>
                              {pl}
                            </span>
                          </td>
                          <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{v.empresa || "—"}</td>
                          {/* span remaining cols with summary */}
                          <td colSpan={6} style={{ ...tdSt }}>
                            <span style={{ display:"flex",alignItems:"center",gap:10 }}>
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#059669",background:"#ECFDF5",padding:"3px 10px",borderRadius:999 }}>
                                <span style={{ width:6,height:6,borderRadius:"50%",background:"#059669",display:"inline-block" }}/>
                                {vigentes} Vigente{vigentes!==1?"s":""}
                              </span>
                              {pendientes > 0 && (
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#64748B",background:"#F1F5F9",padding:"3px 10px",borderRadius:999 }}>
                                  <span style={{ width:6,height:6,borderRadius:"50%",background:"#64748B",display:"inline-block" }}/>
                                  {pendientes} Pendiente{pendientes!==1?"s":""}
                                </span>
                              )}
                              <span style={{ fontSize:11.5,color:"#9ca3af",marginLeft:4 }}>{vigentes}/{SLOTS.length} documentos</span>
                            </span>
                          </td>
                          <td style={{ ...tdSt, textAlign:"center" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteVehiculo(pl); }}
                              style={{ width:30,height:30,border:"none",background:"#FEF2F2",color:"#DC2626",borderRadius:8,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center" }}
                              title="Eliminar vehículo y sus documentos"
                            >
                              <Trash2 style={{ width:15,height:15 }}/>
                            </button>
                          </td>
                        </tr>

                        {/* ── DOCUMENT SLOT ROWS (accordion) ── */}
                        {isOpen && SLOTS.map((slot, si) => {
                          const d = slotDocs[slot];
                          const hasdoc = !!d;
                          const menuKey = `${pl}-${slot}`;
                          const menuOpen = openMenu === menuKey;

                          // Determine status
                          let est = "Pendiente";
                          let atraso = "—";
                          if (hasdoc) {
                            est = d.est || "Vigente";
                            atraso = d.atr || "—";
                          }
                          const estStyle = {
                            Vigente:   { color:"#059669", bg:"#ECFDF5" },
                            Vencido:   { color:"#DC2626", bg:"#FEF2F2" },
                            Próximo:   { color:"#D97706", bg:"#FFFBEB" },
                            Pendiente: { color:"#64748B", bg:"#F1F5F9" },
                            Archivado: { color:"#64748B", bg:"#F1F5F9" },
                          }[est] || { color:"#64748B", bg:"#F1F5F9" };

                          return (
                            <tr
                              key={slot}
                              style={{
                                borderTop:"1px solid #EEF0F2",
                                background: si%2===0 ? "#FDFCFF" : "#FAF9FF",
                                transition:"background .12s",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background="#F1EAFF"}
                              onMouseLeave={e => e.currentTarget.style.background= si%2===0?"#FDFCFF":"#FAF9FF"}
                            >
                              {/* indent spacer */}
                              <td style={{ ...tdSt, width:36, borderLeft:"3px solid #8B3DFF" }}/>
                              {/* tipo col */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>Vehículos</td>
                              {/* placa */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>{pl}</td>
                              {/* empresa */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>{v.empresa || "—"}</td>
                              {/* documento */}
                              <td style={{ ...tdSt, fontWeight:600, color:"#374151", fontSize:13 }}>
                                <span style={{ display:"flex",alignItems:"center",gap:7 }}>
                                  <FileText style={{ width:14,height:14,color: hasdoc?"#8B3DFF":"#9ca3af" }}/>
                                  {slot}
                                </span>
                              </td>
                              {/* estado */}
                              <td style={tdSt}>
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,borderRadius:999,fontWeight:600,fontSize:11,padding:"3px 10px",color:estStyle.color,background:estStyle.bg,whiteSpace:"nowrap" }}>
                                  <span style={{ width:6,height:6,borderRadius:"50%",background:estStyle.color,display:"inline-block" }}/>
                                  {hasdoc ? est : "Pendiente de cargar"}
                                </span>
                              </td>
                              {/* emisión */}
                              <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{hasdoc ? (d.emi || "—") : "—"}</td>
                              {/* vencimiento */}
                              <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{hasdoc ? (d.ven || "—") : "—"}</td>
                              {/* atraso */}
                              <td style={{ ...tdSt, fontSize:12.5, whiteSpace:"nowrap", color: est==="Vencido"?"#DC2626":"#9ca3af", fontWeight: est==="Vencido"?600:400 }}>
                                {atraso}
                              </td>
                              {/* creado por */}
                              <td style={tdSt}>
                                {hasdoc ? (
                                  <>
                                    <div style={{ color:"#374151",fontSize:12.5 }}>{d.por || "—"}</div>
                                    <div style={{ color:"#9ca3af",fontSize:11 }}>{d.el || ""}</div>
                                  </>
                                ) : <span style={{ color:"#9ca3af",fontSize:12 }}>—</span>}
                              </td>
                              {/* acciones */}
                              <td style={{ ...tdSt, position:"relative" }}>
                                <button
                                  onClick={() => setOpenMenu(menuOpen ? null : menuKey)}
                                  style={{ width:30,height:30,border:"none",background:"none",color:"#6b7280",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                                  onMouseEnter={e=>e.currentTarget.style.background="#F3F4F6"}
                                  onMouseLeave={e=>e.currentTarget.style.background="none"}
                                >
                                  <MoreHorizontal style={{ width:16,height:16 }}/>
                                </button>
                                {menuOpen && (
                                  <div style={{ position:"absolute",right:8,top:44,width:230,background:"#fff",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:"6px 0",zIndex:40 }}>
                                    {!hasdoc && (
                                      <button
                                        onClick={() => { setOpenMenu(null); setAddForm(slot); setNewDoc({ placa: pl, doc: slot }); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <UploadCloud style={{ width:15,height:15,color:"#8B3DFF" }}/> Cargar documento
                                      </button>
                                    )}
                                    {hasdoc && (<>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleView(d.id, d.filename); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Eye style={{ width:15,height:15,color:"#9ca3af" }}/> Visualizar documento
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleDownload(d.id, d.filename); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Download style={{ width:15,height:15,color:"#9ca3af" }}/> Descargar documento
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenu(null); setAddForm(slot); setNewDoc({ placa: pl, doc: slot, emi: d.emi, ven: d.ven, ref: d.ref, desc: d.desc }); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <UploadCloud style={{ width:15,height:15,color:"#9ca3af" }}/> Editar / reemplazar
                                      </button>
                                      <div style={{ height:1,background:"#F3F4F6",margin:"4px 0" }}/>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleDelete(d.id); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#DC2626",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Trash2 style={{ width:15,height:15,color:"#DC2626" }}/> Eliminar documento
                                      </button>
                                    </>)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            );
          })() : !isTemplate && tab === "Personal" ? (() => {
            // ── PERSONAL ACCORDION ────────────────────────────────────────
            const DRIVER_SLOTS = [
              "DNI",
              "Brevete",
              "SCTR",
              "Seguro",
              "Certificado"
            ];

            // List of drivers: from conductores state, merged with unique drivers from docs
            let condList = conductores.length > 0 ? [...conductores] : [];
            const existingConds = new Set(condList.map(c => c.id));
            const existingNames = new Set(condList.map(c => (`${c.nombre||""} ${c.apellidos||""}`).trim().toLowerCase()));

            docs.filter(d => d.tipo === "Personal").forEach(d => {
              const name = d.por || "Conductor";
              const key = d.conductor_id || name;
              if (key && !existingConds.has(key) && !existingNames.has(name.toLowerCase())) {
                existingConds.add(key);
                condList.push({
                  id: key,
                  nombre: name,
                  apellidos: "",
                  dni: d.dni || "—",
                  licencia: d.licencia || "—",
                });
              }
            });
            if (filtros.estado || filtros.creado_por) {
              condList = condList.filter(c => {
                const cid = c.id;
                const sDocs = docsByConductor[cid] || {};
                return Object.values(sDocs).some(d => {
                  let ok = true;
                  if (filtros.estado && d.est !== filtros.estado) ok = false;
                  if (filtros.creado_por && d.por !== filtros.creado_por) ok = false;
                  return ok;
                });
              });
            }

            // Build a lookup: driverId → { slotName → doc }
            const docsByConductor = {};
            docs.filter(d => d.tipo === "Personal").forEach(d => {
              let matchedCondId = d.conductor_id;
              if (!matchedCondId && d.por) {
                const found = condList.find(c => {
                  const fullName = `${c.nombre} ${c.apellidos}`.trim().toLowerCase();
                  return fullName.includes(d.por.toLowerCase()) || d.por.toLowerCase().includes(c.nombre.toLowerCase());
                });
                if (found) {
                  matchedCondId = found.id;
                }
              }
              if (matchedCondId) {
                if (!docsByConductor[matchedCondId]) docsByConductor[matchedCondId] = {};
                DRIVER_SLOTS.forEach(slot => {
                  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,"");
                  const docName = norm(d.doc || "");
                  const slotName = norm(slot);
                  let isMatch = docName.includes(slotName);
                  if (slot === "Brevete" && (docName.includes("licencia") || docName.includes("brevebee"))) {
                    isMatch = true;
                  }
                  if (isMatch) {
                    docsByConductor[matchedCondId][slot] = d;
                  }
                });
              }
            });

            if (loading) return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1100 }}>
                <tbody>
                  <tr><td colSpan={10} style={{ padding:"40px",textAlign:"center",color:"#8B3DFF",fontWeight:600,fontSize:14 }}>
                    <span style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                      <Loader2 className="w-5 h-5 animate-spin"/> Cargando...
                    </span>
                  </td></tr>
                </tbody>
              </table>
            );

            if (condList.length === 0) return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1100 }}>
                <tbody>
                  <tr><td colSpan={10} style={{ textAlign:"center",padding:"40px",fontSize:13,color:"#9ca3af" }}>
                    No hay conductores registrados. Agrega conductores en el módulo correspondiente.
                  </td></tr>
                </tbody>
              </table>
            );

            const thSt2 = { ...thSt, fontSize:11.5, padding:"12px 14px" };

            return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1200 }}>
                <thead>
                  <tr style={{ background:"#241B4A" }}>
                    {["","TIPO","DNI / CONDUCTOR","LICENCIA","DOCUMENTO","ESTADO","EMISIÓN","VENCIMIENTO","ATRASO","CREADO POR / EL","ACCIONES"].map((h,i)=>(
                      <th key={i} style={thSt2}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {condList.map((c, ci) => {
                    const cid = c.id;
                    const isOpen = !!expandedCond[cid];
                    const slotDocs = docsByConductor[cid] || {};
                    const vigentes = DRIVER_SLOTS.filter(s => slotDocs[s]).length;
                    const pendientes = DRIVER_SLOTS.length - vigentes;
                    const cName = `${c.nombre} ${c.apellidos}`.trim();

                    return (
                      <React.Fragment key={cid}>
                        {/* ── DRIVER HEADER ROW ── */}
                        <tr
                          style={{
                            borderTop: ci === 0 ? "none" : "1px solid #E5E7EB",
                            background: isOpen ? "#F5F3FF" : "#fff",
                            cursor: "pointer",
                            transition: "background .15s",
                          }}
                          onClick={() => setExpandedCond(p => ({ ...p, [cid]: !p[cid] }))}
                          onMouseEnter={e => { if(!isOpen) e.currentTarget.style.background="#F9FAFB"; }}
                          onMouseLeave={e => { if(!isOpen) e.currentTarget.style.background="#fff"; }}
                        >
                          {/* chevron */}
                          <td style={{ ...tdSt, width:36, textAlign:"center", color:"#8B3DFF" }}>
                            <span style={{ display:"inline-flex", transform: isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}>
                              <ChevronDown style={{ width:16,height:16 }}/>
                            </span>
                          </td>
                          <td style={{ ...tdSt, color:"#6b7280", whiteSpace:"nowrap", fontSize:12.5 }}>
                            Personal
                          </td>
                          <td style={{ ...tdSt, fontWeight:700, color:"#1f2937", fontSize:13 }}>
                            <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
                              <User style={{ width:14,height:14,color:"#8B3DFF" }}/>
                              {cName} {c.dni ? `(${c.dni})` : ""}
                            </span>
                          </td>
                          <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{c.licencia || "—"}</td>
                          {/* span remaining cols with summary */}
                          <td colSpan={6} style={{ ...tdSt }}>
                            <span style={{ display:"flex",alignItems:"center",gap:10 }}>
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#059669",background:"#ECFDF5",padding:"3px 10px",borderRadius:999 }}>
                                <span style={{ width:6,height:6,borderRadius:"50%",background:"#059669",display:"inline-block" }}/>
                                {vigentes} Vigente{vigentes!==1?"s":""}
                              </span>
                              {pendientes > 0 && (
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#64748B",background:"#F1F5F9",padding:"3px 10px",borderRadius:999 }}>
                                  <span style={{ width:6,height:6,borderRadius:"50%",background:"#64748B",display:"inline-block" }}/>
                                  {pendientes} Pendiente{pendientes!==1?"s":""}
                                </span>
                              )}
                              <span style={{ fontSize:11.5,color:"#9ca3af",marginLeft:4 }}>{vigentes}/{DRIVER_SLOTS.length} documentos</span>
                            </span>
                          </td>
                          <td style={{ ...tdSt, textAlign:"center" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDriver(cid); }}
                              style={{ width:30,height:30,border:"none",background:"#FEF2F2",color:"#DC2626",borderRadius:8,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center" }}
                              title="Eliminar conductor y sus documentos"
                            >
                              <Trash2 style={{ width:15,height:15 }}/>
                            </button>
                          </td>
                        </tr>

                        {/* ── DRIVER SLOT ROWS (accordion) ── */}
                        {isOpen && DRIVER_SLOTS.map((slot, si) => {
                          const d = slotDocs[slot];
                          const hasdoc = !!d;
                          const menuKey = `${cid}-${slot}`;
                          const menuOpen = openMenu === menuKey;

                          // Determine status
                          let est = "Pendiente";
                          let atraso = "—";
                          if (hasdoc) {
                            est = d.est || "Vigente";
                            atraso = d.atr || "—";
                          }
                          const estStyle = {
                            Vigente:   { color:"#059669", bg:"#ECFDF5" },
                            Vencido:   { color:"#DC2626", bg:"#FEF2F2" },
                            Próximo:   { color:"#D97706", bg:"#FFFBEB" },
                            Pendiente: { color:"#64748B", bg:"#F1F5F9" },
                            Archivado: { color:"#64748B", bg:"#F1F5F9" },
                          }[est] || { color:"#64748B", bg:"#F1F5F9" };

                          return (
                            <tr
                              key={slot}
                              style={{
                                borderTop:"1px solid #EEF0F2",
                                background: si%2===0 ? "#FDFCFF" : "#FAF9FF",
                                transition:"background .12s",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background="#F1EAFF"}
                              onMouseLeave={e => e.currentTarget.style.background= si%2===0?"#FDFCFF":"#FAF9FF"}
                            >
                              {/* indent spacer */}
                              <td style={{ ...tdSt, width:36, borderLeft:"3px solid #8B3DFF" }}/>
                              {/* tipo col */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>Personal</td>
                              {/* DNI / Conductor */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>{cName}</td>
                              {/* Licencia */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>{c.licencia || "—"}</td>
                              {/* documento */}
                              <td style={{ ...tdSt, fontWeight:600, color:"#374151", fontSize:13 }}>
                                <span style={{ display:"flex",alignItems:"center",gap:7 }}>
                                  <FileText style={{ width:14,height:14,color: hasdoc?"#8B3DFF":"#9ca3af" }}/>
                                  {slot}
                                </span>
                              </td>
                              {/* estado */}
                              <td style={tdSt}>
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,borderRadius:999,fontWeight:600,fontSize:11,padding:"3px 10px",color:estStyle.color,background:estStyle.bg,whiteSpace:"nowrap" }}>
                                  <span style={{ width:6,height:6,borderRadius:"50%",background:estStyle.color,display:"inline-block" }}/>
                                  {hasdoc ? est : "Pendiente de cargar"}
                                </span>
                              </td>
                              {/* emisión */}
                              <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{hasdoc ? (d.emi || "—") : "—"}</td>
                              {/* vencimiento */}
                              <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{hasdoc ? (d.ven || "—") : "—"}</td>
                              {/* atraso */}
                              <td style={{ ...tdSt, fontSize:12.5, whiteSpace:"nowrap", color: est==="Vencido"?"#DC2626":"#9ca3af", fontWeight: est==="Vencido"?600:400 }}>
                                {atraso}
                              </td>
                              {/* creado por */}
                              <td style={tdSt}>
                                {hasdoc ? (
                                  <>
                                    <div style={{ color:"#374151",fontSize:12.5 }}>{d.por || "—"}</div>
                                    <div style={{ color:"#9ca3af",fontSize:11 }}>{d.el || ""}</div>
                                  </>
                                ) : <span style={{ color:"#9ca3af",fontSize:12 }}>—</span>}
                              </td>
                              {/* acciones */}
                              <td style={{ ...tdSt, position:"relative" }}>
                                <button
                                  onClick={() => setOpenMenu(menuOpen ? null : menuKey)}
                                  style={{ width:30,height:30,border:"none",background:"none",color:"#6b7280",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                                  onMouseEnter={e=>e.currentTarget.style.background="#F3F4F6"}
                                  onMouseLeave={e=>e.currentTarget.style.background="none"}
                                >
                                  <MoreHorizontal style={{ width:16,height:16 }}/>
                                </button>
                                {menuOpen && (
                                  <div style={{ position:"absolute",right:8,top:44,width:230,background:"#fff",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:"6px 0",zIndex:40 }}>
                                    {!hasdoc && (
                                      <button
                                        onClick={() => { setOpenMenu(null); setAddForm(slot); setNewDoc({ conductor_id: cid, doc: slot, por: cName }); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <UploadCloud style={{ width:15,height:15,color:"#8B3DFF" }}/> Cargar documento
                                      </button>
                                    )}
                                    {hasdoc && (<>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleView(d.id, d.filename); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Eye style={{ width:15,height:15,color:"#9ca3af" }}/> Visualizar documento
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleDownload(d.id, d.filename); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Download style={{ width:15,height:15,color:"#9ca3af" }}/> Descargar documento
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenu(null); setAddForm(slot); setNewDoc({ conductor_id: cid, doc: slot, por: cName, emi: d.emi, ven: d.ven, ref: d.ref, desc: d.desc }); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <UploadCloud style={{ width:15,height:15,color:"#9ca3af" }}/> Editar / reemplazar
                                      </button>
                                      <div style={{ height:1,background:"#F3F4F6",margin:"4px 0" }}/>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleDelete(d.id); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#DC2626",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Trash2 style={{ width:15,height:15,color:"#DC2626" }}/> Eliminar documento
                                      </button>
                                    </>)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            );
          })() : !isTemplate && tab === "Viajes" ? (() => {
            // ── VIAJES ACCORDION ──────────────────────────────────────────
            const VIAJE_SLOTS = [
              "Guía de remisión producto",
              "Guía de transportista",
              "Factura",
              "Pesos y medidas",
              "OC"
            ];

            // List of trips: build from unique viaje_id/fallback from docs
            const uniqueTrips = {};
            docs.filter(d => d.tipo === "Viajes").forEach((d, idx) => {
              const code = d.viaje_id || `VIAJE-${100 + (idx % 2)}`;
              if (!uniqueTrips[code]) {
                uniqueTrips[code] = {
                  id: code,
                  codigo: code,
                  ruta: code === "VIAJE-100" ? "Lima - Chimbote" : "Chimbote - Trujillo",
                  tipo: "Viaje comercial"
                };
              }
            });
            const tripList = Object.values(uniqueTrips);

            // Build a lookup: tripId → { slotName → doc }
            const docsByTrip = {};
            docs.filter(d => d.tipo === "Viajes").forEach((d, idx) => {
              const code = d.viaje_id || `VIAJE-${100 + (idx % 2)}`;
              if (!docsByTrip[code]) docsByTrip[code] = {};
              
              VIAJE_SLOTS.forEach(slot => {
                const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,"");
                const docName = norm(d.doc || "");
                const slotName = norm(slot);
                let isMatch = docName.includes(slotName);
                if (slot === "Guía de remisión producto" && (docName.includes("remision") || docName.includes("producto"))) {
                  isMatch = true;
                }
                if (slot === "Guía de transportista" && (docName.includes("transportista") || docName.includes("manifiesto"))) {
                  isMatch = true;
                }
                if (isMatch) {
                  docsByTrip[code][slot] = d;
                }
              });
            });

            if (loading) return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1100 }}>
                <tbody>
                  <tr><td colSpan={10} style={{ padding:"40px",textAlign:"center",color:"#8B3DFF",fontWeight:600,fontSize:14 }}>
                    <span style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                      <Loader2 className="w-5 h-5 animate-spin"/> Cargando...
                    </span>
                  </td></tr>
                </tbody>
              </table>
            );

            if (tripList.length === 0) return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1100 }}>
                <tbody>
                  <tr><td colSpan={10} style={{ textAlign:"center",padding:"40px",fontSize:13,color:"#9ca3af" }}>
                    No hay viajes registrados. Agrega documentos de viaje con un código correspondiente.
                  </td></tr>
                </tbody>
              </table>
            );

            const thSt2 = { ...thSt, fontSize:11.5, padding:"12px 14px" };

            return (
              <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1200 }}>
                <thead>
                  <tr style={{ background:"#241B4A" }}>
                    {["","TIPO","CÓDIGO / VIAJE","RUTA / DETALLE","DOCUMENTO","ESTADO","EMISIÓN","VENCIMIENTO","ATRASO","CREADO POR / EL","ACCIONES"].map((h,i)=>(
                      <th key={i} style={thSt2}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tripList.map((t, ti) => {
                    const code = t.codigo;
                    const isOpen = !!expandedViajes[code];
                    const slotDocs = docsByTrip[code] || {};
                    const vigentes = VIAJE_SLOTS.filter(s => slotDocs[s]).length;
                    const pendientes = VIAJE_SLOTS.length - vigentes;

                    return (
                      <React.Fragment key={code}>
                        {/* ── TRIP HEADER ROW ── */}
                        <tr
                          style={{
                            borderTop: ti === 0 ? "none" : "1px solid #E5E7EB",
                            background: isOpen ? "#F5F3FF" : "#fff",
                            cursor: "pointer",
                            transition: "background .15s",
                          }}
                          onClick={() => setExpandedViajes(p => ({ ...p, [code]: !p[code] }))}
                          onMouseEnter={e => { if(!isOpen) e.currentTarget.style.background="#F9FAFB"; }}
                          onMouseLeave={e => { if(!isOpen) e.currentTarget.style.background="#fff"; }}
                        >
                          {/* chevron */}
                          <td style={{ ...tdSt, width:36, textAlign:"center", color:"#8B3DFF" }}>
                            <span style={{ display:"inline-flex", transform: isOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}>
                              <ChevronDown style={{ width:16,height:16 }}/>
                            </span>
                          </td>
                          <td style={{ ...tdSt, color:"#6b7280", whiteSpace:"nowrap", fontSize:12.5 }}>
                            Viajes
                          </td>
                          <td style={{ ...tdSt, fontWeight:700, color:"#1f2937", fontSize:13 }}>
                            <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
                              <Route style={{ width:14,height:14,color:"#8B3DFF" }}/>
                              {code}
                            </span>
                          </td>
                          <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{t.ruta}</td>
                          {/* span remaining cols with summary */}
                          <td colSpan={6} style={{ ...tdSt }}>
                            <span style={{ display:"flex",alignItems:"center",gap:10 }}>
                              <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#059669",background:"#ECFDF5",padding:"3px 10px",borderRadius:999 }}>
                                <span style={{ width:6,height:6,borderRadius:"50%",background:"#059669",display:"inline-block" }}/>
                                {vigentes} Vigente{vigentes!==1?"s":""}
                              </span>
                              {pendientes > 0 && (
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:"#64748B",background:"#F1F5F9",padding:"3px 10px",borderRadius:999 }}>
                                  <span style={{ width:6,height:6,borderRadius:"50%",background:"#64748B",display:"inline-block" }}/>
                                  {pendientes} Pendiente{pendientes!==1?"s":""}
                                </span>
                              )}
                              <span style={{ fontSize:11.5,color:"#9ca3af",marginLeft:4 }}>{vigentes}/{VIAJE_SLOTS.length} documentos</span>
                            </span>
                          </td>
                          <td style={{ ...tdSt, textAlign:"center" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteViaje(code); }}
                              style={{ width:30,height:30,border:"none",background:"#FEF2F2",color:"#DC2626",borderRadius:8,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center" }}
                              title="Eliminar viaje y sus documentos"
                            >
                              <Trash2 style={{ width:15,height:15 }}/>
                            </button>
                          </td>
                        </tr>

                        {/* ── TRIP SLOT ROWS (accordion) ── */}
                        {isOpen && VIAJE_SLOTS.map((slot, si) => {
                          const d = slotDocs[slot];
                          const hasdoc = !!d;
                          const menuKey = `${code}-${slot}`;
                          const menuOpen = openMenu === menuKey;

                          // Determine status
                          let est = "Pendiente";
                          let atraso = "—";
                          if (hasdoc) {
                            est = d.est || "Vigente";
                            atraso = d.atr || "—";
                          }
                          const estStyle = {
                            Vigente:   { color:"#059669", bg:"#ECFDF5" },
                            Vencido:   { color:"#DC2626", bg:"#FEF2F2" },
                            Próximo:   { color:"#D97706", bg:"#FFFBEB" },
                            Pendiente: { color:"#64748B", bg:"#F1F5F9" },
                            Archivado: { color:"#64748B", bg:"#F1F5F9" },
                          }[est] || { color:"#64748B", bg:"#F1F5F9" };

                          return (
                            <tr
                              key={slot}
                              style={{
                                borderTop:"1px solid #EEF0F2",
                                background: si%2===0 ? "#FDFCFF" : "#FAF9FF",
                                transition:"background .12s",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background="#F1EAFF"}
                              onMouseLeave={e => e.currentTarget.style.background= si%2===0?"#FDFCFF":"#FAF9FF"}
                            >
                              {/* indent spacer */}
                              <td style={{ ...tdSt, width:36, borderLeft:"3px solid #8B3DFF" }}/>
                              {/* tipo col */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>Viajes</td>
                              {/* Código */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>{code}</td>
                              {/* Ruta */}
                              <td style={{ ...tdSt, color:"#9ca3af", fontSize:12 }}>{t.ruta}</td>
                              {/* documento */}
                              <td style={{ ...tdSt, fontWeight:600, color:"#374151", fontSize:13 }}>
                                <span style={{ display:"flex",alignItems:"center",gap:7 }}>
                                  <FileText style={{ width:14,height:14,color: hasdoc?"#8B3DFF":"#9ca3af" }}/>
                                  {slot}
                                </span>
                              </td>
                              {/* estado */}
                              <td style={tdSt}>
                                <span style={{ display:"inline-flex",alignItems:"center",gap:5,borderRadius:999,fontWeight:600,fontSize:11,padding:"3px 10px",color:estStyle.color,background:estStyle.bg,whiteSpace:"nowrap" }}>
                                  <span style={{ width:6,height:6,borderRadius:"50%",background:estStyle.color,display:"inline-block" }}/>
                                  {hasdoc ? est : "Pendiente de cargar"}
                                </span>
                              </td>
                              {/* emisión */}
                              <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{hasdoc ? (d.emi || "—") : "—"}</td>
                              {/* vencimiento */}
                              <td style={{ ...tdSt, color:"#6b7280", fontSize:12.5 }}>{hasdoc ? (d.ven || "—") : "—"}</td>
                              {/* atraso */}
                              <td style={{ ...tdSt, fontSize:12.5, whiteSpace:"nowrap", color: est==="Vencido"?"#DC2626":"#9ca3af", fontWeight: est==="Vencido"?600:400 }}>
                                {atraso}
                              </td>
                              {/* creado por */}
                              <td style={tdSt}>
                                {hasdoc ? (
                                  <>
                                    <div style={{ color:"#374151",fontSize:12.5 }}>{d.por || "—"}</div>
                                    <div style={{ color:"#9ca3af",fontSize:11 }}>{d.el || ""}</div>
                                  </>
                                ) : <span style={{ color:"#9ca3af",fontSize:12 }}>—</span>}
                              </td>
                              {/* acciones */}
                              <td style={{ ...tdSt, position:"relative" }}>
                                <button
                                  onClick={() => setOpenMenu(menuOpen ? null : menuKey)}
                                  style={{ width:30,height:30,border:"none",background:"none",color:"#6b7280",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                                  onMouseEnter={e=>e.currentTarget.style.background="#F3F4F6"}
                                  onMouseLeave={e=>e.currentTarget.style.background="none"}
                                >
                                  <MoreHorizontal style={{ width:16,height:16 }}/>
                                </button>
                                {menuOpen && (
                                  <div style={{ position:"absolute",right:8,top:44,width:230,background:"#fff",border:"1px solid #E5E7EB",borderRadius:12,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:"6px 0",zIndex:40 }}>
                                    {!hasdoc && (
                                      <button
                                        onClick={() => { setOpenMenu(null); setAddForm(slot); setNewDoc({ viaje_id: code, doc: slot }); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <UploadCloud style={{ width:15,height:15,color:"#8B3DFF" }}/> Cargar documento
                                      </button>
                                    )}
                                    {hasdoc && (<>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleView(d.id, d.filename); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Eye style={{ width:15,height:15,color:"#9ca3af" }}/> Visualizar documento
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleDownload(d.id, d.filename); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Download style={{ width:15,height:15,color:"#9ca3af" }}/> Descargar documento
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenu(null); setAddForm(slot); setNewDoc({ viaje_id: code, doc: slot, emi: d.emi, ven: d.ven, ref: d.ref, desc: d.desc }); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <UploadCloud style={{ width:15,height:15,color:"#9ca3af" }}/> Editar / reemplazar
                                      </button>
                                      <div style={{ height:1,background:"#F3F4F6",margin:"4px 0" }}/>
                                      <button
                                        onClick={() => { setOpenMenu(null); handleDelete(d.id); }}
                                        style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,color:"#DC2626",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                                        onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
                                        onMouseLeave={e=>e.currentTarget.style.background="none"}
                                      >
                                        <Trash2 style={{ width:15,height:15,color:"#DC2626" }}/> Eliminar documento
                                      </button>
                                    </>)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            );
          })() : !isTemplate ? (
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:1120 }}>
              <thead>
                <tr style={{ background:TH }}>
                  {(() => {
                    let cols = ["Nº DOC","TIPO","PLACA","DOCUMENTO","CREADO POR / EL","EMISIÓN","VENCIMIENTO","ATRASO","COMPARTIDO CON","ESTADO","ACCIONES"];
                    if (tab === "Personal") cols = ["Nº DOC","TIPO","DOCUMENTO","CREADO POR / EL","EMISIÓN","VENCIMIENTO","ATRASO","ESTADO","ACCIONES"];
                    if (tab === "Empresa") cols = ["TIPO","DOCUMENTO","CREADO POR / EL","EMISIÓN","VENCIMIENTO","ATRASO","ESTADO","ACCIONES"];
                    return cols.map((h,i) => <th key={i} style={thSt}>{h}</th>);
                  })()}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "40px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#8B3DFF", fontWeight: 600, fontSize: 14 }}>
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
                      {tab !== "Empresa" && (
                        <td style={{ ...tdSt,fontWeight:600,color:"#374151",whiteSpace:"nowrap" }}>
                          {tab === "Personal" ? d.n_doc || "—" : d.id.substring(0,8)}
                        </td>
                      )}
                      <td style={{ ...tdSt,color:"#6b7280",whiteSpace:"nowrap" }}>{d.tipo}</td>
                      {tab !== "Personal" && tab !== "Empresa" && (
                        <td style={{ ...tdSt,color:"#374151",fontWeight:600 }}>{d.placa || "—"}</td>
                      )}
                      <td style={{ ...tdSt,color:"#374151",fontWeight:500 }}>{d.doc}</td>
                      <td style={tdSt}>
                        <div style={{ color:"#374151",fontSize:12.5 }}>{d.por}</div>
                        <div style={{ color:"#9ca3af",fontSize:11 }}>{d.el}</div>
                      </td>
                      <td style={{ ...tdSt,color:"#6b7280",whiteSpace:"nowrap",fontSize:12.5 }}>{d.emi}</td>
                      <td style={{ ...tdSt,color:"#6b7280",whiteSpace:"nowrap",fontSize:12.5 }}>{d.ven}</td>
                      <td style={{ ...tdSt,whiteSpace:"nowrap",fontSize:12.5,color:d.est==="Vencido"?"#DC2626":"#9ca3af",fontWeight:d.est==="Vencido"?600:400 }}>{d.atr}</td>
                      {tab !== "Personal" && tab !== "Empresa" && (
                        <td style={tdSt}>{sharedLabel}</td>
                      )}
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
                              { icon:Eye,      label:"Ver detalles del documento",  onClick: () => { setOpenMenu(null); handleView(d.id, d.filename); } },
                              { icon:Download, label:"Descargar documento",         onClick: () => { setOpenMenu(null); handleDownload(d.id, d.filename); } },
                              { icon:UploadCloud, label:"Editar / reemplazar",       onClick: () => { setOpenMenu(null); setAddForm(d.doc); setNewDoc({ id: d.id, doc: d.doc, emi: d.emi, ven: d.ven, ref: d.ref, desc: d.desc }); } },
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
          ) : isTemplate ? (
            <table style={{ borderCollapse:"collapse",width:"100%",minWidth:760 }}>
              <thead>
                <tr style={{ background:TH }}>
                  {["Nombre de plantilla","Tipo","Campos","Creado por","Estado","Acciones"].map((h,i)=>(
                    <th key={i} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t,i)=>{
                  const miNombre = user?.nombre || "Soporte";
                  const dummyNombres = ["Cindy Coach", "Bisma Ishfaq", "Atif Safeer", "Anwesha Ch.", "Cliente (Subsidio)", "Admin"];
                  const displayPor = dummyNombres.includes(t.por) ? miNombre : t.por;
                  return (
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
                    <td style={{ ...tdSt,color:"#6b7280" }}>{displayPor}</td>
                    <td style={tdSt}><Pill est={t.est}/></td>
                    <td style={{ ...tdSt,position:"relative" }}>
                      <button onClick={()=>setOpenMenu(openMenu === t.id ? null : t.id)}
                        style={{ width:30,height:30,border:"none",background:"none",color:"#6b7280",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#F3F4F6"}
                        onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        <MoreHorizontal style={{ width:16,height:16 }}/>
                      </button>
                      {openMenu === t.id && (
                        <div style={{ position:"absolute",right:8,top:44,width:180,background:"#fff",border:"1px solid #F0F0F3",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:"4px 0",zIndex:40 }}>
                          <button onClick={() => { setOpenMenu(null); setNewTpl(t); setTplModal(true); }}
                            style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",fontSize:13,color:"#4b5563",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                            onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                            onMouseLeave={e=>e.currentTarget.style.background="none"}>
                            <UploadCloud style={{ width:15,height:15,color:"#9ca3af" }}/>Editar plantilla
                          </button>
                          <div style={{ height:1,background:"#F3F4F6",margin:"4px 0" }}/>
                          <button onClick={() => { 
                            setOpenMenu(null); 
                            if(window.confirm("¿Seguro que deseas eliminar esta plantilla?")) {
                              setTemplates(prev => {
                                const nw = prev.filter(x => x.id !== t.id);
                                localStorage.setItem("doc_templates", JSON.stringify(nw));
                                return nw;
                              });
                              showToast("Plantilla eliminada");
                            }
                          }}
                            style={{ width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",fontSize:13,color:"#DC2626",background:"none",border:"none",cursor:"pointer",textAlign:"left" }}
                            onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"}
                            onMouseLeave={e=>e.currentTarget.style.background="none"}>
                            <Trash2 style={{ width:15,height:15,color:"#DC2626" }}/>Eliminar plantilla
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          ) : null}
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

      {/* ══════ MODAL: CARGA MÚLTIPLE ══════ */}
      {multiAddOpen && (
        <ModalOverlay onClose={()=>setMultiAddOpen(false)} maxWidth={700}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:60,borderBottom:"1px solid #EEF0F2",flexShrink:0 }}>
            <h2 style={{ fontSize:16,fontWeight:700,color:"#1f2937" }}>
              Agregar {tab === "Vehículos" ? "Vehículo" : tab === "Personal" ? "Personal" : tab === "Viajes" ? "Viaje" : "Empresa"}
            </h2>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setMultiAddOpen(false)} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 14px",fontSize:13,fontWeight:500,border:"1px solid #E5E7EB",background:"#fff",color:"#374151",borderRadius:8,cursor:"pointer" }}>Cancelar</button>
              <button onClick={handleSaveMulti} disabled={loading} style={{ display:"flex",alignItems:"center",gap:8,height:38,padding:"0 16px",fontSize:13,fontWeight:600,color:"#fff",background:"#8B3DFF",border:"none",borderRadius:8,cursor:"pointer",opacity:loading?0.7:1 }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Guardar Todo"}
              </button>
            </div>
          </div>
          <div style={{ padding: 24, overflowY: "auto" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={lblSt}>{tab === "Vehículos" ? "Placa del vehículo" : tab === "Personal" ? "Nombre del conductor" : tab === "Viajes" ? "Código de viaje / Ruta" : "Empresa"}</label>
              <input style={inputSt} placeholder={tab === "Vehículos" ? "Ej. ABC-123" : ""} value={multiAddData.identifier} onChange={e => setMultiAddData(p => ({ ...p, identifier: e.target.value }))} />
            </div>
            
            <div style={{ fontSize:14, fontWeight:600, color:"#374151", marginBottom:12 }}>Documentos correspondientes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(tab === "Vehículos" ? VEHICULO_SLOTS : tab === "Personal" ? DRIVER_SLOTS : tab === "Viajes" ? VIAJE_SLOTS : EMPRESA_SLOTS).map(slot => {
                const sData = multiAddData.docs[slot] || {};
                return (
                  <div key={slot} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, background: sData.file ? "#F5F3FF" : "#fff", transition: "background .2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: sData.file ? 12 : 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#374151" }}>{slot}</div>
                      <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: sData.file ? "#8B3DFF" : "#6b7280", background: sData.file ? "#E0D4F5" : "#F3F4F6", padding: "6px 12px", borderRadius: 6 }}>
                        <UploadCloud style={{ width: 14, height: 14 }} />
                        <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sData.file ? sData.file.name : "Cargar archivo"}
                        </span>
                        <input type="file" style={{ display: "none" }} onChange={e => {
                          const f = e.target.files[0];
                          if (f) setMultiField(slot, "file", f);
                        }} />
                      </label>
                    </div>
                    {sData.file && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={lblSt}>Fecha de emisión</label>
                          <input type="date" style={inputSt} value={sData.emi || ""} onChange={e => setMultiField(slot, "emi", e.target.value)} />
                        </div>
                        <div>
                          <label style={lblSt}>Fecha de vencimiento</label>
                          <input type="date" style={inputSt} value={sData.ven || ""} onChange={e => setMultiField(slot, "ven", e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
              {tab === "Personal" && (
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lblSt}>Conductor</label>
                  <input style={{ ...inputSt,background:"#F9FAFB",color:"#6b7280" }} readOnly value={newDoc.por||"—"}/>
                </div>
              )}
              {tab === "Viajes" && (
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={lblSt}>Código de Viaje / Ruta</label>
                  <input style={inputSt} placeholder="Ej. V-001 o Ruta Lima-Chimbote" value={newDoc.viaje_id||""} onChange={e=>setNewDoc(p=>({...p,viaje_id:e.target.value.toUpperCase()}))}/>
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
              <div>
                <label style={lblSt}>Campos requeridos</label>
                <input type="number" style={inputSt} placeholder="Ej. 5" value={newTpl.campos||""} onChange={e=>setNewTpl(p=>({...p,campos:parseInt(e.target.value)||0}))}/>
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
