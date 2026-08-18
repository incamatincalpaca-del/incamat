import { NavLink, useNavigate } from "react-router-dom";

const sections = [
  {
    title: "INICIO",
    links: [
      { to: "/dashboard", icon: "▦", label: "Dashboard", note: "KPIs y alertas" },
      { to: "/anuncios", icon: "◉", label: "Anuncios", note: "Avisos para tu área" },
    ],
  },
  {
    title: "OPERACIÓN DIARIA",
    links: [
      { to: "/reportes-planta", icon: "!", label: "Reportes de planta", note: "QR e incidencias" },
      { to: "/ordenes-mantenimiento", icon: "✓", label: "Órdenes y planificación", note: "Correctivos y planes" },
      { to: "/mis-tareas", icon: "☑", label: "Mis tareas", note: "Asignaciones del administrador" },
    ],
  },
  {
    title: "ACTIVOS",
    links: [
      { to: "/localizaciones", icon: "⌖", label: "Áreas y localizaciones", note: "Planta → área → equipo" },
      { to: "/maquinas", icon: "▣", label: "Máquinas", note: "Ficha, QR e historial" },
      { to: "/maquinas-paradas", icon: "!", label: "Máquinas paradas", note: "Detenidas y en mantenimiento" },
    ],
  },
  {
    title: "ALMACÉN",
    links: [
      { to: "/componentes", icon: "◇", label: "Repuestos", note: "Stock y criticidad" },
      { to: "/solicitudes", icon: "↗", label: "Solicitudes de repuesto", note: "Aprobación y entrega" },
    ],
  },
  { title: "CONTROL", links: [{ to: "/importaciones", icon: "↑", label: "Importaciones", note: "Excel e historial" }] },
];
const cleanText = (value) => String(value || "").replace(/T(\?\?|Ã©|�)cnico/gi, "Técnico");
const displayRole = (role) => ["Tecnico", "Técnico", "TÃ©cnico", "T??cnico"].includes(role) ? "Técnico" : cleanText(role);

function Sidebar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("usuario") || "{}");
  const isOperario = user.rol === "Operario";
  const canImport = ["Administrador", "Ingeniero"].includes(user.rol);
  const canSeeOwnTasks = ["Ingeniero", "Tecnico", "Técnico"].includes(user.rol);
  const visibleSections = sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => {
        if (isOperario) return ["/reportes-planta", "/anuncios"].includes(link.to);
        if (!canImport && link.to === "/importaciones") return false;
        if (!canSeeOwnTasks && link.to === "/mis-tareas") return false;
        return true;
      }),
    }))
    .filter((section) => section.links.length);

  if (user.rol === "Administrador") {
    visibleSections.push({
      title: "ADMINISTRACIÓN",
      links: [{ to: "/usuarios", icon: "♙", label: "Usuarios y permisos", note: "Cuentas, áreas y tareas" }],
    });
  }

  const logout = () => {
    localStorage.removeItem("usuario");
    localStorage.removeItem("authToken");
    navigate("/", { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">I</div><div><h2>INCAMAT</h2><span>Gestión de activos y mantenimiento</span></div></div>
      <nav className="nav-sections">
        {visibleSections.map((section) => (
          <section key={section.title}>
            <p className="nav-label">{section.title}</p>
            {section.links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/maquinas"} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <span>{link.icon}</span><div><b>{link.label}</b><small>{link.note}</small></div>
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
      <button className="sidebar-user" onClick={logout}>
        <span>{(user.nombre || "A").slice(0, 2).toUpperCase()}</span>
        <div><strong>{cleanText(user.nombre) || "Administrador"}</strong><small>{displayRole(user.rol) || "Usuario"} · Cerrar sesión</small></div>
      </button>
    </aside>
  );
}

export default Sidebar;
