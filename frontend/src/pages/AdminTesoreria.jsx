import React, { useEffect, useState } from "react";
import { CheckCircle, Clock, XCircle, Search, Eye } from "lucide-react";
import { api, API } from "../lib/api";
import { formatSoles, formatDate } from "../lib/utils";
import { toast } from "sonner";
import PdfViewerModal from "../components/PdfViewerModal";

export default function AdminTesoreria() {
  const [abonos, setAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");

  const fetchAbonos = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/abonos");
      setAbonos(data.data || []);
    } catch (err) {
      toast.error("Error al cargar abonos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbonos();
  }, []);

  const handleValidar = async (id) => {
    if (!window.confirm("¿Confirmas que el dinero ingresó a la cuenta? Esto aplicará los pagos a las facturas pendientes de la empresa.")) return;
    try {
      const res = await api.put(`/abonos/${id}/validar`);
      toast.success(`Abono conciliado. Excedente a favor: ${formatSoles(res.data.monto_excedente)}`);
      fetchAbonos();
    } catch (err) {
      toast.error("Error al conciliar: " + (err.response?.data?.detail || err.message));
    }
  };

  const verVoucher = (url) => {
    const baseUrl = API.replace("/api", "");
    const fullUrl = url.startsWith("/") ? baseUrl + url : url;
    setViewerUrl(fullUrl);
    setViewerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendientes = abonos.filter(a => a.estado === "POR VALIDAR");
  const conciliados = abonos.filter(a => a.estado !== "POR VALIDAR");

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-2xl p-7">
        <h2 className="font-cabinet font-black text-[32px] text-brand leading-tight mb-2">Tesorería</h2>
        <p className="text-neutral-500 font-medium">Gestiona y concilia los abonos registrados por los clientes.</p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200">
        <div className="bg-brand text-white px-5 py-4 text-sm font-semibold">
          Abonos por Validar
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
              <tr>
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">F. Depósito</th>
                <th className="px-5 py-3">Nro. Op</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Voucher</th>
                <th className="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pendientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-neutral-400 font-medium">No hay abonos pendientes de validación.</td>
                </tr>
              ) : (
                pendientes.map(a => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-4 font-bold text-neutral-800">{a.empresa}</td>
                    <td className="px-5 py-4 text-neutral-600">{a.fecha_deposito}</td>
                    <td className="px-5 py-4 text-neutral-600 font-mono">{a.numero_operacion}</td>
                    <td className="px-5 py-4 font-bold text-brand">{formatSoles(a.monto)}</td>
                    <td className="px-5 py-4">
                      <button onClick={() => verVoucher(a.voucher_url)} className="flex items-center gap-1.5 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-md font-bold text-xs hover:bg-cyan-100 transition">
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </button>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => handleValidar(a.id)} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 text-white rounded-md font-bold text-xs hover:bg-green-600 transition mx-auto">
                        <CheckCircle className="w-4 h-4" /> Validar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200">
        <div className="bg-neutral-100 text-neutral-800 px-5 py-4 text-sm font-semibold">
          Historial de Conciliaciones
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
              <tr>
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">F. Depósito</th>
                <th className="px-5 py-3">Nro. Op</th>
                <th className="px-5 py-3">Monto Original</th>
                <th className="px-5 py-3">Excedente Prepago</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {conciliados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-neutral-400 font-medium">No hay abonos conciliados.</td>
                </tr>
              ) : (
                conciliados.map(a => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-4 font-bold text-neutral-800">{a.empresa}</td>
                    <td className="px-5 py-4 text-neutral-600">{a.fecha_deposito}</td>
                    <td className="px-5 py-4 text-neutral-600 font-mono">{a.numero_operacion}</td>
                    <td className="px-5 py-4 font-bold text-neutral-900">{formatSoles(a.monto)}</td>
                    <td className="px-5 py-4 font-bold text-green-600">{formatSoles(a.monto_excedente || 0)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3.5 h-3.5" /> {a.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PdfViewerModal
        open={viewerOpen}
        url={viewerUrl}
        title="Voucher de Pago"
        onClose={() => setViewerOpen(false)}
        onDownload={() => {
          const a = document.createElement("a");
          a.href = viewerUrl;
          a.download = "voucher";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
      />
    </div>
  );
}
