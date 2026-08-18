import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import "../styles/usuarios.css";

const API = import.meta.env.VITE_API_URL || "/api";
const roles = ["Operario", "Tecnico", "Ingeniero", "Administrador"];
const roleLabel = (role) => role === "Tecnico" ? "Técnico" : role;
const emptyUser = { nombre: "", usuario: "", correo: "", password: "", rol: "Operario", id_area: "" };
const today = new Date().toISOString().slice(0, 10);
const emptyTask = { codigo: "", id_usuario: "", id_area: "", tarea: "", prioridad: "Media", fecha_asignacion: today, fecha_limite: "", estado: "Asignada", observaciones: "" };
const authHeaders = (json = false) => ({ ...(json ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` });

function Usuarios() {
  const [users, setUsers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openUser, setOpenUser] = useState(false);
  const [openTask, setOpenTask] = useState(false);
  const [form, setForm] = useState(emptyUser);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usersResponse, tasksResponse] = await Promise.all([
        fetch(`${API}/usuarios`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API}/usuarios/asignaciones`, { headers: authHeaders(), cache: "no-store" })
      ]);
      setUsers(usersResponse.ok ? await usersResponse.json() : []);
      setTasks(tasksResponse.ok ? await tasksResponse.json() : []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    fetch(`${API}/areas`, { cache: "no-store" }).then((response) => response.ok ? response.json() : []).then(setAreas).catch(() => setAreas([]));
  }, []);

  const createUser = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`${API}/usuarios`, { method: "POST", headers: authHeaders(true), body: JSON.stringify({ ...form, id_area: form.id_area || null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      await load(); setOpenUser(false); setForm(emptyUser); setMessage("Usuario creado correctamente.");
    } catch (err) { setError(err.message || "No fue posible crear el usuario."); }
    finally { setSaving(false); }
  };

  const createTask = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`${API}/usuarios/asignaciones`, { method: "POST", headers: authHeaders(true), body: JSON.stringify({ ...taskForm, id_area: taskForm.id_area || null, fecha_limite: taskForm.fecha_limite || null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      await load(); setOpenTask(false); setTaskForm(emptyTask); setMessage("Tarea asignada correctamente.");
    } catch (err) { setError(err.message || "No fue posible asignar la tarea."); }
    finally { setSaving(false); }
  };

  const downloadTemplate = async () => {
    setError("");
    try {
      const response = await fetch(`${API}/usuarios/plantilla/asignaciones.xlsx`, { headers: authHeaders() });
      if (!response.ok) throw new Error("No fue posible descargar la plantilla.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "plantilla-asignacion-tareas.xlsx"; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message || "No fue posible descargar la plantilla."); }
  };

  const updateUser = (id, values) => setUsers(users.map((item) => item.id === id ? { ...item, ...values } : item));
  const saveUser = async (user) => {
    const response = await fetch(`${API}/usuarios/${user.id}`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ ...user, id_area: user.id_area || null }) });
    if (response.ok) { setMessage("Usuario actualizado."); load(); }
  };
  const changeTaskState = async (task, estado) => {
    const response = await fetch(`${API}/usuarios/asignaciones/${task.id}`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ estado, observaciones: task.observaciones, fecha_limite: task.fecha_limite }) });
    if (response.ok) { setMessage("Estado de tarea actualizado."); load(); }
  };
  const selectedUser = users.find((user) => Number(user.id) === Number(taskForm.id_usuario));
  const assignable = users.filter((user) => ["Ingeniero", "T\u00e9cnico", "Tecnico"].includes(user.rol) && user.estado);

  return <DashboardLayout>
    <PageHeader eyebrow="ADMINISTRACI\u00d3N" title="Usuarios, permisos y tareas" description="Crea cuentas, asigna \u00e1reas y env\u00eda tareas a ingenieros o t\u00e9cnicos." action={<div className="user-header-actions"><button className="button button-secondary" onClick={downloadTemplate}>Descargar plantilla</button><button className="button button-secondary" onClick={() => { setError(""); setTaskForm({ ...emptyTask, codigo: `TAR-${String(tasks.length + 1).padStart(4, "0")}` }); setOpenTask(true); }}>+ Asignar tarea</button><button className="button button-primary" onClick={() => { setError(""); setForm(emptyUser); setOpenUser(true); }}>+ Nuevo usuario</button></div>} />
    {message && <p className="import-success user-message">{message}</p>}
    <section className="users-summary"><div><strong>{users.length}</strong><span>usuarios registrados</span></div><p><b>Operario:</b> reporta planta y ve anuncios. <b>Técnico:</b> atiende órdenes, solicita repuestos y recibe tareas. <b>Ingeniero:</b> planifica, importa y recibe tareas. <b>Administrador:</b> gestiona usuarios, tareas y anuncios.</p></section>
    <section className="users-panel"><header><div><p className="eyebrow">CONTROL DE ACCESOS</p><h2>Usuarios activos, áreas y permisos</h2></div></header>{loading ? <p className="empty-state">Cargando usuarios...</p> : <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Área para avisos</th><th>Correo</th><th>Rol</th><th>Nueva contraseña</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><b>{user.usuario}</b></td><td><input value={user.nombre || ""} onChange={(event) => updateUser(user.id, { nombre: event.target.value })} /></td><td><select value={user.id_area || ""} onChange={(event) => updateUser(user.id, { id_area: event.target.value })}><option value="">Sin área</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></td><td><input value={user.correo || ""} onChange={(event) => updateUser(user.id, { correo: event.target.value })} /></td><td><select value={["Tecnico", "Técnico", "TÃ©cnico"].includes(user.rol) ? "Tecnico" : user.rol} onChange={(event) => updateUser(user.id, { rol: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></td><td><input type="password" placeholder="Sin cambios" value={user.password || ""} onChange={(event) => updateUser(user.id, { password: event.target.value })} /></td><td><button className={user.estado ? "user-status active" : "user-status"} onClick={() => updateUser(user.id, { estado: !user.estado })}>{user.estado ? "Activo" : "Inactivo"}</button></td><td><button className="button button-secondary user-save" onClick={() => saveUser(user)}>Guardar</button></td></tr>)}</tbody></table></div>}</section>
    <section className="users-panel task-panel"><header><div><p className="eyebrow">PLANIFICACI\u00d3N DE PERSONAL</p><h2>Tareas asignadas a ingenieros y t\u00e9cnicos</h2><p>Usa un c\u00f3digo por tarea para poder filtrar, seguir y reportar avances.</p></div><span className="task-counter">{tasks.filter((task) => task.estado !== "Completada" && task.estado !== "Cancelada").length} activas</span></header>{loading ? null : <div className="users-table-wrap"><table className="users-table task-table"><thead><tr><th>C\u00f3digo</th><th>Responsable / cargo</th><th>\u00c1rea</th><th>Tarea</th><th>Prioridad</th><th>Plazo</th><th>Estado</th><th>Acci\u00f3n</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td><b>{task.codigo}</b><small>Asignado: {String(task.fecha_asignacion).slice(0, 10)}</small></td><td><b>{task.usuario}</b><small>{task.cargo}</small></td><td>{task.area || "Toda la planta"}</td><td><b>{task.tarea}</b>{task.observaciones && <small>{task.observaciones}</small>}</td><td><span className={`task-priority ${task.prioridad.toLowerCase()}`}>{task.prioridad}</span></td><td>{task.fecha_limite ? String(task.fecha_limite).slice(0, 10) : "Sin fecha"}</td><td><span className={`task-state ${task.estado.toLowerCase().replaceAll(" ", "-")}`}>{task.estado}</span></td><td><select value={task.estado} onChange={(event) => changeTaskState(task, event.target.value)}><option>Asignada</option><option>En progreso</option><option>Completada</option><option>Cancelada</option></select></td></tr>)}{!tasks.length && <tr><td colSpan="8" className="empty-state">A\u00fan no hay tareas asignadas. Usa “+ Asignar tarea” o descarga la plantilla Excel.</td></tr>}</tbody></table></div>}</section>
    {openUser && <div className="modal-backdrop"><form className="modal user-modal" onSubmit={createUser}><div className="modal-header"><div><p className="eyebrow">NUEVA CUENTA</p><h2>Crear usuario</h2><p>Asigna un área si debe recibir anuncios específicos de su zona.</p></div><button type="button" onClick={() => setOpenUser(false)}>×</button></div><div className="form-grid"><label>Nombre completo<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label>Usuario<input required pattern="[A-Za-z0-9._-]+" placeholder="Ej.: jlopez" value={form.usuario} onChange={(event) => setForm({ ...form, usuario: event.target.value })} /></label><label>Correo<input type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} /></label><label>Rol<select value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><label>Área asignada<select value={form.id_area} onChange={(event) => setForm({ ...form, id_area: event.target.value })}><option value="">Sin área asignada</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label></div><label>Contraseña temporal<input required minLength="12" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><small>12 caracteres, mayúscula, minúscula, número y símbolo.</small></label>{error && <p className="form-error">{error}</p>}<div className="manual-machine-actions"><button type="button" className="button button-secondary" onClick={() => setOpenUser(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando..." : "Crear usuario"}</button></div></form></div>}
    {openTask && <div className="modal-backdrop"><form className="modal task-modal" onSubmit={createTask}><div className="modal-header"><div><p className="eyebrow">ASIGNACI\u00d3N DE TRABAJO</p><h2>Enviar tarea al responsable</h2><p>Solo se muestran ingenieros y t\u00e9cnicos activos.</p></div><button type="button" onClick={() => setOpenTask(false)}>\u00d7</button></div><div className="form-grid"><label>C\u00f3digo de tarea<input required value={taskForm.codigo} onChange={(event) => setTaskForm({ ...taskForm, codigo: event.target.value })} /></label><label>Responsable<select required value={taskForm.id_usuario} onChange={(event) => { const user = users.find((item) => Number(item.id) === Number(event.target.value)); setTaskForm({ ...taskForm, id_usuario: event.target.value, id_area: user?.id_area || taskForm.id_area }); }}><option value="">Seleccionar responsable</option>{assignable.map((user) => <option key={user.id} value={user.id}>{user.nombre} · {user.rol}</option>)}</select></label><label>\u00c1rea vinculada<select value={taskForm.id_area} onChange={(event) => setTaskForm({ ...taskForm, id_area: event.target.value })}><option value="">Toda la planta</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}</select></label><label>Prioridad<select value={taskForm.prioridad} onChange={(event) => setTaskForm({ ...taskForm, prioridad: event.target.value })}><option>Baja</option><option>Media</option><option>Alta</option><option>Critica</option></select></label><label>Fecha de asignaci\u00f3n<input required type="date" value={taskForm.fecha_asignacion} onChange={(event) => setTaskForm({ ...taskForm, fecha_asignacion: event.target.value })} /></label><label>Fecha l\u00edmite<input type="date" value={taskForm.fecha_limite} onChange={(event) => setTaskForm({ ...taskForm, fecha_limite: event.target.value })} /></label></div><label>Tarea / actividad<input required placeholder="Ej.: Validar inventario de repuestos del \u00e1rea" value={taskForm.tarea} onChange={(event) => setTaskForm({ ...taskForm, tarea: event.target.value })} /></label><label>Observaciones<textarea placeholder="Indicaciones, alcance o evidencia esperada" value={taskForm.observaciones} onChange={(event) => setTaskForm({ ...taskForm, observaciones: event.target.value })} /></label>{selectedUser && <p className="task-recipient">Se enviar\u00e1 a <b>{selectedUser.nombre}</b> ({selectedUser.rol}){taskForm.id_area ? ` · ${areas.find((area) => Number(area.id) === Number(taskForm.id_area))?.nombre || ""}` : ""}.</p>}{error && <p className="form-error">{error}</p>}<div className="manual-machine-actions"><button type="button" className="button button-secondary" onClick={() => setOpenTask(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Asignando..." : "Asignar tarea"}</button></div></form></div>}
  </DashboardLayout>;
}

export default Usuarios;
