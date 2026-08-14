import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logos/logo.png";

function LoginForm() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("usuario")) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const iniciarSesion = async (e) => {
    e.preventDefault();

    try {
      const respuesta = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario,
          password,
        }),
      });

      const datos = await respuesta.json();

      console.log("Respuesta Backend:", datos);

      if (respuesta.ok && datos.success) {
        localStorage.setItem("usuario", JSON.stringify(datos.usuario));
        localStorage.setItem("authToken", datos.token);
        navigate(datos.usuario.rol === "Operario" ? "/reportes-planta" : "/dashboard", { replace: true });
      } else {
        alert(
          datos.mensaje ||
          "Usuario o contraseña incorrectos"
        );
      }
    } catch (error) {
      console.error("ERROR:", error);
      alert("No se pudo conectar con el servidor");
    }
  };

  return (
    <form className="login-box" onSubmit={iniciarSesion}>
      <img
        src={logo}
        alt="INCAMAT"
        className="logo"
      />

      <h1 className="titulo">
        INCA<span>MAT</span>
      </h1>

      <p className="subtitulo">
        SISTEMA INTELIGENTE DE MANTENIMIENTO
      </p>

      <hr />

      <h2>Bienvenido de nuevo</h2>

      <p className="texto">
        Ingresa tus credenciales para continuar
      </p>

      <input
        type="text"
        placeholder="Usuario"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        required
      />

      <div className="password-box">
        <input
          type={mostrarPassword ? "text" : "password"}
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="button"
          className="mostrar"
          onClick={() =>
            setMostrarPassword(!mostrarPassword)
          }
        >
          {mostrarPassword ? "🙈" : "👁"}
        </button>
      </div>

      <div className="opciones">
        <label>
          <input type="checkbox" />
          Recordarme
        </label>

        <a href="#">
          ¿Olvidaste tu contraseña?
        </a>
      </div>

      <button
        type="submit"
        className="btn-login"
      >
        INICIAR SESIÓN
      </button>

      <div className="separador">
        <span>ó</span>
      </div>

      <button
        type="button"
        className="btn-qr"
      >
        INGRESAR CON CÓDIGO QR
      </button>

      <p className="footer">
        © 2026 Incalpaca TPX. Todos los derechos reservados.
      </p>
    </form>
  );
}

export default LoginForm;
