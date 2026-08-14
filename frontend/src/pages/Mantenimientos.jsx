import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import { useIncaMant } from "../data/incamatData";
import { canManagePlanning } from "../data/roles";
import "../styles/operaciones.css";
import "../styles/srequest-areas.css";
import "../styles/maintenance-types.css";
import "../styles/maintenance-board-controls.css";

const API = import.meta.env.VITE_API_URL || "/api";
const today = new Date().toISOString().slice(0, 10);
const onlyDate = (value) => value ? String(value).slice(0, 10) : "";
const labelPriority = (value) => value === "Critica" ? "Crítica" : value;
const asCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const showDateTime = (value) => value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "Sin registrar";

function Elapsed({ started }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!started) return null;
  const seconds = Math.max(0, Math.floor((now - new Date(started).getTime()) / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return <strong className="order-timer">Tiempo transcurrido: {hours}:{minutes}:{secs}</strong>;
}

function Mantenimientos() {
  const canPlan = canManagePlanning();
  const { machines, components, areas } = useIncaMant();
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [srequests, setSrequests] = useState([]);
  const [tab, setTab] = useState("nuevas");
  const [areaFilter, setAreaFilter] = useState("Todas");
  const [srequestOrder, setSrequestOrder] = useState("fecha");
  const [srequestFilter, setSrequestFilter] = useState("todas");
  const [boardSearch, setBoardSearch] = useState("");
  const [boardPriority, setBoardPriority] = useState("Todas");
  const [boardOrder, setBoardOrder] = useState("recientes");
  const [programming, setProgramming] = useState(false);
  const [active, setActive] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [technician, setTechnician] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [usedSpares, setUsedSpares] = useState([]);
  const [closeForm, setCloseForm] = useState({ diagnostico: "", causa_tipo: "Mecánica", trabajo_realizado: "", prueba_final: "Probada y operativa", evidencia_final: null });
  const [planForm, setPlanForm] = useState({ id_maquina: "", tipo: "Preventivo", modalidad: "Planificado", fecha_programada: "", responsable: "", tareas: "" });

  const load = async () => {
    const [plansResponse, ordersResponse, srequestResponse] = await Promise.all([fetch(`${API}/mantenimientos`), fetch(`${API}/fallas/pendientes`), fetch(`${API}/solicitudes-externas`)]);
    if (!plansResponse.ok || !ordersResponse.ok || !srequestResponse.ok) throw Error("No se pudieron cargar las órdenes.");
    setPlans(await plansResponse.json()); setOrders(await ordersResponse.json()); setSrequests(await srequestResponse.json());
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);
  const matchesArea = (item) => areaFilter === "Todas" || item.area === areaFilter || item.empresa_origen === areaFilter;
  const visiblePlans = plans.filter(matchesArea);
  const visibleOrders = orders.filter(matchesArea);
  const overdue = visiblePlans.filter((item) => !["Completado", "Cancelado"].includes(item.estado) && onlyDate(item.fecha_programada) < today);
  const todayTasks = visiblePlans.filter((item) => !["Completado", "Cancelado"].includes(item.estado) && onlyDate(item.fecha_programada) === today);
  const done = visiblePlans.filter((item) => item.estado === "Completado");
  const pendingSrequests = srequests.filter((item) => matchesArea(item) && item.estado_incamat !== "Resuelta" && !item.fecha_termino);
  const filteredSrequests = pendingSrequests.filter((item) => srequestFilter === "todas" || (srequestFilter === "iniciadas" ? Boolean(item.fecha_inicio) : !item.fecha_inicio));
  const orderedSrequests = [...filteredSrequests].sort((a, b) => srequestOrder === "numero" ? Number(b.numero_solicitud) - Number(a.numero_solicitud) : new Date(b.fecha_reporte || 0) - new Date(a.fecha_reporte || 0));
  const importedCorrectives = orderedSrequests.map((item) => ({ ...item, srequest: true, prioridad: item.urgente ? "Alta" : "Media", estado: "Reportada", maquina: `Solicitud #${item.numero_solicitud}`, area: item.empresa_origen || "Área por ubicar" }));
  const groups = {
    nuevas: [...visibleOrders.filter((item) => item.estado === "Reportada"), ...importedCorrectives],
    atencion: visibleOrders.filter((item) => item.estado === "En atencion"),
    espera: visibleOrders.filter((item) => item.estado === "Esperando repuesto"),
    validacion: visibleOrders.filter((item) => item.estado === "Pendiente de validacion"),
    planificado: visiblePlans.filter((item) => item.tipo === "Preventivo" && item.modalidad === "Planificado" && !["Completado", "Cancelado"].includes(item.estado)),
    autonomo: visiblePlans.filter((item) => item.tipo === "Preventivo" && item.modalidad === "Autónomo" && !["Completado", "Cancelado"].includes(item.estado)),
    predictivo: visiblePlans.filter((item) => item.tipo === "Predictivo" && !["Completado", "Cancelado"].includes(item.estado)),
    proactivo: visiblePlans.filter((item) => item.tipo === "Proactivo" && !["Completado", "Cancelado"].includes(item.estado)),
    preventivos: [...overdue, ...todayTasks], completadas: done
  };
  const labels = { nuevas: "Correctivos nuevos", atencion: "En atención", espera: "Esperando repuesto", validacion: "Pendiente de validación", planificado: "Preventivo planificado", autonomo: "Autónomo · checklist", predictivo: "Predictivo", proactivo: "Proactivo", preventivos: "Agenda de hoy", completadas: "Tareas completadas" };
  const exportCsv = () => {
    const rows = [["Tipo", "Máquina", "Área", "Estado", "Prioridad", "Fecha reporte", "Inicio real", "Fin real", "Responsable", "Diagnóstico", "Trabajo realizado", "Repuestos usados"],
      ...orders.map((item) => ["Incidencia", item.maquina, item.area, item.estado, labelPriority(item.prioridad), item.fecha_ocurrencia, item.fecha_atencion || "", item.fecha_resolucion || "", item.atendido_por || "", item.diagnostico || "", item.trabajo_realizado || "", ""]),
      ...plans.map((item) => [item.tipo, item.maquina, item.area, item.estado, "", item.fecha_programada, "", item.fecha_realizacion || "", item.responsable || "", "", "", ""])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(asCsv).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `ordenes-mantenimiento-${today}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const openOrder = (item) => { if (item.srequest) { setError(`Solicitud #${item.numero_solicitud}: vincula primero la máquina exacta de ${item.area} antes de iniciar el correctivo.`); return; } setActive(item); setTechnician(item.atendido_por || ""); setError(""); setUsedSpares([]); setCloseForm({ diagnostico: item.diagnostico || "", causa_tipo: item.causa_tipo || "Mecánica", trabajo_realizado: item.trabajo_realizado || "", prueba_final: "Probada y operativa", evidencia_final: null }); };
  const startOrder = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`${API}/fallas/${active.id}/iniciar`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ atendido_por: technician }) });
      const body = await response.json(); if (!response.ok) throw Error(body.error);
      const started = new Date().toISOString(); setActive({ ...active, estado: "En atencion", atendido_por: technician, fecha_atencion: started }); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const setOrderStatus = async (state) => {
    setSaving(true); setError("");
    try { const response = await fetch(`${API}/fallas/${active.id}/estado-operativo`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: state }) }); const body = await response.json(); if (!response.ok) throw Error(body.error); setActive({ ...active, estado: state }); await load(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const finishOrder = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data = new FormData(); Object.entries(closeForm).forEach(([key, value]) => { if (key !== "evidencia_final" && value != null) data.append(key, value); });
      if (closeForm.evidencia_final) data.append("evidencia_final", closeForm.evidencia_final);
      data.append("repuestos", JSON.stringify(usedSpares.filter((item) => item.id_repuesto && Number(item.cantidad) > 0)));
      const response = await fetch(`${API}/fallas/${active.id}/cerrar`, { method: "PATCH", body: data });
      const body = await response.json(); if (!response.ok) throw Error(body.error);
      setActive(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const savePlan = async (event) => { event.preventDefault(); setSaving(true); try { const response = await fetch(`${API}/mantenimientos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...planForm, checklist: planForm.tareas.split("\n").filter(Boolean) }) }); const body = await response.json(); if (!response.ok) throw Error(body.error); setProgramming(false); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const addSpare = () => setUsedSpares([...usedSpares, { id_repuesto: "", cantidad: 1, busqueda: "" }]);
  const updateSpare = (index, field, value) => setUsedSpares(usedSpares.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const saveChecklist = async (checklist, estado = null) => {
    setSaving(true); setError("");
    try {
      const checklistResponse = await fetch(`${API}/mantenimientos/${activePlan.id}/checklist`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checklist }) });
      const checklistBody = await checklistResponse.json(); if (!checklistResponse.ok) throw Error(checklistBody.error);
      if (estado) { const response = await fetch(`${API}/mantenimientos/${activePlan.id}/estado`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado, observacion: "Checklist registrado" }) }); const body = await response.json(); if (!response.ok) throw Error(body.error); }
      await load(); if (estado === "Completado") setActivePlan(null);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const supportsPriority = ["nuevas", "atencion", "espera", "validacion"].includes(tab);
  const selected = useMemo(() => {
    const query = boardSearch.trim().toLocaleLowerCase("es");
    const priorityWeight = { Critica: 4, Alta: 3, Media: 2, Baja: 1 };
    const dateValue = (item) => new Date(item.fecha_ocurrencia || item.fecha_reporte || item.fecha_programada || item.creado_en || 0).getTime() || 0;
    return [...(groups[tab] || [])].filter((item) => {
      if (supportsPriority && boardPriority !== "Todas" && item.prioridad !== boardPriority) return false;
      if (!query) return true;
      return [item.maquina, item.area, item.descripcion, item.numero_solicitud, item.responsable]
        .some((value) => String(value || "").toLocaleLowerCase("es").includes(query));
    }).sort((a, b) => {
      if (boardOrder === "antiguas") return dateValue(a) - dateValue(b);
      if (boardOrder === "prioridad") return (priorityWeight[b.prioridad] || 0) - (priorityWeight[a.prioridad] || 0) || dateValue(b) - dateValue(a);
      if (boardOrder === "solicitud") return Number(b.numero_solicitud || 0) - Number(a.numero_solicitud || 0) || dateValue(b) - dateValue(a);
      if (boardOrder === "maquina") return String(a.maquina || "").localeCompare(String(b.maquina || ""), "es");
      return dateValue(b) - dateValue(a);
    });
  }, [groups, tab, supportsPriority, boardSearch, boardPriority, boardOrder]);
  const reportsByArea = useMemo(() => Object.entries(srequests.filter((item) => !item.fecha_termino).reduce((result, item) => {
    const area = item.empresa_origen || "Área por ubicar";
    if (!result[area]) result[area] = [];
    result[area].push(item); return result;
  }, {})).sort(([a], [b]) => a.localeCompare(b, "es")), [srequests]);

  return <DashboardLayout>
    <PageHeader eyebrow="CENTRO OPERATIVO" title="Mantenimientos" description="Bandeja de trabajo para incidencias QR, preventivos y seguimiento técnico." action={<><button className="button button-secondary" onClick={exportCsv}>Descargar CSV</button>{canPlan && <button className="button button-primary" onClick={() => setProgramming(true)}>+ Programar preventivo</button>}</>} />
    {error && <p className="form-error">{error}</p>}
    <section className="area-maintenance-filter"><div><p className="eyebrow">VISTA POR ÁREA</p><strong>{areaFilter === "Todas" ? "Toda la planta" : areaFilter}</strong><small>Filtra incidencias, solicitudes y los cuatro tipos de mantenimiento.</small></div><label>Área<select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option>Todas</option>{areas.map((area) => <option key={area.id} value={area.nombre}>{area.nombre}</option>)}</select></label></section>
    <section className="maintenance-types"><article><span>Preventivo planificado</span><strong>{groups.planificado.length}</strong><small>Calendario del equipo técnico.</small><button onClick={() => setTab("planificado")}>Ver programa</button></article><article><span>Autónomo</span><strong>{groups.autonomo.length}</strong><small>Checklist diario del operario.</small><button onClick={() => setTab("autonomo")}>Abrir checklist</button></article><article><span>Predictivo</span><strong>{groups.predictivo.length}</strong><small>Según condición o medición.</small><button onClick={() => setTab("predictivo")}>Ver tareas</button></article><article><span>Proactivo</span><strong>{groups.proactivo.length}</strong><small>Elimina causa raíz.</small><button onClick={() => setTab("proactivo")}>Ver mejoras</button></article></section>
    <section className="op-metrics"><div className="red"><strong>{groups.nuevas.length}</strong><span>Correctivos nuevos</span></div><div className="blue"><strong>{groups.atencion.length}</strong><span>En atención</span></div><div className="amber"><strong>{groups.espera.length}</strong><span>Esperando repuesto</span></div><div className="purple"><strong>{pendingSrequests.length}</strong><span>Correctivos importados</span></div><div className="green"><strong>{done.filter((item) => onlyDate(item.fecha_realizacion) === today).length}</strong><span>Completados hoy</span></div></section>
    <section className="op-tabs">{Object.entries(labels).map(([key, name]) => <button key={key} className={tab === key ? "selected" : ""} onClick={() => { setTab(key); setBoardSearch(""); setBoardPriority("Todas"); }}>{name}<span>{groups[key].length}</span></button>)}</section>
    <section className="maintenance-board-controls" aria-label="Filtros de la bandeja de órdenes">
      <div className="board-visible-count"><strong>{selected.length}</strong><span>{supportsPriority ? "órdenes visibles" : "tareas visibles"}</span></div>
      <label className="board-search"><span>Buscar</span><input value={boardSearch} onChange={(event) => setBoardSearch(event.target.value)} placeholder="Orden, área o descripción..." /></label>
      {supportsPriority && <label><span>Prioridad</span><select value={boardPriority} onChange={(event) => setBoardPriority(event.target.value)}><option value="Todas">Todas</option><option value="Critica">Crítica</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option></select></label>}
      <label><span>Ordenar por</span><select value={boardOrder} onChange={(event) => setBoardOrder(event.target.value)}><option value="recientes">Más recientes</option><option value="antiguas">Más antiguas</option>{supportsPriority && <option value="prioridad">Mayor prioridad</option>}<option value="solicitud">N.º de solicitud</option><option value="maquina">Nombre de máquina</option></select></label>
    </section>
    <section className="op-board"><header><div><p className="eyebrow">BANDEJA ACTIVA</p><h2>{labels[tab]}</h2></div><p>{tab === "preventivos" ? "Vencidos y programados para hoy." : tab === "srequest" ? "Registro maestro importado desde SRequest." : "Selecciona una orden para ver su ficha técnica."}</p></header>{tab === "srequest" ? <section className="srequest-table-panel"><div className="srequest-toolbar"><div><strong>{pendingSrequests.length} solicitudes sin fecha de término</strong><small>El número de solicitud conserva la secuencia del archivo original.</small></div><label>Ordenar<select value={srequestOrder} onChange={(event) => setSrequestOrder(event.target.value)}><option value="fecha">Fecha y hora: reciente primero</option><option value="numero">N.º de solicitud: mayor primero</option></select></label><label>Estado<select value={srequestFilter} onChange={(event) => setSrequestFilter(event.target.value)}><option value="todas">Todas las pendientes</option><option value="pendientes">Sin iniciar</option><option value="iniciadas">Con inicio registrado</option></select></label></div><div className="srequest-table-wrap"><table className="srequest-table"><thead><tr><th>Solicitud N.º</th><th>Fecha y hora</th><th>Área</th><th>Atención / responsable</th><th>Descripción</th><th>Estado</th></tr></thead><tbody>{selected.map((item) => <tr key={`srequest-${item.id}`}><td><strong>#{item.numero_solicitud}</strong>{item.urgente && <span className="urgent-chip">Urgente</span>}</td><td>{showDateTime(item.fecha_reporte)}</td><td>{item.empresa_origen || "Por ubicar"}<small>{item.id_area ? "Área vinculada" : "Sin área vinculada"}</small></td><td>{item.departamento_origen || "Sin asignar"}<small>{item.usuario_solicitante || "Sin solicitante"}</small></td><td>{item.descripcion}</td><td><span className={item.fecha_inicio ? "state-started" : "state-pending"}>{item.fecha_inicio ? "Iniciada" : "Pendiente"}</span>{item.fecha_inicio && <small>Inicio: {showDateTime(item.fecha_inicio)}</small>}</td></tr>)}{!selected.length && <tr><td className="empty-state" colSpan="6">No hay solicitudes para este filtro.</td></tr>}</tbody></table></div><section className="area-report-section"><div><p className="eyebrow">RESUMEN POR ÁREA</p><h3>Equipos y máquinas reportados</h3><p>Las tarjetas reúnen las solicitudes pendientes del área y el equipo mencionado en la descripción.</p></div><div className="area-report-grid">{reportsByArea.map(([area, reports]) => <article key={area} className="area-report-card"><header><div><span>{area}</span><strong>{reports.length} reportes</strong></div><small>Último: {showDateTime([...reports].sort((a,b) => new Date(b.fecha_reporte) - new Date(a.fecha_reporte))[0]?.fecha_reporte)}</small></header><ul>{reports.slice().sort((a,b) => new Date(b.fecha_reporte) - new Date(a.fecha_reporte)).slice(0, 8).map((item) => <li key={item.id}><b>#{item.numero_solicitud}</b><span>{item.descripcion}</span></li>)}</ul>{reports.length > 8 && <small>+ {reports.length - 8} reportes adicionales en la tabla.</small>}</article>)}</div></section></section> : <div className="op-grid">{selected.map((item) => item.prioridad ? <article className={`op-card p-${item.prioridad.toLowerCase()}`} key={item.id}><div><span>{labelPriority(item.prioridad)}</span><small>{item.estado}</small></div><h3>{item.maquina}</h3><p>{item.area}</p><strong>{item.descripcion}</strong><button className="button button-primary" onClick={() => openOrder(item)}>{item.estado === "Reportada" ? "Iniciar orden" : "Abrir ficha"}</button></article> : <article className="op-card plan" key={item.id}><span>{item.tipo}</span><h3>{item.maquina}</h3><p>{item.area}</p><small>{onlyDate(item.fecha_programada)} · {item.responsable || "Sin responsable"}</small><b>{item.estado}</b></article>)}{!selected.length && <p className="empty-state">No hay registros en esta bandeja.</p>}</div>}</section>
    {active && <div className="modal-backdrop"><div className="modal technical-order"><div className="modal-header"><div><p className="eyebrow">ORDEN DE TRABAJO #{active.id}</p><h2>{active.maquina}</h2><p>{active.area} · Reportada: {showDateTime(active.fecha_ocurrencia)}</p></div><button type="button" onClick={() => setActive(null)}>×</button></div><section className="order-summary"><strong>Descripción reportada</strong><p>{active.descripcion}</p>{active.evidencia_url ? <a className="initial-photo" target="_blank" rel="noreferrer" href={`${import.meta.env.VITE_API_ORIGIN || ""}${active.evidencia_url}`}>Ver foto de cómo se encontró</a> : <small>Sin foto inicial adjunta.</small>}</section>
      {active.estado === "Reportada" ? <form onSubmit={startOrder}><label>Técnico responsable<input required value={technician} onChange={(event) => setTechnician(event.target.value)} placeholder="Nombre del técnico" /></label><p className="helper-text">Al iniciar, se registra automáticamente la fecha y hora real de inicio.</p><button className="button button-primary" disabled={saving}>{saving ? "Iniciando..." : "Iniciar orden y registrar hora"}</button></form> : <form onSubmit={finishOrder} className="technical-form"><section className="time-panel"><div><small>Inicio real</small><strong>{showDateTime(active.fecha_atencion)}</strong></div><Elapsed started={active.fecha_atencion} /><div><small>Técnico</small><strong>{active.atendido_por || "Sin asignar"}</strong></div></section><label>Diagnóstico de la falla<textarea required value={closeForm.diagnostico} onChange={(event) => setCloseForm({ ...closeForm, diagnostico: event.target.value })} placeholder="Qué tenía la máquina y qué se detectó" /></label><label>Tipo de causa<select value={closeForm.causa_tipo} onChange={(event) => setCloseForm({ ...closeForm, causa_tipo: event.target.value })}><option>Mecánica</option><option>Eléctrica</option><option>Electrónica</option><option>Neumática</option><option>Hidráulica</option><option>Operación</option><option>Otra</option></select></label><label>Trabajo realizado<textarea required value={closeForm.trabajo_realizado} onChange={(event) => setCloseForm({ ...closeForm, trabajo_realizado: event.target.value })} placeholder="Qué se reparó, ajustó, limpió o reemplazó" /></label><section className="spare-section"><div><strong>Repuestos utilizados</strong><button type="button" className="button button-secondary" onClick={addSpare}>+ Agregar repuesto</button></div>{usedSpares.map((item, index) => <div className="spare-row" key={index}><input list="maintenance-spares" value={item.busqueda || ""} placeholder="Escribe código o repuesto..." onChange={(event) => { const text = event.target.value; const match = components.find((part) => `${part.codigo} — ${part.nombre}` === text); setUsedSpares((rows) => rows.map((row, position) => position === index ? { ...row, busqueda: text, id_repuesto: match ? match.id : "" } : row)); }} /><input type="number" min="1" value={item.cantidad} onChange={(event) => updateSpare(index, "cantidad", event.target.value)} /><button type="button" onClick={() => setUsedSpares(usedSpares.filter((_, i) => i !== index))}>Quitar</button></div>)}<datalist id="maintenance-spares">{components.map((part) => <option key={part.id} value={`${part.codigo} — ${part.nombre}`}>{`Stock ${part.stock}`}</option>)}</datalist>{!usedSpares.length && <small>Registra solo los repuestos que realmente se utilizaron.</small>}</section><label>Foto de cómo queda la máquina<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCloseForm({ ...closeForm, evidencia_final: event.target.files?.[0] || null })} /><small>JPG, PNG o WEBP; máximo 5 MB.</small></label><label>Prueba final<select value={closeForm.prueba_final} onChange={(event) => setCloseForm({ ...closeForm, prueba_final: event.target.value })}><option>Probada y operativa</option><option>Pendiente de prueba</option><option>Requiere seguimiento</option></select></label><div className="technical-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => setOrderStatus("Esperando repuesto")}>Esperar repuesto</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Cerrar orden y registrar hora final"}</button></div></form>}</div></div>}
    {programming && <div className="modal-backdrop"><form className="modal" onSubmit={savePlan}><div className="modal-header"><h2>Programar mantenimiento</h2><button type="button" onClick={() => setProgramming(false)}>×</button></div><section className="maintenance-guide"><strong>Tipos oficiales</strong><span><b>Preventivo:</b> evita paradas; puede ser planificado o autónomo.</span><span><b>Predictivo:</b> se programa según condición o medición.</span><span><b>Proactivo:</b> elimina la causa raíz y mejora la confiabilidad.</span></section><label>Máquina<select required value={planForm.id_maquina} onChange={(event) => setPlanForm({ ...planForm, id_maquina: event.target.value })}><option value="">Seleccionar</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.nombre}</option>)}</select></label><label>Tipo<select value={planForm.tipo} onChange={(event) => setPlanForm({ ...planForm, tipo: event.target.value, modalidad: event.target.value === "Preventivo" ? planForm.modalidad || "Planificado" : "" })}><option>Preventivo</option><option>Predictivo</option><option>Proactivo</option></select></label>{planForm.tipo === "Preventivo" && <label>Modalidad del preventivo<select value={planForm.modalidad} onChange={(event) => setPlanForm({ ...planForm, modalidad: event.target.value })}><option>Planificado</option><option>Autónomo</option></select><small>Planificado: calendario del equipo técnico. Autónomo: checklist diario realizado por el operario.</small></label>}<label>Fecha<input type="date" required value={planForm.fecha_programada} onChange={(event) => setPlanForm({ ...planForm, fecha_programada: event.target.value })} /></label><label>Responsable<input value={planForm.responsable} onChange={(event) => setPlanForm({ ...planForm, responsable: event.target.value })} placeholder={planForm.modalidad === "Autónomo" ? "Operario responsable" : "Técnico o responsable"} /></label><label>Checklist / tareas<textarea value={planForm.tareas} onChange={(event) => setPlanForm({ ...planForm, tareas: event.target.value })} placeholder={planForm.modalidad === "Autónomo" ? "Ej.: limpiar, inspeccionar, lubricar, verificar seguridad" : "Una tarea por línea"} /></label><button className="button button-primary" disabled={saving}>Guardar mantenimiento</button></form></div>}
  </DashboardLayout>;
}
export default Mantenimientos;
