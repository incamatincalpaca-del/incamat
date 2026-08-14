import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import PageHeader from "../components/PageHeader";
import { canManagePlanning } from "../data/roles";
import "../styles/dashboard-live.css";

const API = import.meta.env.VITE_API_URL || "/api";
const empty = { maquinas: {}, repuestos: {}, mantenimientos: {}, kpis: {}, recientes: [] };
const percent = (value) => value == null ? "Sin datos" : `${value}%`;
const summaryCards = [
  ["correctivo", "Correctivo", "Atenciones por falla o avería"],
  ["preventivo", "Preventivo", "Conservación programada"],
  ["rutinario", "Rutinario", "Actividades repetitivas de control"],
  ["limpieza", "Limpieza", "Limpieza técnica registrada"],
  ["proyecto", "Proyecto", "Trabajos de proyecto"],
  ["mejora", "Mejora", "Mejoras implementadas"],
  ["seguridad", "Seguridad", "Actividades de seguridad"],
  ["apoyo", "Apoyo", "Soporte a otras actividades"],
  ["otros", "Otros", "Registros no clasificados arriba"],
];
const barPalette = ["#df695b", "#e0a019", "#318ea3", "#7ea7c8", "#8a6db4", "#39a176", "#dc8b27", "#6984a1", "#85909d"];

function Dashboard() {
  const [data, setData] = useState(empty);
  const [periodo, setPeriodo] = useState("todo");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [historyView, setHistoryView] = useState("cards");

  useEffect(() => {
    const load = () => fetch(`${API}/dashboard?periodo=${periodo}&fecha=${fecha}`)
      .then((response) => response.json())
      .then(setData);
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [periodo, fecha]);

  const { kpis = {}, maquinas = {}, repuestos = {}, mantenimientos = {}, solicitudes = {}, resumen_mantenimiento: maintenanceSummary = {} } = data;
  const totalHistory = summaryCards.reduce((total, [key]) => total + Number(maintenanceSummary[key] || 0), 0);
  const maxHistory = Math.max(...summaryCards.map(([key]) => Number(maintenanceSummary[key] || 0)), 1);
  const canPlan = canManagePlanning();
  return <DashboardLayout>
    <PageHeader eyebrow="KPIs OPERATIVOS" title="Panel de control" description="Indicadores calculados con los datos registrados en INCAMAT." action={canPlan ? <Link className="button button-primary" to="/mantenimientos">Programar mantenimiento</Link> : null} />
    <section className="kpi-grid">
      <article><p>Disponibilidad</p><strong>{percent(kpis.disponibilidad)}</strong><small>Máquinas operativas / total</small></article>
      <article><p>Cumplimiento preventivo</p><strong>{percent(kpis.cumplimiento_preventivo)}</strong><small>Mantenimientos completados</small></article>
      <article><p>Stock verificado</p><strong>{percent(kpis.stock_verificado)}</strong><small>Inventario físico validado</small></article>
      <article><p>MTTR</p><strong>{kpis.mttr_horas == null ? "Sin datos" : `${kpis.mttr_horas} h`}</strong><small>Tiempo medio de resolución</small></article>
    </section>
    <section className="metric-grid">
      <article className="metric-card"><span className="metric-icon blue">▣</span><div><strong>{maquinas.total || 0}</strong><p>Máquinas registradas</p></div></article>
      <article className="metric-card metric-card-detail"><span className="metric-icon red">!</span><div><strong>{maquinas.paradas || 0}</strong><p>Máquinas paradas</p><small>{maquinas.espera_repuesto || 0} por repuesto · {maquinas.pendientes_atencion || 0} pendientes</small></div></article>
      <article className="metric-card"><span className="metric-icon amber">!</span><div><strong>{repuestos.bajo_minimo || 0}</strong><p>Repuestos bajo mínimo</p></div></article>
      <article className="metric-card"><span className="metric-icon purple">!</span><div><strong>{data.fallas_abiertas || 0}</strong><p>Fallas abiertas</p></div></article>
      <article className="metric-card"><span className="metric-icon blue">↗</span><div><strong>{solicitudes.pendientes || 0}</strong><p>Solicitudes por aprobar</p></div></article>
    </section>
    <section className="maintenance-overview">
      <header><div><p className="eyebrow">HISTORIAL DE MANTENIMIENTOS</p><h2>Actividades por tipo</h2><p>Las tarjetas se recalculan con los registros del período seleccionado.</p></div><Link to="/mantenimientos">Abrir centro de mantenimiento →</Link></header>
      <div className="history-calendar-filter">
        <div className="period-buttons" role="group" aria-label="Período del historial">
          {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"], ["todo", "Todo"]].map(([value, label]) => <button type="button" key={value} className={periodo === value ? "active" : ""} onClick={() => setPeriodo(value)}>{label}</button>)}
        </div>
        <div className="history-toolbar-right"><div className="history-view-switch" role="group" aria-label="Forma de visualizar el historial"><button type="button" className={historyView === "cards" ? "active" : ""} onClick={() => setHistoryView("cards")}>▦ Tarjetas</button><button type="button" className={historyView === "chart" ? "active" : ""} onClick={() => setHistoryView("chart")}>▤ Gráfico</button></div><label className="history-date-picker"><span>▣</span><input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} aria-label="Fecha de referencia" /><b>{periodo === "todo" ? "Todo el historial" : "Fecha de referencia"}</b></label></div>
      </div>
      {historyView === "cards" ? <div className="maintenance-overview-grid history-type-grid">
        {summaryCards.map(([key, title, detail]) => <Link key={key} to="/mantenimientos" className={`maintenance-summary-card ${key}`}><span>{title}</span><strong>{maintenanceSummary[key] || 0}</strong><small>{detail}</small></Link>)}
      </div> : <section className="history-analytics">
        <article className="history-donut-panel"><header><h3>Actividades por tipo</h3><small>Distribución del período</small></header><div className="history-donut" style={{ background: `conic-gradient(${summaryCards.map(([key], index) => { const start = summaryCards.slice(0, index).reduce((sum, [previous]) => sum + Number(maintenanceSummary[previous] || 0), 0); const end = start + Number(maintenanceSummary[key] || 0); return `${barPalette[index]} ${(start / Math.max(totalHistory, 1)) * 100}% ${(end / Math.max(totalHistory, 1)) * 100}%`; }).join(", ")})` }}><div><strong>{totalHistory}</strong><small>actividades</small></div></div><ul className="donut-legend">{summaryCards.map(([key, title], index) => <li key={key}><i style={{ background: barPalette[index] }} /><span>{title}</span><b>{maintenanceSummary[key] || 0}</b></li>)}</ul></article>
        <article className="history-column-panel"><header><div><p className="eyebrow">COMPARATIVO</p><h3>Mantenimientos registrados</h3><small>Altura proporcional a cada tipo.</small></div><span>{totalHistory} total</span></header><div className="history-column-chart" role="img" aria-label="Gráfico de columnas de mantenimientos por tipo">{summaryCards.map(([key, title], index) => { const value = Number(maintenanceSummary[key] || 0); const height = value ? Math.max((value / maxHistory) * 100, 3) : 0; return <div className="history-column" key={key}><b>{value}</b><div className="history-column-track"><i style={{ height: `${height}%`, background: barPalette[index] }} /></div><small>{title}</small></div>; })}</div></article>
        <article className="history-ranking-panel"><header><p className="eyebrow">PRIORIDAD DEL HISTORIAL</p><h3>Tipos con mayor registro</h3></header><div className="history-bar-chart" role="img" aria-label="Ranking de mantenimientos por tipo">{summaryCards.slice().sort(([first], [second]) => Number(maintenanceSummary[second] || 0) - Number(maintenanceSummary[first] || 0)).slice(0, 5).map(([key, title]) => { const value = Number(maintenanceSummary[key] || 0); const width = value ? Math.max((value / maxHistory) * 100, 2) : 0; const index = summaryCards.findIndex(([item]) => item === key); return <div className="history-bar-row" key={key}><span>{title}</span><div className="history-bar-track"><i style={{ width: `${width}%`, backgroundColor: barPalette[index] }} /></div><b>{value}</b></div>; })}</div></article>
      </section>}
    </section>
  </DashboardLayout>;
}

export default Dashboard;
