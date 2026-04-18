import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatApiError, formatDate } from "../lib/utils";
import { GraduationCap, PlayCircle, CheckCircle2, Download, Plus, Trash2, Award } from "lucide-react";
import jsPDF from "jspdf";

export default function Capacitacion() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/courses"), api.get("/courses/results/me")]);
    setCourses(a.data); setResults(b.data);
  };
  useEffect(() => { load(); }, []);

  const startCourse = (c) => { setActive(c); setAnswers(new Array(c.preguntas?.length || 0).fill(-1)); setScore(null); };

  const submit = async () => {
    const { data } = await api.post(`/courses/${active.id}/submit`, { respuestas: answers });
    setScore(data);
    load();
  };

  const downloadCert = (result, course) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(153, 51, 255); doc.rect(0, 0, 297, 25, "F");
    doc.setTextColor(255); doc.setFontSize(22); doc.text("ENERED", 15, 17);
    doc.setFontSize(11); doc.text("Certificado de Capacitación", 240, 17);
    doc.setTextColor(0);

    doc.setFontSize(36); doc.setFont(undefined, "bold");
    doc.text("CERTIFICADO", 148, 65, { align: "center" });
    doc.setFont(undefined, "normal"); doc.setFontSize(14);
    doc.text("Otorgado a", 148, 85, { align: "center" });
    doc.setFontSize(28); doc.setFont(undefined, "bold");
    doc.text(user.name || user.email, 148, 105, { align: "center" });
    doc.setFont(undefined, "normal"); doc.setFontSize(12);
    if (user.empresa) doc.text(`Empresa: ${user.empresa}`, 148, 118, { align: "center" });
    doc.setFontSize(14);
    doc.text("Por haber completado satisfactoriamente el curso", 148, 138, { align: "center" });
    doc.setFontSize(20); doc.setFont(undefined, "bold");
    doc.text(`"${course.titulo}"`, 148, 155, { align: "center" });
    doc.setFont(undefined, "normal"); doc.setFontSize(12);
    doc.text(`Con un puntaje de ${result.puntaje}%`, 148, 170, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Fecha: ${formatDate(result.created_at)}`, 148, 185, { align: "center" });

    doc.setDrawColor(153, 51, 255); doc.setLineWidth(0.8);
    doc.line(40, 205, 130, 205); doc.line(167, 205, 257, 205);
    doc.setFontSize(10); doc.text("ENERED — Dirección de Capacitación", 85, 212, { align: "center" });
    doc.text(user.name || "Participante", 212, 212, { align: "center" });

    doc.save(`Certificado_${course.titulo.replace(/\s+/g, "_")}.pdf`);
  };

  const isAdmin = user?.role === "admin_enered";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Academia ENERED</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Capacitación</h1>
          <p className="text-neutral-500 mt-1 text-sm">Cursos y certificaciones para tu equipo.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn-brand text-sm flex items-center gap-2" data-testid="course-new-btn">
            <Plus className="w-4 h-4" /> Nuevo curso
          </button>
        )}
      </div>

      {showForm && isAdmin && <NewCourseForm onClose={() => { setShowForm(false); load(); }} />}

      {active ? (
        <CoursePlayer course={active} answers={answers} setAnswers={setAnswers} onSubmit={submit} score={score}
          onClose={() => { setActive(null); setScore(null); }}
          onDownload={(r) => downloadCert(r, active)} onDelete={async () => {
            if (window.confirm("Eliminar curso?")) { await api.delete(`/courses/${active.id}`); setActive(null); load(); }
          }} isAdmin={isAdmin} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white border border-border rounded-lg text-neutral-500">
              <GraduationCap className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              Sin cursos disponibles.
            </div>
          ) : courses.map((c) => {
            const mine = results.filter((r) => r.course_id === c.id);
            const passed = mine.some((r) => r.aprobado);
            const latest = mine[0];
            return (
              <div key={c.id} className="chart-card hover:shadow-lg transition-shadow" data-testid="course-card">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-md bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-brand" />
                  </div>
                  <div className="flex-1">
                    <div className="font-cabinet font-bold text-lg text-neutral-900 leading-tight">{c.titulo}</div>
                    <div className="text-xs text-neutral-500 mt-1">{c.preguntas?.length || 0} preguntas · puntaje mínimo {c.puntaje_minimo}%</div>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 mb-4 line-clamp-3">{c.descripcion}</p>
                {passed && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-3">
                    <Award className="w-4 h-4" /> Aprobado · puntaje {latest.puntaje}%
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => startCourse(c)} className="btn-brand text-sm flex items-center gap-2" data-testid={`start-course-${c.id}`}>
                    <PlayCircle className="w-4 h-4" /> {passed ? "Repetir" : "Iniciar"}
                  </button>
                  {passed && latest && (
                    <button onClick={() => downloadCert(latest, c)} className="btn-ghost text-sm flex items-center gap-2" data-testid="download-cert">
                      <Download className="w-4 h-4" /> Certificado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CoursePlayer({ course, answers, setAnswers, onSubmit, score, onClose, onDownload, onDelete, isAdmin }) {
  return (
    <div className="bg-white border border-border rounded-lg p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onClose} className="text-sm text-neutral-500 hover:text-brand mb-2">← Volver</button>
          <h2 className="font-cabinet font-black text-2xl text-neutral-900">{course.titulo}</h2>
          <p className="text-neutral-600 mt-1">{course.descripcion}</p>
        </div>
        {isAdmin && <button onClick={onDelete} className="p-2 hover:bg-red-50 text-red-600 rounded-md"><Trash2 className="w-4 h-4" /></button>}
      </div>

      {course.video_url && (
        <div className="aspect-video w-full rounded-md overflow-hidden bg-black">
          <iframe src={course.video_url} title="video" className="w-full h-full" allowFullScreen />
        </div>
      )}

      {course.preguntas?.length > 0 && (
        <div>
          <h3 className="font-cabinet font-bold text-lg mb-4">Evaluación</h3>
          <div className="space-y-4">
            {course.preguntas.map((p, i) => (
              <div key={i} className="border border-border rounded-md p-4">
                <div className="font-bold text-sm text-neutral-900 mb-3">{i + 1}. {p.pregunta}</div>
                <div className="space-y-2">
                  {p.opciones.map((op, j) => (
                    <label key={j} className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${answers[i] === j ? "border-brand bg-brand-50" : "border-border hover:bg-neutral-50"}`}>
                      <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => { const a = [...answers]; a[i] = j; setAnswers(a); }}
                        className="accent-brand" />
                      <span className="text-sm">{op}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!score ? (
            <button onClick={onSubmit} disabled={answers.some((a) => a === -1)} className="btn-brand text-sm mt-4 disabled:opacity-50" data-testid="course-submit">
              Enviar evaluación
            </button>
          ) : (
            <div className={`mt-4 p-5 rounded-md border ${score.aprobado ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`} data-testid="course-result">
              <div className="flex items-center gap-2 font-bold text-lg">
                {score.aprobado ? <CheckCircle2 className="w-5 h-5" /> : <span>✗</span>}
                {score.aprobado ? "¡Aprobado!" : "No aprobado"} — Puntaje {score.puntaje}%
              </div>
              {score.aprobado && (
                <button onClick={() => onDownload(score)} className="btn-brand text-sm mt-3 flex items-center gap-2" data-testid="cert-download-btn">
                  <Download className="w-4 h-4" /> Descargar certificado
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewCourseForm({ onClose }) {
  const [form, setForm] = useState({ titulo: "", descripcion: "", video_url: "", puntaje_minimo: 70, preguntas: [] });
  const [err, setErr] = useState("");
  const addQ = () => setForm({ ...form, preguntas: [...form.preguntas, { pregunta: "", opciones: ["", "", ""], correcta: 0 }] });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post("/courses", form); onClose(); }
    catch (e2) { setErr(formatApiError(e2.response?.data?.detail)); }
  };
  return (
    <div className="bg-white border border-border rounded-lg p-6">
      <h3 className="font-cabinet font-bold text-lg mb-4">Nuevo curso</h3>
      <form onSubmit={submit} className="space-y-3">
        <input required placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full h-10 px-3 border border-border rounded-md text-sm" />
        <textarea required placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} className="w-full px-3 py-2 border border-border rounded-md text-sm" />
        <input placeholder="URL video (YouTube embed)" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className="w-full h-10 px-3 border border-border rounded-md text-sm" />
        <input type="number" placeholder="Puntaje mínimo" value={form.puntaje_minimo} onChange={(e) => setForm({ ...form, puntaje_minimo: parseInt(e.target.value) || 0 })} className="w-40 h-10 px-3 border border-border rounded-md text-sm" />

        {form.preguntas.map((q, i) => (
          <div key={i} className="border border-border rounded-md p-3 space-y-2">
            <input required placeholder={`Pregunta ${i + 1}`} value={q.pregunta}
              onChange={(e) => { const p = [...form.preguntas]; p[i].pregunta = e.target.value; setForm({ ...form, preguntas: p }); }}
              className="w-full h-9 px-2 border border-border rounded-md text-sm" />
            {q.opciones.map((op, j) => (
              <div key={j} className="flex items-center gap-2">
                <input type="radio" checked={q.correcta === j}
                  onChange={() => { const p = [...form.preguntas]; p[i].correcta = j; setForm({ ...form, preguntas: p }); }} className="accent-brand" />
                <input required placeholder={`Opción ${j + 1}`} value={op}
                  onChange={(e) => { const p = [...form.preguntas]; p[i].opciones[j] = e.target.value; setForm({ ...form, preguntas: p }); }}
                  className="flex-1 h-9 px-2 border border-border rounded-md text-sm" />
              </div>
            ))}
          </div>
        ))}
        <button type="button" onClick={addQ} className="btn-ghost text-sm">+ Agregar pregunta</button>

        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-brand text-sm">Crear curso</button>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
