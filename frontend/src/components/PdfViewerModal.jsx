import React from 'react';
import { X, Download } from 'lucide-react';

export default function PdfViewerModal({ open, url, title, onClose, onDownload }) {
  if (!open) return null;

  return (
    <div style={{ position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24 }}>
      <div style={{ position:"absolute",inset:0,background:"rgba(17,24,39,.7)" }} onClick={onClose}/>
      <div style={{ position:"relative",background:"#fff",borderRadius:16,boxShadow:"0 30px 80px rgba(0,0,0,.3)",width:"100%",maxWidth:900,height:"85vh",display:"flex",flexDirection:"column",zIndex:1,overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 24px",borderBottom:"1px solid #E5E7EB",background:"#F9FAFB" }}>
          <h3 style={{ margin:0,fontSize:16,fontWeight:700,color:"#111827" }}>{title || "Visualizador de Documento"}</h3>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            {onDownload && (
              <button onClick={onDownload} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#8B3DFF",fontWeight:600,fontSize:13,cursor:"pointer" }}>
                <Download style={{ width:16,height:16 }}/> Descargar
              </button>
            )}
            <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:"none",background:"#E5E7EB",color:"#4B5563",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
              <X style={{ width:18,height:18 }}/>
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex:1,background:"#e5e7eb",position:"relative" }}>
          {url ? (
            <iframe 
              src={url} 
              title="PDF Viewer" 
              style={{ width:"100%",height:"100%",border:"none" }}
            />
          ) : (
            <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280" }}>
              No se pudo cargar el documento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
