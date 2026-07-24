import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatSoles } from "../lib/utils";
import { 
  MapPin, Star, Navigation, Map, TrendingDown,
  CheckCircle2, AlertCircle, RefreshCw, Zap, Lock, Bell
} from "lucide-react";

export default function TabPrecios({ user, ahorroCapturado }) {
  const [precios, setPrecios] = useState([]);
  const [mejorPrecio, setMejorPrecio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [notified, setNotified] = useState(() => {
    return localStorage.getItem("notify_grifos_virtuales") === "true";
  });

  const handleNotifyToggle = (e) => {
    e.stopPropagation();
    const nextState = !notified;
    setNotified(nextState);
    localStorage.setItem("notify_grifos_virtuales", String(nextState));
  };

  useEffect(() => {
    fetchPrecios();
  }, []);

  const fetchPrecios = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get("/precios");
      setPrecios(res.data.precios || []);
      setMejorPrecio(res.data.mejor_precio || 0);
    } catch (error) {
      console.error("Error fetching precios:", error);
      setErrorMsg(error.response?.status === 404 ? "El backend aún no se actualiza (Error 404)." : error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post("/admin/precios/sync");
      await fetchPrecios();
    } catch (err) {
      alert("Error sincronizando: " + (err.response?.data?.detail || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const openMap = () => {
    window.open("https://maps.app.goo.gl/u3JiKA2w1E8ZWZeX9", "_blank");
  };

  const openStationMap = (estacion, ciudad) => {
    const q = encodeURIComponent(`${estacion} ${ciudad} peru`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6" data-testid="tab-precios">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Ahorro */}
        <div className="bg-[#8039F4] rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
          <Zap className="absolute top-4 right-4 text-white/20 w-16 h-16 -mr-4 -mt-4" />
          <div>
            <div className="text-3xl font-black tracking-tight">{formatSoles(ahorroCapturado)}</div>
            <div className="text-sm font-semibold mt-1">Ahorro potencial capturado</div>
            <div className="text-[10px] text-white/70 mt-1 uppercase tracking-wider">basado en el módulo de combustibles</div>
          </div>
        </div>

        {/* Card 2: Adherencia */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="text-3xl font-black tracking-tight text-neutral-900">0%</div>
            <TrendingDown className="text-neutral-400 w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-600">Adherencia al mejor precio</div>
            <div className="text-[10px] text-neutral-400 mt-1 uppercase tracking-wider">0 de 0 cargas en grifo recomendado</div>
          </div>
        </div>

        {/* Card 3: Grifos (Clickable) */}
        <div 
          onClick={openMap}
          className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-brand hover:shadow-md transition-all group relative overflow-hidden"
        >
          <div className="flex justify-between items-start relative z-10">
            <div className="text-3xl font-black tracking-tight text-neutral-900 group-hover:text-brand transition-colors">
              {"> 352"}
            </div>
            <Map className="text-neutral-400 group-hover:text-brand w-5 h-5 transition-colors" />
          </div>
          <div className="relative z-10">
            <div className="text-sm font-semibold text-neutral-600">Grifos en red ENERED</div>
            <div className="text-[10px] text-neutral-400 mt-1 uppercase tracking-wider group-hover:text-brand/70">Clic para ver en Google Maps</div>
          </div>
        </div>

        {/* Card 4: Mejor Precio */}
        <div className="bg-[#10B981] rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <MapPin className="text-white w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <div className="text-3xl font-black tracking-tight">{formatSoles(mejorPrecio)}</div>
              <div className="text-sm font-medium">/gal</div>
            </div>
            <div className="text-sm font-semibold mt-1">Mejor precio hoy</div>
            <div className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">Precio garantizado en tu zona</div>
          </div>
        </div>
      {/* Red de Grifos Virtuales Banner */}
      <div 
        className="bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/60 border border-purple-100/80 rounded-3xl p-8 md:p-10 w-full flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm"
      >
        {/* Decorative Blurred Price Badges in Background */}
        <div className="absolute top-8 left-10 md:left-20 bg-white/40 border border-purple-200/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-neutral-400 blur-[2px] pointer-events-none select-none">
          S/ 17.50
        </div>
        <div className="absolute bottom-10 left-16 md:left-32 bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-emerald-600 blur-[2.5px] pointer-events-none select-none">
          S/ 16.90
        </div>
        <div className="absolute top-12 right-12 md:right-28 bg-white/40 border border-purple-200/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-neutral-400 blur-[2px] pointer-events-none select-none">
          S/ 18.20
        </div>
        <div className="absolute bottom-12 right-16 md:right-36 bg-amber-500/20 border border-amber-500/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-600 blur-[2.5px] pointer-events-none select-none">
          S/ 17.80
        </div>

        {/* Lock Icon Box */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4 z-10">
          <Lock className="w-6 h-6 stroke-[2.5]" />
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/80 border border-purple-200 text-purple-700 text-[11px] font-extrabold uppercase tracking-wider mb-4 z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
          EN DESARROLLO
        </div>

        {/* Main Heading */}
        <h2 className="font-cabinet font-black text-2xl md:text-3xl text-neutral-900 max-w-2xl leading-tight mb-3 z-10">
          Aquí nace la <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 bg-clip-text text-transparent">1.ª red de grifos virtuales</span> a nivel nacional
        </h2>

        {/* Description */}
        <p className="text-sm md:text-base text-neutral-500 max-w-xl leading-relaxed mb-6 z-10">
          Muy pronto ENERED te mostrará, en tiempo real, el precio de combustible de <strong className="text-neutral-700 font-bold">todos los grifos del Perú</strong> — para que sepas siempre dónde te conviene repostar, antes de llegar al surtidor.
        </p>

        {/* Action Button */}
        <button
          onClick={handleNotifyToggle}
          className={`px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all duration-200 flex items-center gap-2.5 z-10 transform active:scale-95 ${
            notified
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
              : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/25 hover:shadow-purple-500/35"
          }`}
        >
          {notified ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              ¡Te avisaremos cuando esté disponible!
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Avísame cuando esté disponible
            </>
          )}
        </button>

        {/* Sub-label */}
        <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 mt-3 z-10">
          <Star className="w-3 h-3 text-neutral-400" /> Exclusivo para flotas ENERED
        </div>
      </div>

      {/* Header and Actions */}
      <div className="flex items-center justify-between mt-4">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">LISTA DE PRECIOS</h3>
        {user?.role === "admin_enered" && (
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className="btn-brand text-xs px-4 py-2 flex items-center gap-2 rounded-lg"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Sheet"}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2A2045] text-white text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold rounded-tl-xl">Estación</th>
                <th className="px-6 py-4 font-semibold">Ciudad</th>
                <th className="px-6 py-4 font-semibold text-center">Calidad</th>
                <th className="px-6 py-4 font-semibold text-right">Pizarra</th>
                <th className="px-6 py-4 font-semibold text-right text-brand-300">ENERED</th>
                <th className="px-6 py-4 font-semibold text-right">Diferencia</th>
                <th className="px-6 py-4 font-semibold text-center">Factura</th>
                <th className="px-6 py-4 font-semibold text-center">Tarjeta</th>
                <th className="px-6 py-4 font-semibold text-center rounded-tr-xl">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-neutral-400">
                    Cargando precios...
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-red-500 font-bold">
                    {errorMsg}
                  </td>
                </tr>
              ) : precios.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-neutral-400">
                    No hay precios sincronizados para esta empresa.
                  </td>
                </tr>
              ) : (
                precios.map((p) => {
                  const diff = (p.precio_pizarra || 0) - (p.precio_venta || 0);
                  const isAhorro = diff > 0;
                  
                  return (
                    <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-neutral-900">{p.estacion || p.empresa}</span>
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <span className="text-[10px] text-neutral-400 mt-0.5">
                            Estación ENERED | {p.combustible}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-brand">
                        {p.ciudad}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-neutral-500">
                        {formatSoles(p.precio_pizarra)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">
                        {formatSoles(p.precio_venta)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold">
                        <span className={isAhorro ? "text-emerald-500" : "text-rose-500"}>
                          {isAhorro ? "-" : "+"}{formatSoles(Math.abs(diff))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-semibold text-emerald-600">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Acepta
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => openStationMap(p.estacion || p.empresa, p.ciudad)}
                            className="bg-brand text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded-full hover:bg-brand-600 transition-colors flex items-center gap-1"
                          >
                            <Navigation className="w-3 h-3" /> Dirigir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
