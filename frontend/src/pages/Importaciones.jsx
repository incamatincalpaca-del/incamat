import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import { useIncaMant } from "../data/incamatData";
import "../styles/importaciones-pro.css";
import "../styles/import-history-actions.css";

const API = import.meta.env.VITE_API_URL || "/api";
const columns = {
  Areas: ["codigo", "nombre"],
  Maquinas: ["codigo", "nombre", "area", "marca", "modelo", "estado"],
  Repuestos: ["codigo", "descripcion", "criticidad", "stock_actual", "stock_minimo"],
  MantenimientoSRequest: ["Solicitud", "Fecha y hora", "Descripcion de la solicitud", "Empresa", "Estado"],
  MantenimientoHistorico: ["ID_Registro", "ID_Maquina", "Maquina", "Fecha", "Tecnicos", "Tipo_Mantenimiento", "OT", "Codigo_Mantenimiento", "Duracion", "Detalles de intervencion", "Repuestos/Materiales", "Foto_evidencia", "Revisado"],
  UsuariosTareas: ["Codigo_Tarea", "Codigo_Usuario", "Usuario", "Cargo", "Area", "Tarea", "Prioridad", "Fecha_Asignacion", "Fecha_Limite", "Estado", "Observaciones"],
};
const label = (module) => ({ MantenimientoSRequest: "Mantenimientos (SRequest)", MantenimientoHistorico: "Historial de mantenimientos", UsuariosTareas: "Usuarios y tareas" }[module] || module);
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` });

function Importaciones() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { imports, refresh } = useIncaMant();
  const initial = params.get("modulo");
  const [module, setModule] = useState(columns[initial] ? initial : "Repuestos");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef();
  const isHistory = module === "MantenimientoHistorico";
  const isSRequest = module === "MantenimientoSRequest";
  const isUsersTasks = module === "UsuariosTareas";

  const sendFile = async (action, selected = file) => {
    const data = new FormData(); data.append("archivo", selected); data.append("modulo", module);
    const response = await fetch(`${API}/importaciones/${action}`, { method: "POST", body: data });
    const body = await response.json(); if (!response.ok) throw Error(body.error || "No fue posible procesar el archivo."); return body;
  };
  const choose = async (event) => {
    const selected = event.target.files?.[0]; if (!selected) return;
    setFile(selected); setBusy(true); setMessage("");
    try { setPreview(await sendFile("preview", selected)); } catch (error) { setPreview(null); setMessage(error.message); } finally { setBusy(false); }
  };
  const process = async () => {
    setBusy(true);
    try { const result = await sendFile("procesar"); setMessage(`Importación finalizada: ${result.creados} creados y ${result.actualizados} actualizados.`); setPreview(null); setFile(null); await refresh(); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const changeModule = (next) => { setModule(next); setFile(null); setPreview(null); setMessage(""); if (input.current) input.current.value = ""; };
  const downloadTaskTemplate = async () => {
    try {
      const response = await fetch(`${API}/usuarios/plantilla/asignaciones.xlsx`, { headers: authHeaders() });
      if (!response.ok) throw Error("No fue posible descargar la plantilla.");
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = "plantilla-asignacion-tareas.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error.message || "No fue posible descargar la plantilla."); }
  };
  const removeHistory = async (item) => {
    const removesData = item.modulo === "MantenimientoSRequest" || item.modulo === "MantenimientoHistorico";
    if (!window.confirm(removesData ? `¿Eliminar '${item.nombre_archivo}' y los registros que creó?` : `¿Quitar '${item.nombre_archivo}' del historial? Los datos importados se conservarán.`)) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`${API}/importaciones/${item.id}`, { method: "DELETE" }); const body = await response.json(); if (!response.ok) throw Error(body.error); setMessage(body.mensaje); await refresh(); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const pageDescription = isUsersTasks ? "Descarga la plantilla de control para asignar trabajo a ingenieros y técnicos desde Administración." : isHistory ? "Carga el historial técnico usando la misma estructura de los registros de mantenimiento de Incalpaca." : isSRequest ? "Plantilla oficial SRequest: carga solicitudes sin modificar sus encabezados." : "Usa las plantillas oficiales para crear o actualizar información sin duplicados.";
  const stepDescription = isUsersTasks ? "La plantilla contiene código, usuario, cargo, área, tarea, prioridad, fechas, estado y observaciones." : isHistory ? "Registra una actividad por fila; no cambies el nombre de las columnas." : isSRequest ? "Usa el mismo diseño del archivo SRequest y no renombres sus columnas." : "Usa la plantilla para mantener el formato de Incalpaca.";

  return <DashboardLayout>
    <PageHeader eyebrow="CARGA MASIVA" title={isUsersTasks ? "Plantilla de usuarios y tareas" : `Importar ${label(module)}`} description={pageDescription} />
    <main className="import-workspace">
      <section className="import-hero"><div><p className="eyebrow">MÓDULO DE CARGA</p><h2>{isUsersTasks ? "Control de responsables y tareas" : "Importación segura desde Excel"}</h2><p>{isUsersTasks ? "Usa el formato oficial como guía y registra la asignación en Usuarios y permisos." : isHistory ? "El ID de registro identifica cada mantenimiento y evita duplicados al actualizar." : isSRequest ? "Incluye solicitud, fecha, urgencia, evidencia, área de origen y solicitante." : "La información se valida antes de guardar. Podrás ver errores y evitar registros duplicados."}</p></div><div className="import-hero-badges"><span>✓ Validación</span><span>✓ Actualización</span><span>✓ Historial</span></div></section>
      <section className="import-steps-grid">
        <article className="import-step"><span className="step-number">1</span><div><h2>Elige el catálogo</h2><p>Selecciona el tipo de información que vas a cargar.</p><div className="module-tabs">{Object.keys(columns).map((item) => <button type="button" key={item} className={module === item ? "selected" : ""} onClick={() => changeModule(item)}>{label(item)}</button>)}</div></div></article>
        <article className="import-step"><span className="step-number">2</span><div><h2>Descarga y completa</h2><p>{stepDescription}</p>{isUsersTasks ? <button className="button button-secondary" onClick={downloadTaskTemplate}>Descargar plantilla Excel</button> : <a className="button button-secondary" href={`${API}/importaciones/plantilla/${module}`}>Descargar plantilla Excel</a>}<small>Columnas: {columns[module].join(" · ")}</small></div></article>
        <article className="import-step import-drop"><span className="step-number">3</span><div>{isUsersTasks ? <><h2>Asigna en el sistema</h2><p>Registra la tarea para el responsable y actualiza su avance en línea.</p><button className="button button-primary" type="button" onClick={() => navigate("/usuarios")}>Abrir Usuarios y tareas</button><small>Solo administrador</small></> : <><h2>Sube y valida</h2><p>{file ? file.name : "Selecciona el archivo Excel completado."}</p><button className="button button-primary" type="button" onClick={() => input.current?.click()}>{busy ? "Validando..." : "Elegir archivo Excel"}</button><input hidden ref={input} type="file" accept=".xlsx,.xls" onChange={choose} /><small>Excel .xlsx o .xls</small></>}</div></article>
      </section>
      {message && <p className={message.includes("finalizada") ? "import-success" : "form-error"}>{message}</p>}
      {preview && <section className="panel import-result"><div><p className="eyebrow">VISTA PREVIA</p><h2>Resultado de la validación</h2></div><div className="preview-metrics"><span><strong>{preview.total}</strong>Filas detectadas</span><span><strong>{preview.validos}</strong>Listas para importar</span><span className={preview.errores.length ? "has-errors" : ""}><strong>{preview.errores.length}</strong>Con errores</span></div>{preview.errores.length ? <p className="form-error">Corrige las filas indicadas en el archivo antes de procesar.</p> : <button className="button button-primary" disabled={busy} onClick={process}>Crear o actualizar registros</button>}</section>}
      <section className="panel import-history"><header><div><p className="eyebrow">TRAZABILIDAD</p><h2>Historial de importaciones</h2><small>Los historiales de mantenimiento y SRequest se eliminan junto con sus registros asociados.</small></div><span>{imports.length} archivos</span></header><table><thead><tr><th>Archivo</th><th>Módulo</th><th className="import-action-heading">Estado y acción</th></tr></thead><tbody>{imports.map((item) => <tr key={item.id}><td><strong>{item.nombre_archivo}</strong></td><td>{label(item.modulo)}</td><td className="import-action-cell"><span className="history-status">{item.estado}</span><button className="history-delete" disabled={busy} onClick={() => removeHistory(item)} title="Eliminar archivo importado">Eliminar</button></td></tr>)}{!imports.length && <tr><td colSpan="3" className="empty-state">Aún no hay importaciones.</td></tr>}</tbody></table></section>
    </main>
  </DashboardLayout>;
}

export default Importaciones;
