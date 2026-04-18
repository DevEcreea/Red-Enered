import React from "react";
import { Phone, Mail, MessageCircle, User, Clock, MapPin } from "lucide-react";

const CONTACTS = [
  { nombre: "María Torres", cargo: "Ejecutiva de Cuenta Principal", telefono: "+51 987 654 321", correo: "maria.torres@enered.com", whatsapp: "51987654321" },
  { nombre: "Carlos Mendoza", cargo: "Soporte Técnico", telefono: "+51 987 111 222", correo: "carlos.mendoza@enered.com", whatsapp: "51987111222" },
  { nombre: "Paola Ríos", cargo: "Facturación y Contabilidad", telefono: "+51 987 333 444", correo: "paola.rios@enered.com", whatsapp: "51987333444" },
];

export default function Soporte() {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Estamos para ayudarte</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Soporte</h1>
        <p className="text-neutral-500 mt-1 text-sm">Contacta directamente con nuestro equipo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="chart-card flex items-start gap-3 bg-brand-50 border-brand-100">
          <Clock className="w-5 h-5 text-brand mt-0.5" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand mb-1">Horario</div>
            <div className="text-sm font-bold">Lun a Vie · 08:00 a 18:00</div>
            <div className="text-xs text-neutral-500 mt-1">Sábados · 08:00 a 13:00</div>
          </div>
        </div>
        <div className="chart-card flex items-start gap-3">
          <MapPin className="w-5 h-5 text-brand mt-0.5" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Oficina</div>
            <div className="text-sm font-bold">Av. El Derby 250, Santiago de Surco</div>
            <div className="text-xs text-neutral-500 mt-1">Lima, Perú</div>
          </div>
        </div>
        <div className="chart-card flex items-start gap-3">
          <Mail className="w-5 h-5 text-brand mt-0.5" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Central</div>
            <div className="text-sm font-bold">contacto@enered.com</div>
            <div className="text-xs text-neutral-500 mt-1">+51 (1) 700-0000</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CONTACTS.map((c, i) => (
          <div key={i} className="chart-card" data-testid="support-contact">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center">
                <User className="w-6 h-6 text-brand" />
              </div>
              <div>
                <div className="font-cabinet font-bold text-lg text-neutral-900 leading-tight">{c.nombre}</div>
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mt-1">{c.cargo}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-neutral-700"><Phone className="w-4 h-4 text-neutral-400" /> {c.telefono}</div>
              <div className="flex items-center gap-2 text-neutral-700"><Mail className="w-4 h-4 text-neutral-400" /> <a href={`mailto:${c.correo}`} className="hover:text-brand">{c.correo}</a></div>
            </div>
            <a
              href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent("Hola, tengo una consulta sobre la plataforma ENERED")}`}
              target="_blank" rel="noreferrer"
              className="mt-4 w-full bg-[#25D366] hover:bg-[#1EBE5B] text-white font-bold rounded-md px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
              data-testid="support-whatsapp-btn"
            >
              <MessageCircle className="w-4 h-4" /> Escribir por WhatsApp
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
