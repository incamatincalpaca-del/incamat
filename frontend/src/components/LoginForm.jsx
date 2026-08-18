import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import logo from "../assets/logos/logo.png";

function LoginForm() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [qrStatus, setQrStatus] = useState("");

  useEffect(() => {
    if (localStorage.getItem("usuario")) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const detenerCamara = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    scanner.stop().catch(() => undefined).finally(() => scanner.clear().catch(() => undefined));
  }, []);

  const cerrarEscaner = useCallback(() => {
    detenerCamara();
    setQrOpen(false);
    setQrStatus("");
  }, [detenerCamara]);

  const abrirReporte = useCallback((value) => {
    const raw = String(value || "").trim();
    if (!raw) return;
    const token = raw.includes("/reportar/") ? raw.split("/reportar/").pop().split(/[?#]/)[0] : raw;
    cerrarEscaner();
    navigate(`/reportar/${encodeURIComponent(token)}`);
  }, [cerrarEscaner, navigate]);

  useEffect(() => {
    if (!qrOpen) return undefined;
    let cancelled = false;

    const iniciarCamara = async () => {
      setQrStatus("Solicitando permiso para usar la cÃ¡mara...");
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      if (cancelled) return;

      const scanner = new Html5Qrcode("qr-camera-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.333 },
          (decodedText) => abrirReporte(decodedText),
          () => undefined,
        );
        if (!cancelled) setQrStatus("Apunta la cÃ¡mara al cÃ³digo QR de la mÃ¡quina.");
      } catch (_error) {
        if (!cancelled) setQrStatus("No se pudo usar la cÃ¡mara. Autoriza el permiso de cÃ¡mara o pega el cÃ³digo o enlace QR.");
      }
    };

    iniciarCamara();
    return () => {
      cancelled = true;
      detenerCamara();
    };
  }, [abrirReporte, detenerCamara, qrOpen]);

  const iniciarSesion = async (event) => {
    event.preventDefault();
    try {
      const respuesta = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, password }),
      });
      const datos = await respuesta.json();
      if (respuesta.ok && datos.success) {
        localStorage.setItem("usuario", JSON.stringify(datos.usuario));
        localStorage.setItem("authToken", datos.token);
        window.dispatchEvent(new Event("incamat:login"));
        navigate(datos.usuario.rol === "Operario" ? "/reportes-planta" : "/dashboard", { replace: true });
      } else alert(datos.mensaje || "Usuario o contraseÃ±a incorrectos");
    } catch { alert("No se pudo conectar con el servidor"); }
  };

  return <form className="login-box" onSubmit={iniciarSesion}>
    <img src={logo} alt="INCAMAT" className="logo" />
    <h1 className="titulo">INCA<span>MAT</span></h1>
    <p className="subtitulo">SISTEMA INTELIGENTE DE MANTENIMIENTO</p><hr />
    <h2>Bienvenido de nuevo</h2><p className="texto">Ingresa tus credenciales para continuar</p>
    <input type="text" placeholder="Usuario" value={usuario} onChange={(event) => setUsuario(event.target.value)} required />
    <div className="password-box"><input type={mostrarPassword ? "text" : "password"} placeholder="ContraseÃ±a" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="mostrar" onClick={() => setMostrarPassword(!mostrarPassword)}>{mostrarPassword ? "Ocultar" : "Ver"}</button></div>
    <div className="opciones"><label><input type="checkbox" />Recordarme</label><a href="#">Â¿Olvidaste tu contraseÃ±a?</a></div>
    <button type="submit" className="btn-login">INICIAR SESIÃ“N</button>
    <div className="separador"><span>o</span></div>
    <button type="button" className="btn-qr" onClick={() => setQrOpen(true)}>INGRESAR CON CÃ“DIGO QR</button>
    <p className="footer">Â© 2026 Incalpaca TPX. Todos los derechos reservados.</p>
    {qrOpen && <div className="qr-login-backdrop" role="dialog" aria-modal="true"><section className="qr-login-dialog"><button className="qr-login-close" type="button" onClick={cerrarEscaner}>Ã—</button><p className="subtitulo">REPORTE DE PLANTA</p><h2>Escanear cÃ³digo QR</h2><p className="texto">{qrStatus}</p><div id="qr-camera-reader" className="qr-camera" /><div className="qr-manual"><input type="text" placeholder="O pega aquÃ­ el cÃ³digo o enlace QR" value={qrValue} onChange={(event) => setQrValue(event.target.value)} /><button type="button" className="btn-login" onClick={() => abrirReporte(qrValue)}>ABRIR REPORTE</button></div><small>Al detectar el cÃ³digo, se abrirÃ¡ la mÃ¡quina para reportar la incidencia sin iniciar sesiÃ³n.</small></section></div>}
  </form>;
}

export default LoginForm;

