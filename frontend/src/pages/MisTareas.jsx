import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import "../styles/usuarios.css";

const API = import.meta.env.VITE_API_URL || "/api";
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` };

function MisTareas() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const response = await fetch(`${API}/usuarios/mis-asignaciones`, { headers }); setTasks(response.ok ? await response.json() : []); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const update = async (task, estado) => { const response = await fetch(`${API}/usuarios/mis-asignaciones/${task.id}`, { method: "PATCH", headers, body: JSON.stringify({ estado }) }); if (response.ok) load(); };
  const active = tasks.filter((task) => task.estado !== "Completada");
  return <DashboardLayout>
    <PageHeader eyebrow="MI PLAN DE TRABAJO" title="Mis tareas asignadas" description="Revisa las actividades enviadas por administraci\u00f3n y actualiza tu avance al iniciar o completar." />
    <section className="users-summary"><div><strong>{active.length}</strong><span>tareas activas</span></div><p><b>Asignada:</b> pendiente de iniciar. <b>En progreso:</b> ya est\u00e1s trabajando. <b>Completada:</b> informa que la actividad fue finalizada.</p></section>
    <section className="users-panel task-panel"><header><div><p className="eyebrow">BANDEJA PERSONAL</p><h2>Actividades de ingenier\u00eda y mantenimiento</h2></div></header>{loading ? <p className="empty-state">Cargando tareas...</p> : <div className="users-table-wrap"><table className="users-table task-table"><thead><tr><th>C\u00f3digo</th><th>\u00c1rea</th><th>Tarea</th><th>Prioridad</th><th>Fecha l\u00edmite</th><th>Estado / avance</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td><b>{task.codigo}</b><small>Asignado por: {task.asignado_por}</small></td><td>{task.area || "Toda la planta"}</td><td><b>{task.tarea}</b>{task.observaciones && <small>{task.observaciones}</small>}</td><td><span className={`task-priority ${task.prioridad.toLowerCase()}`}>{task.prioridad}</span></td><td>{task.fecha_limite ? String(task.fecha_limite).slice(0, 10) : "Sin fecha"}</td><td><select value={task.estado} onChange={(event) => update(task, event.target.value)}><option>Asignada</option><option>En progreso</option><option>Completada</option></select></td></tr>)}{!tasks.length && <tr><td colSpan="6" className="empty-state">A\u00fan no tienes tareas asignadas.</td></tr>}</tbody></table></div>}</section>
  </DashboardLayout>;
}

export default MisTareas;
