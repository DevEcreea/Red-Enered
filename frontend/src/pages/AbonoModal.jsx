import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

/**
 * Modal para registrar un abono / comprobante de pago.
 * Props:
 *   open      — boolean que controla visibilidad
 *   onClose   — callback para cerrar
 *   onSuccess — callback tras registro exitoso (para refrescar estado de cuenta)
 */
export function AbonoModal({ open, onClose, onSuccess }) {
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [nroOp, setNroOp] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Limpiar campos al cerrar
  const handleClose = () => {
    setMonto("");
    setFecha("");
    setNroOp("");
    setFile(null);
    onClose();
  };

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!monto || !fecha || !nroOp || !file) {
      toast.error("Por favor completa todos los campos y sube el voucher.");
      return;
    }
    if (parseFloat(monto) <= 0) {
      toast.error("El monto debe ser mayor a cero.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("monto", monto);
      fd.append("fecha_deposito", fecha);
      fd.append("numero_operacion", nroOp);
      fd.append("file", file);

      await api.post("/abonos", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Abono registrado correctamente. En breve será validado.");
      onSuccess && onSuccess();
      handleClose();
    } catch (err) {
      toast.error(
        "Error al registrar el abono: " +
          (err.response?.data?.detail || err.message)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-neutral-100">
          <h3 className="font-cabinet font-bold text-lg text-brand">
            Registrar un Abono
          </h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Monto */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">
              Monto depositado (S/)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
              placeholder="0.00"
            />
          </div>

          {/* Fecha + Nro. Operación */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Fecha de pago
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Nro. de Operación
              </label>
              <input
                type="text"
                required
                value={nroOp}
                onChange={(e) => setNroOp(e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                placeholder="Ej. 1234567"
              />
            </div>
          </div>

          {/* Voucher */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">
              Voucher de Pago (PDF, JPG, PNG)
            </label>
            <input
              type="file"
              required
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 outline-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full mt-2 h-11 bg-brand text-white rounded-xl font-bold hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando…
              </>
            ) : (
              "Registrar Abono"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AbonoModal;
