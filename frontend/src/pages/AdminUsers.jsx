import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatApiError, ROLE_LABEL, formatDate } from "../lib/utils";
import { Plus, Trash2, Pencil, X, Users as UsersIcon } from "lucide-react";
import { MODULOS } from "../lib/modulos";

const EMPTY_FORM = { email: "", password: "", name: "", role: "administrador", empresa: "", permisos: null };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([api.get("/users"), api.get("/empresas")]);
        setUsers(a.data);
        setEmpresas(b.data);
      } catch (err) {
        console.error("Error loading AdminUsers:", err);
      }
    })();
  }, []);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/users"), api.get("/empresas")]);
      setUsers(a.data); setEmpresas(b.data);
    } catch (err) {
      console.error("Error loading AdminUsers data:", err);
    }
  };

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      // permisos solo aplica a admin_enered; null = acceso total (super-admin)
      const permisos = form.role === "admin_enered" ? form.permisos : null;
      if (edit) {
        const patch = { name: form.name, role: form.role, empresa: form.empresa || null, permisos };
        if (form.password) patch.password = form.password;
        await api.put(`/users/${edit.id}`, patch);
      } else {
        await api.post("/users", { ...form, empresa: form.empresa || null, permisos });
      }
      setShowForm(false); setEdit(null); setForm({ ...EMPTY_FORM });
      load();
    } catch (e2) { setErr(formatApiError(e2.response?.data?.detail)); }
  };

  const openEdit = (u) => {
    setEdit(u); setShowForm(true);
    setForm({ email: u.email, password: "", name: u.name, role: u.role, empresa: u.empresa || "", permisos: u.permisos ?? null });
  };

  const remove = async (u) => {
    if (!window.confirm(`Eliminar usuario ${u.email}?`)) return;
    await api.delete(`/users/${u.id}`); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Administración</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Usuarios</h1>
          <p className="text-neutral-500 mt-1 text-sm">Gestiona accesos, roles y empresas.</p>
        </div>
        <button onClick={() => { setEdit(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }} className="btn-brand text-sm flex items-center gap-2" data-testid="user-new-btn">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-cabinet font-bold text-lg">{edit ? "Editar" : "Nuevo"} usuario</h3>
            <button onClick={() => { setShowForm(false); setEdit(null); }} className="p-1 hover:bg-neutral-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input required type="email" disabled={!!edit} placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm disabled:bg-neutral-50" />
            <input required={!edit} type="password" placeholder={edit ? "Nueva contraseña (opcional)" : "Contraseña"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <input required placeholder="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm">
              <option value="admin_enered">Admin ENERED</option>
              <option value="administrador">Administrador</option>
              <option value="logistica">Logística</option>
              <option value="contabilidad">Contabilidad</option>
            </select>
            <select value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm md:col-span-2">
              <option value="">— Sin empresa (Admin ENERED) —</option>
              {empresas.map((e) => <option key={e}>{e}</option>)}
            </select>

            {form.role === "admin_enered" && (
              <div className="md:col-span-2 border-t border-border pt-3 mt-1">
                <div className="text-xs font-bold text-neutral-600 uppercase tracking-wide mb-2">Acceso a módulos (equipo ENERED)</div>
                <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.permisos == null}
                    onChange={(e) => setForm({ ...form, permisos: e.target.checked ? null : [] })}
                    className="accent-brand w-4 h-4" data-testid="perm-acceso-total" />
                  <span className="font-medium">Acceso total (super-admin)</span>
                </label>
                {form.permisos != null && (
                  <div className="bg-neutral-50 border border-border rounded-lg p-3 space-y-3">
                    {["operacion", "admin"].map((grupo) => (
                      <div key={grupo}>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">
                          {grupo === "operacion" ? "Operación" : "Administración"}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                          {MODULOS.filter((m) => m.grupo === grupo).map((m) => (
                            <label key={m.key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                              <input type="checkbox"
                                checked={(form.permisos || []).includes(m.key)}
                                onChange={() => setForm((f) => ({
                                  ...f,
                                  permisos: (f.permisos || []).includes(m.key)
                                    ? f.permisos.filter((k) => k !== m.key)
                                    : [...(f.permisos || []), m.key],
                                }))}
                                className="accent-brand w-3.5 h-3.5" />
                              {m.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {err && <div className="md:col-span-2 text-red-600 text-sm">{err}</div>}
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="btn-brand text-sm">{edit ? "Guardar" : "Crear"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEdit(null); }} className="btn-ghost text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="enered-table" data-testid="users-table">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Empresa</th><th>Creado</th><th className="text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {users.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-neutral-500"><UsersIcon className="w-10 h-10 text-neutral-300 mx-auto mb-2" /> Sin usuarios</td></tr>
                : users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-bold">{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className="text-xs font-bold px-2 py-1 bg-brand-50 text-brand rounded-full border border-brand-100">{ROLE_LABEL[u.role]}</span></td>
                    <td>{u.empresa || <span className="text-neutral-400">—</span>}</td>
                    <td className="text-xs">{formatDate(u.created_at)}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(u)} className="p-2 hover:bg-brand-50 text-brand rounded-md"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(u)} className="p-2 hover:bg-red-50 text-red-600 rounded-md"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
