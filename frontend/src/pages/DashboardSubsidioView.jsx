import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Fuel, Banknote, Receipt, TrendingUp, FileCheck2, Truck,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from "recharts";
import { api } from "../lib/api";

export default function DashboardSubsidioView() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/subsidio/dashboard-data");
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center" data-testid="dashboard-subsidio-loading">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }
  if (!data) return null;

  const { kpis, serie_mensual, top_placas, ultimas_facturas } = data;
  const fmt = (n) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6" data-testid="dashboard-subsidio">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-brand">DU 004-2026</span>
          <h2 className="font-cabinet text-2xl font-bold text-neutral-900 mt-1">Tu subsidio en cifras</h2>
          <p className="text-sm text-neutral-500 mt-1">Datos extraídos de tus facturas confirmadas.</p>
        </div>
        <button
          onClick={() => navigate("/subsidio/documentos")}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg flex items-center gap-2"
          data-testid="dashboard-subsidio-cta-expediente"
        >
          <FileCheck2 className="w-4 h-4" /> Subir más facturas
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Receipt} label="Facturas confirmadas" value={kpis.facturas_confirmadas} accent="brand" testid="kpi-facturas" />
        <Kpi icon={Fuel} label="Galones confirmados" value={fmt(kpis.galones_confirmados)} suffix=" gl" accent="cyan" testid="kpi-galones" />
        <Kpi icon={Banknote} label="Importe total" value={`S/ ${fmt(kpis.importe_total)}`} accent="emerald" testid="kpi-importe" />
        <Kpi icon={TrendingUp} label="Subsidio estimado" value={`S/ ${fmt(kpis.subsidio_estimado)}`} accent="amber" testid="kpi-subsidio-estimado" />
        <Kpi icon={TrendingUp} label="Subsidio reconocido" value={`S/ ${fmt(kpis.subsidio_reconocido)}`} accent="brand" testid="kpi-subsidio-reconocido" />
        <Kpi icon={Banknote} label="Precio promedio" value={`S/ ${fmt(kpis.precio_promedio)}/gl`} accent="neutral" testid="kpi-precio-prom" />
      </div>

      {/* Serie mensual */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-cabinet text-lg font-bold mb-3">Consumo confirmado por mes</h3>
        {serie_mensual.length === 0 ? (
          <Empty msg="Aún no hay facturas confirmadas. Sube comprobantes para que aparezca aquí." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serie_mensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="mes" stroke="#737373" fontSize={12} />
              <YAxis stroke="#737373" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="galones" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }} name="Galones" />
              <Line type="monotone" dataKey="importe" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Importe S/" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top placas */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-cabinet text-lg font-bold mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand" /> Top placas (galones)
          </h3>
          {top_placas.length === 0 ? (
            <Empty msg="Sin datos aún." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top_placas} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" stroke="#737373" fontSize={11} />
                <YAxis type="category" dataKey="placa" stroke="#737373" fontSize={11} width={70} />
                <Tooltip />
                <Bar dataKey="galones" fill="#7c3aed" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ultimas facturas */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-cabinet text-lg font-bold mb-3">Últimas facturas confirmadas</h3>
          {ultimas_facturas.length === 0 ? (
            <Empty msg="Sin facturas confirmadas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="tabla-ultimas-facturas">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2">Placa</th>
                    <th className="py-2 pr-2">Estación</th>
                    <th className="py-2 pr-2 text-right">Gl</th>
                    <th className="py-2 text-right">S/</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimas_facturas.map((f, i) => (
                    <tr key={f.id || i} className="border-b border-neutral-50">
                      <td className="py-2 pr-2 text-neutral-600">{f.fecha || "—"}</td>
                      <td className="py-2 pr-2 font-bold">{f.placa || "—"}</td>
                      <td className="py-2 pr-2 text-neutral-600 truncate max-w-[160px]">{f.estacion || "—"}</td>
                      <td className="py-2 pr-2 text-right">{fmt(f.galones)}</td>
                      <td className="py-2 text-right font-bold">{fmt(f.importe_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, suffix = "", accent = "brand", testid }) {
  const colors = {
    brand: "bg-brand text-white",
    cyan: "bg-cyan-100 text-cyan-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    neutral: "bg-neutral-100 text-neutral-700",
  };
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm" data-testid={testid}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[accent]}`}>
        <Icon className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">{label}</div>
      <div className="font-cabinet text-xl font-bold mt-0.5">{value}{suffix}</div>
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="text-center py-10 text-sm text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl">
      {msg}
    </div>
  );
}
