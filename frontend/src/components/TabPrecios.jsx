import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatSoles } from "../lib/utils";
import { 
  MapPin, Star, Navigation, Map, TrendingDown,
  CheckCircle2, AlertCircle, RefreshCw, Zap
} from "lucide-react";

export default function TabPrecios({ user, ahorroCapturado }) {
  const [precios, setPrecios] = useState([]);
  const [mejorPrecio, setMejorPrecio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
      </div>

      {/* Map Banner */}
      <div 
        onClick={openMap}
        className="bg-neutral-100 border border-neutral-200 rounded-2xl h-[280px] w-full flex items-center justify-center relative overflow-hidden cursor-pointer hover:opacity-95 transition-opacity"
        style={{
          backgroundImage: "url('https://maps.googleapis.com/maps/api/staticmap?center=-8.11599,-79.0258&zoom=13&size=800x300&maptype=roadmap&style=feature:all|element:labels|visibility:off&style=feature:road|color:0xffffff&style=feature:landscape|color:0xf3f4f6')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute top-1/3 left-1/4 bg-emerald-500 px-3 py-1.5 rounded-full shadow-lg font-bold text-sm text-white flex items-center gap-1">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> {formatSoles(mejorPrecio)}
        </div>
        <div className="absolute top-1/2 right-1/3 bg-[#F59E0B] px-3 py-1.5 rounded-full shadow-lg font-bold text-sm text-white flex items-center gap-1">
          {formatSoles(mejorPrecio + 0.3)}
        </div>
        <div className="absolute bottom-1/4 left-1/2 bg-neutral-400 px-3 py-1.5 rounded-full shadow-lg font-bold text-sm text-white flex items-center gap-1">
          {formatSoles(mejorPrecio + 1.2)}
        </div>
        
        <div className="z-10 flex flex-col items-center bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-white/50 shadow-sm">
          <Map className="w-8 h-8 text-brand mb-1" />
          <h3 className="font-cabinet font-bold text-lg text-neutral-800">Red de grifos</h3>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mt-1">Ver mapa interactivo</p>
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
