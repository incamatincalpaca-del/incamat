import { Navigate, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Localizaciones from "../pages/Localizaciones";
import Maquinas from "../pages/Maquinas";
import Componentes from "../pages/Componentes";
import Importaciones from "../pages/Importaciones";
import Mantenimientos from "../pages/Mantenimientos";
import Fallas from "../pages/Fallas";
import ReporteQR from "../pages/ReporteQR";
import Solicitudes from "../pages/Solicitudes";
import Usuarios from "../pages/Usuarios";
import Anuncios from "../pages/Anuncios";
import MisTareas from "../pages/MisTareas";
import ProtectedRoute from "../components/ProtectedRoute";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/reportar/:token" element={<ReporteQR />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/anuncios" element={<Anuncios />} />
        <Route path="/reportes-planta" element={<Fallas />} />
        <Route element={<ProtectedRoute roles={["Administrador", "Supervisor", "Tecnico", "Técnico", "Ingeniero"]} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/localizaciones" element={<Localizaciones />} />
          <Route path="/maquinas" element={<Maquinas />} />
          <Route path="/maquinas-paradas" element={<Maquinas stoppedOnly />} />
          <Route path="/componentes" element={<Componentes />} />
          <Route path="/mantenimientos" element={<Mantenimientos />} />
          <Route path="/ordenes-mantenimiento" element={<Mantenimientos />} />
          <Route path="/fallas" element={<Fallas />} />
          <Route path="/solicitudes" element={<Solicitudes />} />
        </Route>
        <Route element={<ProtectedRoute roles={["Tecnico", "Técnico", "Ingeniero"]} />}>
          <Route path="/mis-tareas" element={<MisTareas />} />
        </Route>
        <Route element={<ProtectedRoute roles={["Administrador", "Ingeniero"]} />}>
          <Route path="/importaciones" element={<Importaciones />} />
        </Route>
        <Route element={<ProtectedRoute roles={["Administrador"]} />}>
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
