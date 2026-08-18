import Sidebar from "../components/Sidebar";
import "../styles/dashboard.css";
import "../styles/navigation-pro.css";

function DashboardLayout({ children }) {
  const user = JSON.parse(localStorage.getItem("usuario") || "{}");
  return (
    <div className="dashboard">

      <Sidebar />

      <main className="dashboard-content">
        <div className="topbar"><span>Planta Incalpaca TPX</span><span className="topbar-date">{user.rol || "Usuario"} · {new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}</span></div>
        {children}
      </main>

    </div>
  );
}

export default DashboardLayout;
