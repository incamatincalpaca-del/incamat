import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import StatusPill from "../components/StatusPill";
import { useIncaMant } from "../data/incamatData";

const API = import.meta.env.VITE_API_URL || "/api";

function Historial({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => { fetch(`${API}/maquinas/${id}/historial`).then((r) => r.json()).then(setData).catch(() => setData({ mantenimientos: [], fallas: [], repuestos: [] })); }, [id]);
  if (!data) return <p className="empty-state">Cargando historial...</p>;
  const lines = (items, render, fallback) => items.length ? items.slice(0, 3).map(render) : <p>{fallback}</p>;
  return <section className="history-machine"><h3>Historial técnico</h3><div><strong>Mantenimientos ({data.mantenimientos.length})</strong>{lines(data.mantenimientos, (x) => <p key={x.id}>{x.tipo} · {x.estado} · {String(x.fecha_programada).slice(0, 10)}</p>, "Sin registros.")}</div><div><strong>Fallas ({data.fallas.length})</strong>{lines(data.fallas, (x) => <p key={x.id}>{x.prioridad} · {x.estado}</p>, "Sin registros.")}</div><div><strong>Repuestos usados ({data.repuestos.length})</strong>{lines(data.repuestos, (x, i) => <p key={`${x.numero_vale}-${i}`}>{x.descripcion} · {x.cantidad}</p>, "Sin registros.")}</div></section>;
}

function Ficha({ machine, onClose }) {
  if (!machine) return null;
  const qr = `${API}/maquinas/${machine.id}/qr.png`;
  return <div className="modal-backdrop"><section className="modal modal-wide machine-detail"><div className="modal-header"><div><p className="eyebrow">FICHA DE MÁQUINA</p><h2>{machine.nombre}</h2><p>{machine.descripcion_corta || `Equipo del área ${machine.area}.`}</p></div><button onClick={onClose}>×</button></div><div className="machine-ficha"><dl><div><dt>Área</dt><dd>{machine.area}</dd></div><div><dt>Estado</dt><dd>{machine.estado}</dd></div><div><dt>Marca</dt><dd>{machine.marca || "Sin registro"}</dd></div><div><dt>Modelo</dt><dd>{machine.modelo || "Sin registro"}</dd></div><div><dt>Código interno</dt><dd>{machine.codigo}</dd></div></dl><aside><img src={qr} alt={`QR de ${machine.nombre}`} /><a className="button button-primary" href={qr} download={`QR-${machine.codigo}.png`}>Descargar QR</a><small>Escanea este código para identificar la máquina.</small></aside></div><Historial id={machine.id} /></section></div>;
}

function Maquinas({ stoppedOnly = false }) {
  const { machines, areas, addMachine } = useIncaMant();
  const [search, setSearch] = useState(""); const [area, setArea] = useState("Todas"); const [view, setView] = useState("tabla");
  const [selected, setSelected] = useState(null); const [open, setOpen] = useState(false); const [form, setForm] = useState({ codigo: "", nombre: "", area: "", estado: "Operativa" });
  const [summary, setSummary] = useState({ totals: { paradas: 0, espera_repuesto: 0, pendiente_atencion: 0, en_mantenimiento: 0 }, areas: [] });
  useEffect(() => { if (stoppedOnly) fetch(`${API}/maquinas/paradas/resumen`).then((r) => r.json()).then(setSummary).catch(() => undefined); }, [stoppedOnly, machines]);
  const active = areas.filter((item) => item.maquinas > 0);
  const rows = useMemo(() => machines.filter((machine) => (!stoppedOnly || ["Detenida", "Mantenimiento"].includes(machine.estado)) && (area === "Todas" || machine.area === area) && `${machine.nombre} ${machine.area} ${machine.marca || ""} ${machine.modelo || ""}`.toLowerCase().includes(search.toLowerCase())), [machines, area, search, stoppedOnly]);
  const save = async (event) => { event.preventDefault(); await addMachine(form); setOpen(false); };
  const reason = (machine) => machine.estado_falla === "Esperando repuesto" ? `Esperando repuesto${machine.motivo_parada ? `: ${machine.motivo_parada}` : ""}` : machine.estado_falla ? `Pendiente de atención${machine.motivo_parada ? `: ${machine.motivo_parada}` : ""}` : machine.estado === "Mantenimiento" ? "En mantenimiento o pendiente de validación" : "Detenida sin incidencia registrada";
  const title = stoppedOnly ? "Máquinas paradas" : "Máquinas";
  const description = stoppedOnly ? "Consulta equipos detenidos o en mantenimiento y el motivo de su parada." : "Selecciona una máquina para ver su ficha, descripción y código QR.";
  return <DashboardLayout>
    <PageHeader eyebrow="ACTIVOS DE PLANTA" title={title} description={description} action={stoppedOnly ? <Link className="button button-secondary" to="/maquinas">Ver todas las máquinas</Link> : <><Link className="button button-secondary" to="/importaciones?modulo=Maquinas">Importar Excel</Link><button className="button button-primary" onClick={() => setOpen(true)}>+ Nueva máquina</button></>} />
    {stoppedOnly && <section className="stopped-kpi-panel"><header><div><p className="eyebrow">KPIs POR ÁREA</p><h2>Paradas de planta</h2><p>Detecta las áreas que requieren mayor atención.</p></div></header><div className="stopped-kpi-grid"><article><strong>{summary.totals.paradas}</strong><span>Máquinas paradas</span></article><article><strong>{summary.totals.espera_repuesto}</strong><span>Esperando repuesto</span></article><article><strong>{summary.totals.pendiente_atencion}</strong><span>Pendientes de atención</span></article><article><strong>{summary.totals.en_mantenimiento}</strong><span>En mantenimiento</span></article></div><div className="stopped-area-table"><table><thead><tr><th>Área</th><th>Paradas</th><th>Por repuesto</th><th>Pendientes</th><th>En mantenimiento</th></tr></thead><tbody>{summary.areas.map((item) => <tr key={item.area}><td><strong>{item.area}</strong></td><td>{item.paradas}</td><td>{item.espera_repuesto}</td><td>{item.pendiente_atencion}</td><td>{item.en_mantenimiento}</td></tr>)}{!summary.areas.length && <tr><td className="empty-state" colSpan="5">No hay áreas con máquinas paradas.</td></tr>}</tbody></table></div></section>}
    <section className="machine-guide"><span>1</span><p><strong>Busca</strong> o filtra por área.</p><span>2</span><p><strong>Presiona</strong> una máquina para ver su ficha y QR.</p><b>{rows.length} {stoppedOnly ? "máquinas paradas" : "máquinas"}</b></section>
    <section className="toolbar"><input className="search-input" placeholder="Buscar máquina, marca o modelo..." value={search} onChange={(event) => setSearch(event.target.value)} /><select className="area-filter" value={area} onChange={(event) => setArea(event.target.value)}><option>Todas</option>{active.map((item) => <option key={item.id}>{item.nombre}</option>)}</select><div className="view-toggle"><button className={view === "tabla" ? "selected" : ""} onClick={() => setView("tabla")}>Tabla</button><button className={view === "tarjetas" ? "selected" : ""} onClick={() => setView("tarjetas")}>Tarjetas</button></div></section>
    {view === "tabla" ? <section className="panel table-panel incalpaca-table"><table><thead><tr><th>Máquina</th><th>Área</th>{stoppedOnly && <th>Motivo de parada</th>}<th>Marca</th><th>Modelo</th><th>Estado</th></tr></thead><tbody>{rows.map((machine) => <tr className="clickable-row" key={machine.id} onClick={() => setSelected(machine)}><td><strong>{machine.nombre}</strong></td><td>{machine.area}</td>{stoppedOnly && <td className="stop-reason">{reason(machine)}</td>}<td>{machine.marca || "-"}</td><td>{machine.modelo || "-"}</td><td><StatusPill value={machine.estado} /></td></tr>)}{!rows.length && <tr><td className="empty-state" colSpan={stoppedOnly ? "6" : "5"}>No hay máquinas paradas para este filtro.</td></tr>}</tbody></table></section> : <section className="machine-card-grid">{rows.map((machine) => <button className="machine-card" key={machine.id} onClick={() => setSelected(machine)}><div><span className="machine-card-icon">▣</span><StatusPill value={machine.estado} /></div><h2>{machine.nombre}</h2><p>{machine.area}</p><small>{stoppedOnly ? reason(machine) : machine.descripcion_corta}</small><b>Ver ficha y QR →</b></button>)}{!rows.length && <p className="empty-state">No hay máquinas paradas para este filtro.</p>}</section>}
    {open && <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-header"><h2>Nueva máquina</h2><button type="button" onClick={() => setOpen(false)}>×</button></div><label>Código<input required value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} /></label><label>Máquina<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label>Área<select value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })}>{areas.map((item) => <option key={item.id}>{item.nombre}</option>)}</select></label><button className="button button-primary">Guardar</button></form></div>}
    <Ficha machine={selected} onClose={() => setSelected(null)} />
  </DashboardLayout>;
}

export default Maquinas;
