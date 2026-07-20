import React from "react";

export default function Privacidad() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif" }}>
      <h1>Términos de Servicio y Política de Privacidad</h1>
      
      <section style={{ marginTop: "20px" }}>
        <h2>Términos de Servicio</h2>
        <p>
          Al utilizar nuestros servicios, usted acepta recibir comunicaciones relacionadas con el servicio. Usted puede optar por no recibir mensajes (opt-out) en cualquier momento respondiendo "STOP" a nuestros mensajes de texto.
        </p>
      </section>
      
      <section style={{ marginTop: "20px" }}>
        <h2>Política de Privacidad</h2>
        <p>
          Respetamos su privacidad. Ningún número de teléfono móvil u otra información personal será compartida, vendida ni alquilada a terceros ni afiliados para fines de marketing o promocionales. Sus datos solo se utilizan para proveer el servicio que ha solicitado.
        </p>
      </section>
    </div>
  );
}
