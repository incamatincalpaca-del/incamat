import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import { useIncaMant } from "../data/incamatData";
import "../styles/fallas.css";
import "../styles/reportes-planta.css";

const API = import.meta.env.VITE_API_URL || "/api";
const SERVER = import.meta.env.VITE_API_ORIGIN || "";
const blank = { id_area: "", id_maquina: "", prioridad: "Media", descripcion: "", reportado_por: "" };

function Fallas() {
  const { machines, areas, refresh } = useIncaMant();
  const [items, setItems] = useState([]); const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank); const [file, setFile] = useState(null);
  const [error, setError] = useState(""); const [filter, setFilter] = useState("Recibidos");
  const areaMachines = useMemo(() => machines.filter((machine) => machine.area === areas.find((area) => String(area.id) === String(form.id_area))?.nombre), [machines, areas, form.id_area]);
  const load = async () => { const response = await fetch(`${API}/fallas`); if (!response.ok) throw Error("No se pudieron cargar los reportes."); setItems(await response.json()); };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);
  const received = items.filter((item) => item.estado === "Reportada");
  const assigned = items.filter((item) => ["En atencion", "Esperando repuesto", "Pendiente de validacion"].includes(item.estado));
  const closed = items.filter((item) => item.estado === "Resuelta");
  const visible = filter === "Recibidos" ? received : filter === "En orden" ? assigned : filter === "Cerrados" ? closed : items;
  const save = async (event) => { event.preventDefault(); setError(""); const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.append(key, value)); if (file) data.append("evidencia", file); const response = await fetch(`${API}/fallas`, { method: "POST", body: data }); const body = await response.json(); if (!response.ok) return setError(body.error || "No fue posible registrar el reporte."); setOpen(false); setForm(blank); setFile(null); await Promise.all([load(), refresh()]); };
  return <DashboardLayout>
    <PageHeader eyebrow="OPERACIÓN DIARIA" title="Reportes de planta" description="Aquí se reciben reportes QR e incidencias. Al asignarse un técnico, pasan a Órdenes de mantenimiento." action={<><Link className="button button-secondary" to="/ordenes-mantenimiento">Ver órdenes</Link><button className="button button-primary" onClick={() => setOpen(true)}>+ Nuevo reporte</button></>} />
    {error && <p className="form-error">{error}</p>}
    <section className="report-flow"><article><span>1</span><div><strong>Recibir</strong><small>QR, operador o supervisor reporta.</small></div></article><i>→</i><article><span>2</span><div><strong>Clasificar</strong><small>Área, máquina y prioridad.</small></div></article><i>→</i><article><span>3</span><div><strong>Atender</strong><small>Se trabaja desde Órdenes.</small></div></article><i>→</i><article><span>4</span><div><strong>Cerrar</strong><small>Historial y evidencia técnica.</small></div></article></section>
    <section className="report-metrics"><button className={filter === "Recibidos" ? "selected" : ""} onClick={() => setFilter("Recibidos")}><strong>{received.length}</strong><span>Recibidos por clasificar</span></button><button className={filter === "En orden" ? "selected" : ""} onClick={() => setFilter("En orden")}><strong>{assigned.length}</strong><span>En orden de mantenimiento</span></button><button className={filter === "Cerrados" ? "selected" : ""} onClick={() => setFilter("Cerrados")}><strong>{closed.length}</strong><span>Reportes cerrados</span></button><button className={filter === "Todos" ? "selected" : ""} onClick={() => setFilter("Todos")}><strong>{items.length}</strong><span>Total histórico</span></button></section>
    <section className="panel table-panel"><table><thead><tr><th>Máquina</th><th>Área</th><th>Descripción / evidencia</th><th>Prioridad</th><th>Estado</th><th>Reportado por</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><strong>{item.maquina}</strong></td><td>{item.area}</td><td>{item.descripcion}{item.evidencia_url && <a className="evidence-link" target="_blank" rel="noreferrer" href={`${SERVER}${item.evidencia_url}`}>Ver foto</a>}</td><td>{item.prioridad === "Critica" ? "Crítica" : item.prioridad}</td><td>{item.estado}</td><td>{item.reportado_por || "-"}</td></tr>)}{!visible.length && <tr><td colSpan="6" className="empty-state">No hay reportes en esta bandeja.</td></tr>}</tbody></table></section>
    {open && <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-header"><div><h2>Nuevo reporte de planta</h2><p>El reporte se enviará a Órdenes de mantenimiento para su atención.</p></div><button type="button" onClick={() => setOpen(false)}>×</button></div><label>Área<select required value={form.id_area} onChange={(event) => setForm({ ...form, id_area: event.target.value, id_maquina: "" })}><option value="">Primero selecciona el área</option>{areas.filter((area) => area.maquinas > 0).map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label><label>Máquina<select required disabled={!form.id_area} value={form.id_maquina} onChange={(event) => setForm({ ...form, id_maquina: event.target.value })}><option value="">{form.id_area ? "Seleccionar máquina" : "Selecciona un área primero"}</option>{areaMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.nombre}</option>)}</select></label><label>Prioridad<select value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value })}><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option><option value="Critica">Crítica</option></select></label><label>Descripción<input required value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label><label>Evidencia fotográfica<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>JPG, PNG o WEBP · máximo 5 MB</small></label><label>Reportado por<input value={form.reportado_por} onChange={(event) => setForm({ ...form, reportado_por: event.target.value })} /></label><button className="button button-primary">Enviar a órdenes</button></form></div>}
  </DashboardLayout>;
}
export default Fallas;
