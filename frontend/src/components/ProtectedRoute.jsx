import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute({ roles }) {
  const savedUser = localStorage.getItem("usuario");
  if (!savedUser) {
    localStorage.removeItem("usuario");
    return <Navigate to="/" replace />;
  }

  try {
    const user = JSON.parse(savedUser);
    if (roles && !roles.includes(user.rol)) {
      return <Navigate to="/reportes-planta" replace />;
    }
  } catch {
    localStorage.removeItem("usuario");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
