import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../lib/api";
import { formatSoles } from "../lib/utils";
import { Zap, Fuel, MapPin, TrendingDown, Filter, Search, ChevronLeft, ChevronRight, Edit3, X, Save, RefreshCw } from "lucide-react";
import { UBIGEO_PERU, DEPARTAMENTOS_PERU } from "../lib/ubigeoPeru";

export default function TabPrecios({ user, ahorroCapturado = 0, handleSync, syncing, isMobile = false }) {
  // Updated 2026-08-04 - Standardized TabPrecios table format
  // Modal Admin
  const [editModalStation, setEditModalStation] = useState(null);
  const [inputPrecioEnered, setInputPrecioEnered] = useState("");
  const [selClienteModal, setSelClienteModal] = useState("GENERAL");
  const [listaClientes, setListaClientes] = useState([]);
  const [savingEnered, setSavingEnered] = useState(false);

  useEffect(() => {
    api.get("/precios/ubicaciones")
      .then((r) => {
        if (r.data.departamentos?.length) {
          const merged = sortedUnique([...DEPARTAMENTOS_PERU, ...r.data.departamentos]);
          setListaDepartamentos(merged);
        }
      })
      .catch(() => {});

    api.get("/precios/combustibles")
      .then((r) => {
        if (r.data.combustibles?.length) setCombustiblesDisponibles(r.data.combustibles);
      })
      .catch(() => {});

    api.get("/precios/clientes-list")
      .then((r) => {
        if (r.data.clientes?.length) setListaClientes(r.data.clientes);
      })
      .catch(() => {});
  }, []);

  const sortedUnique = (arr) => [...new Set(arr.map((x) => (x || "").trim().toUpperCase()).filter(Boolean))].sort();

  const fetchPrecios = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const params = new URLSearchParams();
      if (selDepartamento) params.append("departamento", selDepartamento);
      if (selProvincia) params.append("provincia", selProvincia);
      if (selDistrito) params.append("distrito", selDistrito);
      if (selCombustible) params.append("combustible", selCombustible);
      if (soloEnered) params.append("solo_enered", "true");

      const res = await api.get(`/precios?${params.toString()}`);
      setPrecios(res.data.precios || []);
      setMejorPrecio(res.data.mejor_precio || 0);
      setFuente(res.data.fuente || "facilito");
      setLastSync(res.data.last_sync || null);
      setTotalRegistros(res.data.total || 0);
    } catch (error) {
      setErrorMsg(error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  }, [selDepartamento, selProvincia, selDistrito, selCombustible, soloEnered]);

  useEffect(() => {
    fetchPrecios();
  }, [fetchPrecios]);

  const provinciasDisponibles = useMemo(() => {
    let provStatic = [];
    if (selDepartamento && UBIGEO_PERU[selDepartamento.toUpperCase()]) {
      provStatic = Object.keys(UBIGEO_PERU[selDepartamento.toUpperCase()]);
    }
    let pool = precios;
    if (selDepartamento) {
      pool = pool.filter((p) => (p.departamento || "").toUpperCase() === selDepartamento.toUpperCase());
    }
    const provFromData = pool.map((p) => p.provincia);
    return sortedUnique([...provStatic, ...provFromData]);
  }, [precios, selDepartamento]);

  const distritosDisponibles = useMemo(() => {
    let distStatic = [];
    if (selDepartamento && selProvincia && UBIGEO_PERU[selDepartamento.toUpperCase()]?.[selProvincia.toUpperCase()]) {
      distStatic = UBIGEO_PERU[selDepartamento.toUpperCase()][selProvincia.toUpperCase()];
    }
    let pool = precios;
    if (selDepartamento) {
      pool = pool.filter((p) => (p.departamento || "").toUpperCase() === selDepartamento.toUpperCase());
    }
    if (selProvincia) {
      pool = pool.filter((p) => (p.provincia || "").toUpperCase() === selProvincia.toUpperCase());
    }
    const distFromData = pool.map((p) => p.distrito || p.ciudad);
    return sortedUnique([...distStatic, ...distFromData]);
  }, [precios, selDepartamento, selProvincia]);

  const filteredPrecios = useMemo(() => {
    return precios.filter((p) => {
      if (selEstacion) {
        const query = selEstacion.toLowerCase();
        const est = (p.establecimiento || p.estacion || p.empresa || "").toLowerCase();
        const dir = (p.direccion || "").toLowerCase();
        if (!est.includes(query) && !dir.includes(query)) return false;
      }
      return true;
    });
  }, [precios, selEstacion]);

  const paginatedPrecios = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPrecios.slice(start, start + pageSize);
  }, [filteredPrecios, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredPrecios.length / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [selDepartamento, selProvincia, selDistrito, selCombustible, selEstacion, soloEnered]);


  const openStationMap = (estacion, ciudad) => {
    const q = encodeURIComponent(`${estacion} ${ciudad} peru`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  const openRouteMap = (estacion, ciudad) => {
    const q = encodeURIComponent(`${estacion} ${ciudad} peru`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, "_blank");
  };

  const handleSavePrecioEnered = async (e) => {
    e.preventDefault();
    if (!editModalStation) return;
    const precioVal = parseFloat(inputPrecioEnered);
    if (isNaN(precioVal) || precioVal <= 0) {
      alert("Ingresa un precio válido mayor a 0");
      return;
    }

    try {
      setSavingEnered(true);
      await api.post("/admin/precios/estaciones-enered", {
        nombre_facilito: editModalStation.establecimiento || editModalStation.estacion,
        combustible: editModalStation.combustible || selCombustible || "Diesel B5 UV",
        precio_enered: precioVal,
        cliente: selClienteModal,
        departamento: editModalStation.departamento || "",
        provincia: editModalStation.provincia || "",
        distrito: editModalStation.distrito || editModalStation.ciudad || "",
        acepta_factura: true,
        acepta_tarjeta: true,
      });
      alert(`✅ Estación ENERED configurada a S/ ${precioVal.toFixed(2)} (${selClienteModal === "GENERAL" ? "Todos los Clientes" : "Cliente: " + selClienteModal}) para ${editModalStation.establecimiento}`);
      setEditModalStation(null);
      await fetchPrecios();
    } catch (err) {
      alert("Error guardando precio: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingEnered(false);
    }
  };

  const formatSync = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
    } catch { return iso; }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="tab-precios">
      {/* KPIs superiores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Ahorro Capturado */}
        <div className="bg-[#8039F4] rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
          <Zap className="absolute top-4 right-4 text-white/20 w-16 h-16 -mr-4 -mt-4" />
          <div>
            <div className="text-3xl font-black tracking-tight">{formatSoles(ahorroCapturado)}</div>
            <div className="text-sm font-semibold mt-1">Ahorro potencial capturado</div>
            <div className="text-[10px] text-white/70 mt-1 uppercase tracking-wider">Módulo de combustibles</div>
          </div>
        </div>

        {/* Mejor Precio */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="text-3xl font-black tracking-tight text-neutral-900">
              {mejorPrecio > 0 ? formatSoles(mejorPrecio) : "—"}
            </div>
            <Fuel className="text-emerald-500 w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-600">Estaciones disponibles</div>
            <div className="text-[10px] text-neutral-400 mt-1 uppercase tracking-wider">
              {fuente === "facilito" ? "Fuente: Facilito OSINERGMIN" : "Fuente: Base local"}
            </div>
          </div>
        </div>

        {/* Mejor Precio Hoy */}
        <div className="bg-[#10B981] rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <MapPin className="text-white w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <div className="text-3xl font-black tracking-tight">{formatSoles(mejorPrecio || 0)}</div>
              <div className="text-sm font-medium">/gal</div>
            </div>
            <div className="text-sm font-semibold mt-1">Mejor precio hoy</div>
            <div className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">
              {selCombustible || "Mercado general"}
            </div>
          </div>
        </div>

        {/* Sincronización */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="text-sm font-black tracking-tight text-neutral-900">
              {lastSync ? formatSync(lastSync) : "Sincronizado"}
            </div>
            <TrendingDown className="text-neutral-400 w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-600">Estado de precios</div>
            <div className="text-[10px] text-neutral-400 mt-1 uppercase tracking-wider">
              Mercado nacional
            </div>
          </div>
        </div>
      </div>

      {/* 4 FILTROS REQUERIDOS */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-brand-600" />
            Filtros por Ubicación y Producto
          </span>
          <div className="flex items-center gap-3">
            {fuente === "facilito" && (
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✅ Datos de Facilito
              </span>
            )}
            {user?.role === "admin_enered" && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-brand text-xs px-3 py-1.5 flex items-center gap-1.5 rounded-lg"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Scrapeando..." : "Sincronizar Facilito"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* 1. Departamento */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">1. Departamento</label>
            <select
              value={selDepartamento}
              onChange={(e) => {
                setSelDepartamento(e.target.value);
                setSelProvincia("");
                setSelDistrito("");
              }}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
            >
              <option value="">Todos los dptos.</option>
              {listaDepartamentos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 2. Provincia */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">2. Provincia</label>
            <select
              value={selProvincia}
              onChange={(e) => {
                setSelProvincia(e.target.value);
                setSelDistrito("");
              }}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
            >
              <option value="">Todas las prov.</option>
              {provinciasDisponibles.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 3. Distrito */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">3. Distrito / Ciudad</label>
            <select
              value={selDistrito}
              onChange={(e) => setSelDistrito(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
            >
              <option value="">Todos los distritos</option>
              {distritosDisponibles.map((dist) => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>

          {/* 4. Combustible */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">4. Combustible</label>
            <select
              value={selCombustible}
              onChange={(e) => setSelCombustible(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
            >
              {combustiblesDisponibles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Buscar por nombre */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">Buscar estación</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre o dirección..."
                value={selEstacion}
                onChange={(e) => setSelEstacion(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-neutral-700 font-medium focus:outline-none focus:border-brand-500 focus:bg-white"
              />
              <Search className="w-3 h-3 text-neutral-400 absolute left-2 top-2.5" />
            </div>
          </div>
        </div>

        {(selDepartamento || selProvincia || selDistrito || selCombustible || selEstacion || soloEnered) && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => {
                setSelDepartamento("");
                setSelProvincia("");
                setSelDistrito("");
                setSelCombustible("");
                setSelEstacion("");
                setSoloEnered(false);
              }}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={soloEnered}
                onChange={(e) => setSoloEnered(e.target.checked)}
                className="w-3.5 h-3.5 accent-brand-600 rounded"
              />
              <span className="text-xs text-neutral-600 font-medium">Ver solo estaciones ENERED</span>
            </label>
          </div>
        )}
      </div>

      {/* TABLA DE PRECIOS */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-[#211A36] text-white text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold rounded-tl-xl">Estación</th>
                <th className="px-4 py-3 font-semibold">Ciudad</th>
                <th className="px-4 py-3 font-semibold text-center">Calidad</th>
                <th className="px-4 py-3 font-semibold text-right">Pizarra</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-300">ENERED</th>
                <th className="px-4 py-3 font-semibold text-right">Diferencia</th>
                <th className="px-3 py-3 font-semibold text-center">Factura</th>
                <th className="px-3 py-3 font-semibold text-center">Tarjeta</th>
                <th className="px-4 py-3 font-semibold text-center rounded-tr-xl">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />
                    Cargando lista de estaciones y precios...
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-red-500 font-bold">{errorMsg}</td>
                </tr>
              ) : filteredPrecios.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-neutral-400">
                    No se encontraron estaciones para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedPrecios.map((p, idx) => {
                  const esEnered = Boolean(p.es_enered);
                  const precioPizarra = p.precio_pizarra || p.precio_venta || 0;
                  const precioEnered = p.precio_enered;
                  const ahorro = p.ahorro || 0;
                  const ciudad = p.distrito || p.ciudad || p.provincia || p.departamento || "—";
                  const nombreEst = p.establecimiento || p.estacion || p.empresa || "Estación";
                  const subNombre = p.direccion ? (p.direccion.length > 35 ? p.direccion.slice(0, 35) + "…" : p.direccion) : "";

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-neutral-50/80 transition-colors ${esEnered ? "bg-emerald-50/20" : ""}`}
                    >
                      {/* 1. Estación */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-neutral-900 text-xs sm:text-sm">{nombreEst}</span>
                            {esEnered && <span className="text-amber-400 text-xs">⭐</span>}
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              esEnered && precioEnered
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                            }`}>✓</span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
                            {subNombre && <span>{subNombre} | </span>}
                            {esEnered ? (
                              <span className="text-emerald-600 font-bold">Red ENERED</span>
                            ) : (
                              <span className="text-rose-500 font-bold">Independiente</span>
                            )}
                          </div>
                          {!esEnered && user?.role === "admin_enered" && (
                            <button
                              onClick={() => {
                                setEditModalStation(p);
                                setInputPrecioEnered("");
                              }}
                              className="mt-1 flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-800 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Convertir a ENERED
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 2. Ciudad */}
                      <td className="px-4 py-3 text-emerald-600 font-bold text-xs capitalize">
                        {ciudad}
                      </td>

                      {/* 3. Calidad */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= (p.calidad || 2)
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-neutral-200"
                              }`}
                            />
                          ))}
                        </div>
                      </td>

                      {/* 4. Precio Pizarra */}
                      <td className="px-4 py-3 text-right font-semibold text-neutral-900 text-xs">
                        {precioPizarra > 0 ? formatSoles(precioPizarra) : "—"}
                      </td>

                      {/* 5. Precio ENERED */}
                      <td className="px-4 py-3 text-right font-bold text-xs">
                        {precioEnered ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-600 text-xs font-black">{formatSoles(precioEnered)}</span>
                            {user?.role === "admin_enered" && (
                              <button
                                onClick={() => {
                                  setEditModalStation(p);
                                  setInputPrecioEnered(precioEnered.toString());
                                }}
                                className="text-[10px] text-violet-600 underline hover:text-violet-800"
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-neutral-300 font-normal italic">no aplica</span>
                            {user?.role === "admin_enered" && (
                              <button
                                onClick={() => {
                                  setEditModalStation(p);
                                  setInputPrecioEnered("");
                                }}
                                className="text-[10px] text-violet-600 underline hover:text-violet-800 font-bold"
                              >
                                + Asignar a {selCombustible}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 6. Diferencia */}
                      <td className="px-4 py-3 text-right font-bold text-xs">
                        {esEnered && ahorro > 0 ? (
                          <span className="text-emerald-600">-S/ {ahorro.toFixed(2)}</span>
                        ) : (
                          <span className="text-neutral-300 font-normal">—</span>
                        )}
                      </td>

                      {/* 7. Factura */}
                      <td className="px-3 py-3 text-center">
                        {esEnered || p.acepta_factura ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">
                            ✔
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-500 text-xs font-bold">
                            ✕
                          </span>
                        )}
                      </td>

                      {/* 8. Tarjeta */}
                      <td className="px-3 py-3 text-center">
                        {esEnered || p.acepta_tarjeta ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            ✔ Acepta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                            ✕ No
                          </span>
                        )}
                      </td>

                      {/* 9. Acción */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {esEnered ? (
                            <button
                              onClick={() => openStationMap(nombreEst, ciudad)}
                              className="bg-emerald-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              Dirigir
                            </button>
                          ) : (
                            <button
                              onClick={() => openStationMap(nombreEst, ciudad)}
                              className="bg-white border border-neutral-300 text-neutral-700 text-[11px] font-semibold px-3 py-1 rounded-full hover:bg-neutral-50 transition-colors"
                            >
                              Evaluar
                            </button>
                          )}
                          <button
                            onClick={() => openRouteMap(nombreEst, ciudad)}
                            className="bg-white border border-neutral-300 text-neutral-600 text-[11px] font-semibold px-2.5 py-1 rounded-full hover:bg-neutral-50 transition-colors"
                          >
                            Ruta
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

        {/* PIE DE TABLA - CONTROLES DE PAGINACIÓN */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
          <div className="flex items-center gap-3">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-neutral-200 rounded-md bg-white font-medium focus:ring-2 focus:ring-violet-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>registros por página</span>
            <span className="text-neutral-400">|</span>
            <span>
              Mostrando {filteredPrecios.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{" "}
              {Math.min(currentPage * pageSize, filteredPrecios.length)} de {filteredPrecios.length} registros
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1.5 border border-neutral-200 rounded-md bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Anterior
            </button>

            <span className="px-3 py-1.5 font-bold text-violet-700 bg-violet-50 rounded-md">
              Página {currentPage} de {totalPages}
            </span>

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 border border-neutral-200 rounded-md bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>


      {/* Modal Admin */}
      {editModalStation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                Configurar Estación ENERED
              </h3>
              <button
                onClick={() => setEditModalStation(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrecioEnered} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-600">Estación</label>
                  <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-violet-200">
                    {editModalStation.combustible || selCombustible}
                  </span>
                </div>
                <input
                  type="text"
                  disabled
                  value={editModalStation.establecimiento || editModalStation.estacion}
                  className="w-full bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-bold text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Asignar a Cliente / Empresa</label>
                <select
                  value={selClienteModal}
                  onChange={(e) => setSelClienteModal(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="GENERAL">-- Todos los Clientes (Precio General ENERED) --</option>
                  {listaClientes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  💡 Si eliges una empresa específica, el precio especial aplicará <strong>solo para ese cliente</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Precio Pizarra (Mercado)</label>
                  <input
                    type="text"
                    disabled
                    value={formatSoles(editModalStation.precio_pizarra || editModalStation.precio_venta)}
                    className="w-full bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-600 mb-1">Precio Especial ENERED *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 17.50"
                    value={inputPrecioEnered}
                    onChange={(e) => setInputPrecioEnered(e.target.value)}
                    className="w-full bg-emerald-50 border-2 border-emerald-400 rounded-lg px-3 py-2 text-xs font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalStation(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEnered}
                  className="btn-brand text-xs px-5 py-2 rounded-lg font-bold flex items-center gap-1.5"
                >
                  {savingEnered ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Guardar Precio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
