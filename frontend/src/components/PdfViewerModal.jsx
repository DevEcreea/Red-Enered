import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

export default function PdfViewerModal({ open, url, title, onClose, onDownload }) {
  if (!open) return null;

  return (
    <div style={{ position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24 }}>
      <div style={{ position:"absolute",inset:0,background:"rgba(17,24,39,.75)",backdropFilter:"blur(4px)" }} onClick={onClose}/>
      <div style={{ position:"relative",background:"#fff",borderRadius:16,boxShadow:"0 30px 80px rgba(0,0,0,.4)",width:"100%",maxWidth:950,height:"88vh",display:"flex",flexDirection:"column",zIndex:1,overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:"1px solid #E5E7EB",background:"#F9FAFB" }}>
          <h3 style={{ margin:0,fontSize:16,fontWeight:700,color:"#111827" }}>{title || "Visualizador de Documento"}</h3>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ display:"flex",alignItems:"center",gap:6,background:"#F3E8FF",color:"#7C3AED",padding:"6px 12px",borderRadius:8,fontWeight:600,fontSize:13,textDecoration:"none" }}
              >
                <ExternalLink style={{ width:14,height:14 }}/> Abrir en ventana emergente
              </a>
            )}
            {onDownload && (
              <button onClick={onDownload} style={{ display:"flex",alignItems:"center",gap:6,background:"#F3F4F6",border:"none",color:"#374151",padding:"6px 12px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer" }}>
                <Download style={{ width:14,height:14 }}/> Descargar
              </button>
            )}
            <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:"none",background:"#E5E7EB",color:"#4B5563",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
              <X style={{ width:18,height:18 }}/>
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex:1,background:"#525659",position:"relative" }}>
          {url ? (
            <object 
              data={url} 
              type="application/pdf" 
              style={{ width:"100%",height:"100%",border:"none" }}
            >
              <embed 
                src={url} 
                type="application/pdf" 
                style={{ width:"100%",height:"100%",border:"none" }} 
              />
              <iframe 
                src={url} 
                title="PDF Viewer" 
                style={{ width:"100%",height:"100%",border:"none" }}
              />
            </object>
          ) : (
            <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff" }}>
              No se pudo cargar el documento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
