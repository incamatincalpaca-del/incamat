import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import logo from "../assets/logos/logo.png";

function LoginForm() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const scanningRef = useRef(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (localStorage.getItem("usuario")) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const detenerCamara = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    scanningRef.current = false;
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
    if (!raw) {
      setQrStatus("Escanea un cÃ³digo QR o pega el enlace de la mÃ¡quina.");
      return;
    }
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
      const onScan = (decodedText) => {
        if (!scanningRef.current) {
          scanningRef.current = true;
          abrirReporte(decodedText);
        }
      };
      try {
        const scanner = new Html5Qrcode("qr-camera-reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: { exact: "environment" } }, { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.333 }, onScan, () => undefined);
        if (!cancelled) setQrStatus("Apunta la cÃ¡mara al cÃ³digo QR de la mÃ¡quina.");
      } catch {
        try {
          await scannerRef.current?.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, onScan, () => undefined);
          if (!cancelled) setQrStatus("Apunta la cÃ¡mara al cÃ³digo QR de la mÃ¡quina.");
        } catch {
          if (!cancelled) setQrStatus("No se pudo usar la cÃ¡mara. Autoriza el permiso de cÃ¡mara o pega el enlace QR.");
        }
      }
    };
    iniciarCamara();
    return () => { cancelled = true; detenerCamara(); };
  }, [abrirReporte, detenerCamara, qrOpen]);

  const leerImagenQr = async (event) => {
    const image = event.target.files?.[0];
    if (!image) return;
    try {
      setQrStatus("Leyendo la imagen del cÃ³digo QR...");
      const scanner = new Html5Qrcode("qr-camera-reader");
      const decodedText = await scanner.scanFile(image, true);
      await scanner.clear().catch(() => undefined);
      abrirReporte(decodedText);
    } catch {
      setQrStatus("No se pudo leer ese archivo. Usa una foto clara del cÃ³digo QR.");
    } finally {
      event.target.value = "";
    }
  };

  const iniciarSesion = async (event) => {
    event.preventDefault();
    setLoginError("");
    try {
      const respuesta = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: usuario.trim(), password }),
      });
      const datos = await respuesta.json();
      if (respuesta.ok && datos.success) {
        localStorage.setItem("usuario", JSON.stringify(datos.usuario));
        localStorage.setItem("authToken", datos.token);
        window.dispatchEvent(new Event("incamat:login"));
        navigate(datos.usuario.rol === "Operario" ? "/reportes-planta" : "/dashboard", { replace: true });
      } else setLoginError(datos.mensaje || "Usuario, correo o contraseÃ±a incorrectos.");
    } catch {
      setLoginError("No se pudo conectar con el servidor. Verifica que INCAMAT estÃ© disponible.");
    }
  };

  return <form className="login-box" onSubmit={iniciarSesion}>
    <img src={logo} alt="INCAMAT" className="logo" />
    <h1 className="titulo">INCA<span>MAT</span></h1>
    <p className="subtitulo">SISTEMA INTELIGENTE DE MANTENIMIENTO</p><hr />
    <h2>Bienvenido de nuevo</h2><p className="texto">Ingresa tus credenciales para continuar</p>
    <input type="text" placeholder="Usuario o correo" value={usuario} onChange={(event) => setUsuario(event.target.value)} required autoComplete="username" />
    <div className="password-box"><input type={mostrarPassword ? "text" : "password"} placeholder="ContraseÃ±a" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /><button type="button" className="mostrar" onClick={() => setMostrarPassword(!mostrarPassword)}>{mostrarPassword ? "Ocultar" : "Ver"}</button></div>
    {loginError && <p className="login-error" role="alert">{loginError}</p>}
    <div className="opciones"><label><input type="checkbox" />Recordarme</label><span>Usa tu usuario o correo registrado</span></div>
    <button type="submit" className="btn-login">INICIAR SESIÃ“N</button>
    <div className="separador"><span>o</span></div>
    <button type="button" className="btn-qr" onClick={() => setQrOpen(true)}>ESCANEAR CÃ“DIGO QR</button>
    <p className="footer">Â© 2026 Incalpaca TPX. Todos los derechos reservados.</p>
    {qrOpen && <div className="qr-login-backdrop" role="dialog" aria-modal="true"><section className="qr-login-dialog"><button className="qr-login-close" type="button" onClick={cerrarEscaner} aria-label="Cerrar">Ã—</button><p className="subtitulo">REPORTE DE PLANTA</p><h2>Escanear cÃ³digo QR</h2><p className="texto">{qrStatus}</p><div id="qr-camera-reader" className="qr-camera" /><div className="qr-image-option"><label>TambiÃ©n puedes elegir una foto del QR<input type="file" accept="image/png,image/jpeg,image/webp" onChange={leerImagenQr} /></label></div><div className="qr-manual"><input type="text" placeholder="O pega aquÃ­ el cÃ³digo o enlace QR" value={qrValue} onChange={(event) => setQrValue(event.target.value)} /><button type="button" className="btn-login" onClick={() => abrirReporte(qrValue)}>ABRIR REPORTE</button></div><small>Al detectar el cÃ³digo, se abrirÃ¡ la ficha de la mÃ¡quina para reportar la incidencia sin iniciar sesiÃ³n.</small></section></div>}
  </form>;
}

export default LoginForm;

