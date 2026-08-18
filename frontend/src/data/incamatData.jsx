import { createContext, useContext, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const fallbackAreas = [{ id: 1, nombre: "Acabados", maquinas: 0 }, { id: 2, nombre: "Calidad", maquinas: 0 }];
const IncaMantContext = createContext(null);

export function IncaMantProvider({ children }) {
  const [areas, setAreas] = useState(fallbackAreas);
  const [machines, setMachines] = useState([]);
  const [components, setComponents] = useState([]);
  const [imports, setImports] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const responses = await Promise.all(["areas", "maquinas", "repuestos", "importaciones", "localizaciones"].map((resource) => fetch(`${API_URL}/${resource}`, { cache: "no-store" })));
    if (responses.some((response) => !response.ok)) throw new Error("No se pudieron cargar los datos de INCAMAT.");
    const [realAreas, realMachines, realSpares, realImports, realLocations] = await Promise.all(responses.map((response) => response.json()));
    setAreas(realAreas);
    setMachines(realMachines);
    setComponents(realSpares.map((item) => ({ id: item.id, codigo: item.codigo, nombre: item.descripcion, area: item.areas_uso || item.ubicacion_almacen || "Sin ubicación", unidad: item.unidad_medida || "unidad", criticidad: item.criticidad, puntajeCriticidad: item.puntaje_criticidad == null ? null : Number(item.puntaje_criticidad), impactoProduccion: item.impacto_produccion == null ? null : Number(item.impacto_produccion), reposicionNivel: item.tiempo_reposicion_nivel == null ? null : Number(item.tiempo_reposicion_nivel), alternativaNivel: item.disponibilidad_alternativa == null ? null : Number(item.disponibilidad_alternativa), impactoEconomico: item.impacto_economico == null ? null : Number(item.impacto_economico), criticidadValidadaPor: item.criticidad_validada_por || "", familiaTecnica: item.familia_tecnica || "Sin clasificar", subfamiliaTecnica: item.subfamilia_tecnica || "", estadoClasificacion: item.estado_clasificacion || "Pendiente", stock: Number(item.stock_actual), minimo: Number(item.stock_minimo), stockVerificado: Boolean(item.stock_verificado), stockVerificadoPor: item.stock_verificado_por || "", stockVerificadoEn: item.stock_verificado_en || "", ubicacionAlmacen: item.ubicacion_almacen || "", frecuencia: item.frecuencia_solicitud, ultimaSolicitud: item.ultima_solicitud_historica || item.fecha_ultima_solicitud ? String(item.ultima_solicitud_historica || item.fecha_ultima_solicitud).slice(0, 10) : "", solicitudes: Number(item.solicitudes || 0) + Number(item.solicitudes_historicas || 0), cantidadSolicitada: Number(item.cantidad_solicitada || 0), costoUltimo: Number(item.costo_ultimo || 0), costoHistorico: Number(item.costo_historico || 0) })));
    setImports(realImports);
    setLocations(realLocations);
  };

  useEffect(() => {
    const loadData = () => {
      setLoading(true);
      refresh()
        .catch((error) => console.warn(error))
        .finally(() => setLoading(false));
    };

    loadData();
    window.addEventListener("incamat:login", loadData);
    return () => window.removeEventListener("incamat:login", loadData);
  }, []);

  const value = useMemo(() => ({
    areas, machines, components, imports, locations, loading, refresh,
    addMachine: async (machine) => {
      const selectedArea = areas.find((area) => area.nombre === machine.area);
      if (!selectedArea?.id) throw new Error("Selecciona un area valida.");
      const response = await fetch(`${API_URL}/maquinas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: machine.codigo, nombre: machine.nombre, id_area: selectedArea.id, marca: machine.marca?.trim() || null, modelo: machine.modelo?.trim() || null, descripcion_corta: machine.descripcion_corta?.trim() || null, estado: machine.estado }) });
      if (!response.ok) throw new Error((await response.json()).error || "No fue posible guardar la maquina.");
      await refresh();
    },
    addComponent: async (component) => {
      const response = await fetch(`${API_URL}/repuestos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(component) });
      if (!response.ok) throw new Error((await response.json()).error || "No fue posible registrar el repuesto.");
      await refresh();
    },
    registerImport: (record) => setImports((items) => [{ ...record, id: Date.now() }, ...items]),
  }), [areas, machines, components, imports, locations, loading]);
  return <IncaMantContext.Provider value={value}>{children}</IncaMantContext.Provider>;
}

export function useIncaMant() {
  const context = useContext(IncaMantContext);
  if (!context) throw new Error("useIncaMant debe usarse dentro de IncaMantProvider");
  return context;
}
