import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatSoles } from "../lib/utils";
import { 
  MapPin, Star, Navigation, Map, TrendingDown,
  CheckCircle2, AlertCircle, RefreshCw, Zap, Lock, Bell, Filter, Search, X
} from "lucide-react";

export default function TabPrecios({ user, ahorroCapturado }) {
  const [precios, setPrecios] = useState([]);
  const [mejorPrecio, setMejorPrecio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Filters state
  const [selDepartamento, setSelDepartamento] = useState("");
  const [selProvincia, setSelProvincia] = useState("");
  const [selDistrito, setSelDistrito] = useState("");
  const [selProducto, setSelProducto] = useState("");
  const [selEstacion, setSelEstacion] = useState("");

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
      </div>      {/* Teaser Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1535] via-[#2A1D4A] to-[#120B24] border border-brand-500/20 p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-2 bg-brand-500/15 border border-brand-400/30 px-3 py-1 rounded-full text-brand-300 text-xs font-semibold backdrop-blur-md">
            <Lock className="w-3.5 h-3.5 text-brand-400" />
            <span>Acceso Privado B2B</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> Cobertura Nacional
            </span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              1.ª red de grifos virtuales <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-brand-300 via-purple-300 to-indigo-200 bg-clip-text text-transparent">
                a nivel nacional
              </span>
            </h2>
            <p className="text-sm text-neutral-300/90 leading-relaxed max-w-xl">
              Accede a precios preferenciales en estaciones estratégicas del país con tu membresía ENERED. Precios transparentes y sincronizados en tiempo real.
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center">
            <div className="w-full max-w-xs bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span>Precio Promedio Pizarra:</span>
                <span className="font-mono text-neutral-400 line-through">S/ 26.50</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-white">
                <span>Precio Especial ENERED:</span>
                <span className="font-mono text-emerald-400 text-base">{formatSoles(mejorPrecio || 25.41)}</span>
              </div>
              <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px] text-brand-300 font-medium">
                <span>Ahorro Estimado:</span>
                <span className="text-emerald-300 font-semibold">~S/ 1.09 / galón</span>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleNotifyToggle}
          className={`mt-6 z-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer ${
            notified 
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/30" 
              : "bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white shadow-brand-900/40"
          }`}
        >
          {notified ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              Notificaciones activadas (Te avisaremos)
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Avísame cuando esté disponible
            </>
          )}
        </button>

        <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 mt-3 z-10">
          <Star className="w-3 h-3 text-neutral-400" /> Exclusivo para flotas ENERED
        </div>
      </div>

      {/* Header and Actions */}
      <div className="flex items-center justify-between">
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

      {/* Filters Bar */}
      {(() => {
        const departamentos = Array.from(new Set(precios.map(p => p.departamento || p.ciudad || "").filter(Boolean))).sort();
        const provincias = Array.from(new Set(precios.filter(p => !selDepartamento || (p.departamento || p.ciudad) === selDepartamento).map(p => p.provincia || "").filter(Boolean))).sort();
        const distritos = Array.from(new Set(precios.filter(p => (!selDepartamento || (p.departamento || p.ciudad) === selDepartamento) && (!selProvincia || p.provincia === selProvincia)).map(p => p.distrito || p.ciudad || "").filter(Boolean))).sort();
        const productos = Array.from(new Set(precios.map(p => p.combustible || "").filter(Boolean))).sort();

        const filteredPrecios = precios.filter(p => {
          const deptVal = p.departamento || p.ciudad || "";
          if (selDepartamento && deptVal !== selDepartamento) return false;
          if (selProvincia && (p.provincia || "") !== selProvincia) return false;
          const distVal = p.distrito || p.ciudad || "";
          if (selDistrito && distVal !== selDistrito) return false;
          if (selProducto && (p.combustible || "") !== selProducto) return false;
          if (selEstacion && !(p.estacion || p.empresa || "").toLowerCase().includes(selEstacion.toLowerCase())) return false;
          return true;
        });

        return (
          <>
            <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-brand-600" /> Filtros por Ubicación y Producto
                </span>
                {(selDepartamento || selProvincia || selDistrito || selProducto || selEstacion) && (
                  <button 
                    onClick={() => {
                      setSelDepartamento("");
                      setSelProvincia("");
                      setSelDistrito("");
                      setSelProducto("");
                      setSelEstacion("");
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Limpiar filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Departamento */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Departamento</label>
                  <select
                    value={selDepartamento}
                    onChange={(e) => {
                      setSelDepartamento(e.target.value);
                      setSelProvincia("");
                      setSelDistrito("");
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="">Todos los dptos.</option>
                    {departamentos.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Provincia */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Provincia</label>
                  <select
                    value={selProvincia}
                    onChange={(e) => {
                      setSelProvincia(e.target.value);
                      setSelDistrito("");
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="">Todas las prov.</option>
                    {provincias.map((pr) => (
                      <option key={pr} value={pr}>{pr}</option>
                    ))}
                  </select>
                </div>

                {/* Distrito */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Distrito / Ciudad</label>
                  <select
                    value={selDistrito}
                    onChange={(e) => setSelDistrito(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="">Todos los distritos</option>
                    {distritos.map((di) => (
                      <option key={di} value={di}>{di}</option>
                    ))}
                  </select>
                </div>

                {/* Producto */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Producto</label>
                  <select
                    value={selProducto}
                    onChange={(e) => setSelProducto(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="">Todos los productos</option>
                    {productos.map((prod) => (
                      <option key={prod} value={prod}>{prod}</option>
                    ))}
                  </select>
                </div>

                {/* Estación */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Estación</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar estación..."
                      value={selEstacion}
                      onChange={(e) => setSelEstacion(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2" />
                  </div>
                </div>
              </div>
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
                    ) : filteredPrecios.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-8 text-center text-neutral-400">
                          No hay estaciones que coincidan con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredPrecios.map((p) => {
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
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
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
          </>
        );
      })()}
    </div>
  );
}
