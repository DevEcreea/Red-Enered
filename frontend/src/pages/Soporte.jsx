import React, { useMemo, useState } from "react";
import { Search, ChevronDown, Mail, Phone } from "lucide-react";

const WA_PHONE = "51972228870";
const WA_LINK_BASE = `https://wa.me/${WA_PHONE}`;
const EMAIL_SOPORTE = "soporte@enered.pe";
const EMAIL_COMERCIAL = "comercial@enered.pe";

const HELP_CARDS = [
  {
    key: "pedidos",
    title: "Pedidos",
    img: "https://images.pexels.com/photos/7793740/pexels-photo-7793740.jpeg",
    waMsg: "Hola ENERED, necesito ayuda con mis Pedidos.",
  },
  {
    key: "liberacion",
    title: "Liberación de Pedidos",
    img: "https://images.pexels.com/photos/6869055/pexels-photo-6869055.jpeg",
    waMsg: "Hola ENERED, necesito ayuda con la Liberación de Pedidos.",
  },
  {
    key: "programacion",
    title: "Programación",
    img: "https://images.pexels.com/photos/6172482/pexels-photo-6172482.jpeg",
    waMsg: "Hola ENERED, necesito ayuda con Programación.",
  },
  {
    key: "estado",
    title: "Estado de Cuenta",
    img: "https://images.pexels.com/photos/6969933/pexels-photo-6969933.jpeg",
    waMsg: "Hola ENERED, necesito ayuda con mi Estado de Cuenta.",
  },
];

// FAQ con categorías estilo del screenshot
const FAQ = [
  {
    cat: "General",
    items: [
      { q: "¿Qué es ENERED?", a: "ENERED es una plataforma integral de gestión de combustible para flotas que te permite controlar consumos, ahorros, facturación y operaciones desde un único panel." },
      { q: "¿Cómo creo una cuenta de usuario?", a: "El administrador de tu empresa puede crear usuarios desde el módulo Admin → Usuarios. Cada usuario recibe credenciales y un rol asignado." },
      { q: "¿Qué roles existen y qué puede hacer cada uno?", a: "Existen 4 roles: admin_enered (acceso total), administrador (todo excepto admin), logística (sin facturación) y contabilidad (sin control integral)." },
    ],
  },
  {
    cat: "Pedidos",
    items: [
      { q: "¿Cómo solicito un nuevo pedido de combustible?", a: "Comunícate con tu ejecutivo a través del WhatsApp oficial o reserva tu pedido directamente desde tu sistema operativo habitual." },
      { q: "¿Puedo modificar un pedido ya registrado?", a: "Sí, mientras no haya sido liberado. Contacta a tu ejecutivo para hacer el ajuste antes del despacho." },
    ],
  },
  {
    cat: "Liberación de Pedidos",
    items: [
      { q: "¿Cómo se libera un pedido?", a: "La liberación la realiza el área de Operaciones de ENERED una vez confirmados los datos del despacho y la disponibilidad en el terminal asignado." },
      { q: "¿Cuánto demora la liberación?", a: "Habitualmente entre 30 minutos y 2 horas dependiendo del terminal y la hora del día. Consulta los horarios oficiales de cada terminal en la tabla de la derecha." },
    ],
  },
  {
    cat: "Programación",
    items: [
      { q: "¿Cómo programo un despacho?", a: "Accede al módulo Programación o contáctanos por WhatsApp para coordinar fecha, terminal y placa del vehículo. Te confirmaremos por correo." },
    ],
  },
  {
    cat: "Estado de cuenta",
    items: [
      { q: "¿Dónde puedo ver mi estado de cuenta?", a: "En el módulo \"Estado de Cuenta\" del menú lateral. Verás tu línea de crédito disponible, utilizada, notas de despacho y total facturado en tiempo real." },
      { q: "¿Cómo descargo mis facturas?", a: "Desde \"Estado de Cuenta\" → \"Consulta tu historial\" puedes filtrar por fecha, estado y descargar los documentos en PDF y XML individualmente o exportar todo en Excel/PDF." },
      { q: "¿Qué significa el % de línea utilizada?", a: "Es la proporción de tu línea de crédito que ya está comprometida (facturas pendientes + vencidas + notas de despacho) sobre el total asignado." },
    ],
  },
];

const openWhatsApp = (msg = "Hola ENERED, necesito ayuda.") => {
  window.open(`${WA_LINK_BASE}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
};

export default function Soporte() {
  const [search, setSearch] = useState("");
  const [openCat, setOpenCat] = useState({});

  const toggleCat = (cat) => setOpenCat((o) => ({ ...o, [cat]: !o[cat] }));

  // Filtrar FAQ por búsqueda
  const filteredFAQ = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ
      .map((c) => ({
        ...c,
        items: c.items.filter((it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [search]);

  return (
    <div className="space-y-6 p-6 max-w-[1500px] mx-auto">
      {/* Título */}
      <h1 className="font-cabinet font-black text-[32px] text-brand leading-tight">
        Te damos la bienvenida al Centro de Ayuda
      </h1>

      {/* 4 cards con imágenes (botones a WhatsApp) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="support-help-cards">
        {HELP_CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => openWhatsApp(c.waMsg)}
            className="group relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1"
            data-testid={`support-card-${c.key}`}
          >
            <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-200">
              <img
                src={c.img}
                alt={c.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 px-4 py-3" style={{ background: "#1E1B4B" }}>
              <span className="block text-white font-cabinet font-bold text-base text-center">
                {c.title}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Tarjeta morada de contacto a todo el ancho (estilo mockup) */}
      <button
        onClick={() => openWhatsApp("Hola ENERED, necesito ayuda.")}
        className="w-full rounded-[28px] p-8 md:p-10 text-white shadow-md hover:shadow-2xl transition-all text-left relative overflow-hidden"
        style={{ background: "#7C3AED" }}
        data-testid="support-contact-card"
      >
        {/* Decoración líneas de fondo (curvas tipo mockup) */}
        <svg
          className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none"
          width="220" height="220" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M20 110 C 20 60, 60 20, 110 20" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M40 130 C 40 80, 80 40, 130 40" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M30 200 C 60 200, 90 170, 90 140" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M10 200 C 50 200, 90 160, 90 110" stroke="white" strokeWidth="2" fill="none"/>
        </svg>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 md:pl-32">
          {/* WhatsApp */}
          <div className="flex items-center gap-5 md:border-r md:border-white/30 md:pr-6">
            <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-12 h-12 md:w-14 md:h-14 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.92.5 3.78 1.45 5.43L2 22l4.83-1.27a9.85 9.85 0 0 0 5.21 1.43h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.13a8.16 8.16 0 0 1-4.16-1.14l-.3-.18-3.06.8.82-2.98-.2-.31a8.13 8.13 0 0 1-1.25-4.41c0-4.5 3.66-8.16 8.16-8.16 4.5 0 8.16 3.66 8.16 8.16 0 4.5-3.66 8.16-8.16 8.16zm4.48-6.11c-.25-.13-1.46-.72-1.69-.8-.23-.08-.39-.13-.55.13-.16.25-.63.8-.78.96-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.12-.11.25-.29.38-.43.13-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.13-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.43-.14-.01-.31-.01-.47-.01-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03 0 1.2.87 2.36.99 2.52.13.16 1.71 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.18 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.16-.46-.29z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-cabinet font-semibold text-lg md:text-xl leading-tight">A nuestro</p>
              <p className="font-cabinet font-bold text-xl md:text-2xl leading-tight">Whatsapp oficial</p>
              <p className="font-extrabold text-xl md:text-2xl mt-2" style={{ color: "#22D3EE" }}>+51 972 228 870</p>
            </div>
          </div>

          {/* Correo */}
          <a
            href={`mailto:${EMAIL_COMERCIAL}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-5 hover:opacity-95"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-12 h-12 md:w-14 md:h-14 text-white" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="font-cabinet font-semibold text-lg md:text-xl leading-tight">A nuestro</p>
              <p className="font-cabinet font-bold text-xl md:text-2xl leading-tight">Correo Corporativo</p>
              <p className="font-extrabold text-lg md:text-xl mt-2 break-all" style={{ color: "#22D3EE" }}>{EMAIL_COMERCIAL}</p>
            </div>
          </a>
        </div>

        <div className="relative mt-8 pt-6 border-t border-white/25 md:pl-32">
          <p className="text-sm md:text-base leading-relaxed">
            Para reportar un problema, por favor comunicarse al siguiente correo:{" "}
            <a href={`mailto:${EMAIL_SOPORTE}`} onClick={(e) => e.stopPropagation()} className="font-bold underline hover:opacity-80">{EMAIL_SOPORTE}</a>{" "}
            o llama al número:{" "}
            <a href="tel:+5101203-7300" onClick={(e) => e.stopPropagation()} className="font-bold underline hover:opacity-80">(01) 203-7300</a>,{" "}
            <a href="tel:+51996207533" onClick={(e) => e.stopPropagation()} className="font-bold underline hover:opacity-80">996 207 533</a>
          </p>
        </div>
      </button>

      {/* FAQ con buscador y acordeón */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="relative max-w-2xl mx-auto mb-6">
          <input
            type="text"
            placeholder="Buscar una pregunta frecuente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-5 pr-12 border-2 border-neutral-200 rounded-full text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
            data-testid="support-faq-search"
          />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
        </div>

        <div className="space-y-2 max-w-3xl mx-auto" data-testid="support-faq-list">
          {filteredFAQ.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 py-8">No se encontraron preguntas que coincidan con tu búsqueda.</p>
          ) : (
            filteredFAQ.map((cat) => {
              const isOpen = openCat[cat.cat];
              return (
                <div key={cat.cat} className="border-b border-neutral-100 last:border-0">
                  <button
                    onClick={() => toggleCat(cat.cat)}
                    className="w-full flex items-center justify-between py-4 text-left hover:bg-brand/5 px-3 rounded-md transition-colors"
                    data-testid={`support-faq-cat-${cat.cat}`}
                  >
                    <span className="font-cabinet font-bold text-lg text-brand">{cat.cat}</span>
                    <ChevronDown className={`w-5 h-5 text-brand transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="pb-4 px-3 space-y-3">
                      {cat.items.map((it, idx) => (
                        <FAQItem key={idx} q={it.q} a={it.a} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Botón flotante WhatsApp */}
      <button
        onClick={() => openWhatsApp()}
        title="Chatea por WhatsApp"
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full shadow-xl hover:scale-110 transition-transform flex items-center justify-center"
        style={{ background: "#25D366" }}
        data-testid="support-wa-fab"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.92.5 3.78 1.45 5.43L2 22l4.83-1.27a9.85 9.85 0 0 0 5.21 1.43h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.13a8.16 8.16 0 0 1-4.16-1.14l-.3-.18-3.06.8.82-2.98-.2-.31a8.13 8.13 0 0 1-1.25-4.41c0-4.5 3.66-8.16 8.16-8.16 4.5 0 8.16 3.66 8.16 8.16 0 4.5-3.66 8.16-8.16 8.16zm4.48-6.11c-.25-.13-1.46-.72-1.69-.8-.23-.08-.39-.13-.55.13-.16.25-.63.8-.78.96-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.12-.11.25-.29.38-.43.13-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.13-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.43-.14-.01-.31-.01-.47-.01-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03 0 1.2.87 2.36.99 2.52.13.16 1.71 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.18 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.16-.46-.29z"/>
        </svg>
      </button>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md overflow-hidden border border-neutral-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
      >
        <span className="text-sm font-semibold text-neutral-800 flex-1">{q}</span>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 py-3 text-sm text-neutral-700 bg-white border-t border-neutral-100 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}
