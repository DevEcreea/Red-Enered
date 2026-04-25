import React, { useEffect, useMemo, useState } from "react";
import { QrCode, Download, Search } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function QRDescarga() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const params = empresa ? { empresa } : {};
    api.get("/qr/list", { params }).then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, [empresa]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return items;
    return items.filter((i) => i.placa.includes(q));
  }, [items, search]);

  const handleDownload = async (placa, item_empresa) => {
    try {
      const params = user?.role === "admin_enered" ? { empresa: item_empresa } : {};
      const r = await api.get(`/qr/download/${placa}`, { params, responseType: "blob" });
      const blob = new Blob([r.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR_${placa}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudo descargar el QR");
    }
  };

  return (
    <div className="space-y-6" data-testid="qr-descarga-page">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Códigos QR</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Descarga tus QR</h1>
        <p className="text-neutral-500 mt-1 text-sm">Códigos QR por unidad para uso en estaciones afiliadas a la red ENERED.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[220px]"
            data-testid="qr-empresa-filter"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <div className="flex items-center h-10 w-64 bg-white rounded-md px-3 border border-border">
          <Search className="w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar placa…"
            className="flex-1 ml-2 bg-transparent outline-none text-sm"
            data-testid="qr-search"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <QrCode className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <div className="font-cabinet font-bold text-neutral-700">Aún no hay QR cargados</div>
          <p className="text-sm text-neutral-500 mt-1">El equipo ENERED se encarga de cargar los QR de tu flota. Si necesitas alguno con urgencia, escríbenos por soporte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-testid="qr-grid">
          {filtered.map((item) => (
            <div key={`${item.empresa}__${item.placa}`} className="bg-white border border-border rounded-2xl p-4 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
              <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-brand/10 to-brand/5 border border-brand/20 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-brand" strokeWidth={1.25} />
              </div>
              <div className="text-center">
                <div className="font-cabinet font-black text-base text-neutral-900">{item.placa}</div>
                {user?.role === "admin_enered" && (
                  <div className="text-[10px] text-neutral-500 font-semibold mt-0.5 truncate max-w-[140px]">{item.empresa}</div>
                )}
              </div>
              <button
                onClick={() => handleDownload(item.placa, item.empresa)}
                className="w-full h-9 rounded-md bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-brand-hover"
                data-testid={`qr-download-${item.placa}`}
              >
                <Download className="w-3.5 h-3.5" /> Descargar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
