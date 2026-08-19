import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/reporte-qr.css";

const API = import.meta.env.VITE_API_URL || "/api";

export default function ReporteQR() {
  const { token } = useParams();
  const [machine, setMachine] = useState(null);
  const [form, setForm] = useState({ descripcion: "", prioridad: "Media", reportado_por: "", fecha_ocurrencia: new Date().toISOString().slice(0, 16) });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API}/maquinas/por-qr/${encodeURIComponent(token)}`)
      .then(async (response) => response.ok ? response.json() : { error: (await response.json()).error || "No se pudo leer el QR." })
      .then(setMachine)
      .catch(() => setMachine({ error: "No se pudo leer el QR. Revisa tu conexiÃ³n e intÃ©ntalo otra vez." }));
  }, [token]);

  const send = async (event) => {
    event.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append("id_maquina", machine.id);
    if (file) data.append("evidencia", file);
    const response = await fetch(`${API}/fallas`, { method: "POST", body: data });
    const body = await response.json();
    setMessage(response.ok ? "Incidencia enviada a Mantenimiento. La mÃ¡quina fue marcada como detenida." : body.error);
  };

  if (!machine) return <main className="qr-report"><p>Cargando mÃ¡quina...</p></main>;
  if (machine.error) return <main className="qr-report"><h1>QR no vÃ¡lido</h1><p>{machine.error}</p></main>;
  return <main className="qr-report"><section><p className="eyebrow">REPORTE DE INCIDENCIA</p><h1>{machine.nombre}</h1><p>{machine.area} Â· CÃ³digo {machine.codigo}</p><div className="qr-status">Estado actual: {machine.estado}</div>{message ? <p className="qr-message">{message}</p> : <form onSubmit={send}><label>Â¿QuÃ© estÃ¡ ocurriendo?<textarea required placeholder="Describe el sÃ­ntoma o problema observado" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label><label>Fecha y hora de ocurrencia<input required type="datetime-local" value={form.fecha_ocurrencia} onChange={(event) => setForm({ ...form, fecha_ocurrencia: event.target.value })} /></label><label>Prioridad<select value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value })}><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option><option value="Critica">CrÃ­tica</option></select></label><label>Foto de cÃ³mo se encontrÃ³<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><label>Tu nombre<input required value={form.reportado_por} onChange={(event) => setForm({ ...form, reportado_por: event.target.value })} /></label><button>Enviar incidencia</button></form>}</section></main>;
}

