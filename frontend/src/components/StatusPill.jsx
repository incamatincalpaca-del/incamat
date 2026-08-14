function StatusPill({ value }) {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-");
  return <span className={`pill pill-${normalized}`}>{value}</span>;
}
export default StatusPill;
