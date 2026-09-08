import React from "react";

/**
 * Red de seguridad: si un componente falla al dibujarse, React desmonta toda la app y la
 * pantalla queda en blanco. Con esto se muestra el error y un botón para recargar, y el
 * detalle queda en consola para diagnosticar.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ENERED] Error al dibujar la pantalla:", error, info?.componentStack);
    try {
      const prev = JSON.parse(localStorage.getItem("enered_ultimos_errores") || "[]");
      prev.unshift({ en: new Date().toISOString(), ruta: window.location.pathname + window.location.search,
        error: String(error && (error.stack || error.message || error)).slice(0, 2000),
        componente: String(info?.componentStack || "").slice(0, 1500) });
      localStorage.setItem("enered_ultimos_errores", JSON.stringify(prev.slice(0, 5)));
    } catch (_) {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error);
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }} data-testid="error-boundary">
        <div style={{ background: "#fff", border: "1px solid #FCA5A5", borderRadius: 16, padding: 28, maxWidth: 560, width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Algo falló al mostrar esta pantalla</div>
          <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 14 }}>
            Tus datos están guardados. Recarga para continuar; si vuelve a pasar, envíanos una captura de este mensaje.
          </div>
          <pre style={{ background: "#FEF2F2", color: "#991B1B", fontSize: 12, padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 14px" }}>{msg}</pre>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.location.reload()} style={{ background: "#8039F4", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>Recargar</button>
            <button onClick={() => { window.location.href = "/dashboard"; }} style={{ background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>Ir al inicio</button>
          </div>
        </div>
      </div>
    );
  }
}
