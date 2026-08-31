import React, { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import { formatNumber } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./ui/hover-card";

const TARGET_DATE = new Date("2026-09-28T23:59:59");

const badges = {
  doc: <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v4h4M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  gov: <svg viewBox="0 0 24 24" fill="none"><path d="M4 20h16M5 20V9l7-4 7 4v11M8 20v-6h3v6M13 20v-6h3v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ok: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12l3 3 5-5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  no: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
};

const arrow = <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 ml-1"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export default function TrackerSubsidio() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const pad = (num) => String(num).padStart(2, '0');

  useEffect(() => {
    api.get("/subsidio/dashboard-data")
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const diff = TARGET_DATE.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="h-[140px] flex items-center justify-center bg-white rounded-2xl border border-neutral-200 animate-pulse" />;
  }

  if (!data) return null;

  const { stages = [], kpis = {} } = data;
  
  // Mapping the backend stages to the tracker state
  let currentState = "revision";
  let resStatus = null; // 'ok', 'no', 'obs'
  
  const stageMap = {};
  stages.forEach(s => stageMap[s.key] = s);
  
  if (stageMap.abonado_en_cuenta?.status === "done" || stageMap.abonado_en_cuenta?.status === "current") {
    currentState = "abonado";
  } else if (stageMap.aprobada?.status === "done" || stageMap.aprobada?.status === "current") {
    currentState = "aprobado";
    resStatus = "ok";
  } else if (stageMap.evaluacion_atu?.status === "done" || stageMap.evaluacion_atu?.status === "current") {
    currentState = "atu";
  }

  // Actual amounts based on backend KPIs
  const galones = kpis.galones_reconocidos ?? 0;
  const monto = kpis.gasto_total ? (galones * 4) : 0; 
  const formattedMonto = `S/ ${formatNumber(monto, 0)}`;
  const formattedGalones = `${formatNumber(galones, 0)} gal`;
  const pctAhorro = kpis.gasto_total > 0 ? ((monto / kpis.gasto_total) * 100).toFixed(1) : "0.0";

  const STATES = {
    revision: {
      current: 0, fill: 0, done: [],
      amtLbl: 'Subsidio en proceso', amtVal: formattedMonto, amtSub: `${formattedGalones} · 1 solicitud`,
      saveVal: formattedMonto, dlLabel: 'Cierre solicitud', dlClock: `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`,
      badge: 'doc', pill: ['bg-violet-50 text-violet-600', 'En curso'],
      title: 'Revisión interna',
      copy: 'Estamos validando tus comprobantes y el expediente completo. Nos aseguramos de que todo esté perfecto <b>antes</b> de presentarlo a la ATU, para que no te rebote.',
      cta: ['ghost', 'Ver checklist de validación', false],
      isCountdown: true
    },
    atu: {
      current: 1, fill: 33, done: [0],
      amtLbl: 'Subsidio solicitado', amtVal: formattedMonto, amtSub: 'Expediente presentado',
      saveVal: formattedMonto, dlLabel: 'Evaluación ATU', dlClock: '≈ 15 días háb.',
      badge: 'gov', pill: ['bg-violet-50 text-violet-600', 'En evaluación'],
      title: 'Trámite en ATU',
      copy: 'Tu expediente ya ingresó a la ATU y está en <b>evaluación oficial del Estado</b>. No necesitas hacer nada: te avisamos apenas haya una resolución.',
      cta: ['ghost', 'Ver cargo de ingreso', false]
    },
    aprobado: {
      current: 2, fill: 66, done: [0, 1], res: 'ok', resMicro: 'Solicitud aprobada',
      amtLbl: 'Subsidio reconocido', amtVal: formattedMonto, amtSub: 'Monto aprobado por la ATU',
      saveVal: formattedMonto, dlLabel: 'Abono estimado', dlClock: '≈ 5 días háb.',
      panelClass: 'border-[#BFEBD8] bg-gradient-to-b from-[#F5FCF9] to-white', badge: 'ok', pill: ['bg-teal-50 text-emerald-700', 'Aprobado'],
      title: '¡Resolución favorable!',
      copy: 'La ATU <b>aprobó</b> tu solicitud. Tu subsidio quedó reconocido y ya está en cola para el abono a tu cuenta.',
      cta: ['solid', 'Descargar resolución', true]
    },
    abonado: {
      current: 3, fill: 100, done: [0, 1, 2],
      amtLbl: 'Subsidio abonado', amtVal: formattedMonto, amtSub: 'Depositado en tu cuenta',
      saveVal: formattedMonto, dlLabel: 'Completado', dlClock: '✓ Finalizado',
      panelClass: 'border-[#BFEBD8] bg-gradient-to-b from-[#F5FCF9] to-white', badge: 'ok', pill: ['bg-teal-50 text-emerald-700', 'Abonado'],
      title: '¡Dinero en tu cuenta!',
      copy: 'El subsidio ya fue <b>abonado a tu cuenta</b>. Proceso completado con éxito. Este es el ahorro real que ENERED gestionó por ti.',
      cta: ['solid', 'Ver constancia de abono', true]
    }
  };

  const s = STATES[currentState];

  return (
    <div className="mb-6">
      {/* Tracker Bar */}
      <div className="relative overflow-hidden rounded-[20px] shadow-[0_18px_40px_-22px_rgba(45,18,110,0.45)] bg-gradient-to-r from-[#8039F4] via-[#6D28D9] to-[#5B21B6] p-[22px_26px] grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-[30px] items-center">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(600px 200px at 12% 0%,rgba(255,255,255,.14),transparent 60%)' }} />
        
        {/* Amount */}
        <div className="flex items-center gap-[13px] relative z-10 min-w-[190px]">
          <div className="w-[46px] h-[46px] rounded-[14px] flex-none grid place-items-center bg-white/10 border border-white/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.8"/><path d="M14.5 9.2c-.5-.9-1.5-1.4-2.5-1.4-1.4 0-2.6 1-2.6 2.2s1.2 1.7 2.6 2 2.6.8 2.6 2-1.2 2.2-2.6 2.2c-1 0-2-.5-2.5-1.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 6.4v11.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-white/70">{s.amtLbl}</div>
            <div className="font-cabinet text-[27px] font-black text-white leading-[1.05] mt-[3px]">{s.amtVal}</div>
            <div className="text-[11.5px] text-white/60 mt-[2px]">{s.amtSub}</div>
          </div>
        </div>

        {/* Steps */}
        <div className="relative z-10 grid grid-cols-4 hidden sm:grid">
          {[
            { step: 0, name: 'Revisión interna', micro: 'Validando tu expediente' },
            { step: 1, name: 'Trámite en ATU', micro: 'En manos del Estado' },
            { step: 2, name: 'Resolución', micro: s.resMicro || 'Veredicto de la ATU' },
            { step: 3, name: 'Abonado', micro: 'Dinero en tu cuenta' }
          ].map((st, i) => {
            const isDone = s.done.includes(i);
            const isCurrent = s.current === i;
            let nodeClass = "w-[38px] h-[38px] rounded-full grid place-items-center bg-white/10 border-2 border-white/30 text-white/70 relative transition-all duration-300 flex-none mx-auto";
            let nameClass = "mt-[9px] text-[12.5px] font-bold text-white/60 transition-all duration-300 text-center";
            let microClass = "mt-[1px] text-[10.5px] font-medium text-white/40 transition-all duration-300 text-center hidden md:block";
            
            if (isDone) {
              nodeClass = "w-[38px] h-[38px] rounded-full grid place-items-center bg-white border-2 border-white text-violet-600 relative transition-all duration-300 flex-none mx-auto";
              nameClass = "mt-[9px] text-[12.5px] font-bold text-white/80 transition-all duration-300 text-center";
            } else if (isCurrent) {
              if (s.res) {
                if (s.res === 'ok') nodeClass = "w-[38px] h-[38px] rounded-full grid place-items-center bg-emerald-500 border-2 border-emerald-500 text-white shadow-[0_0_0_6px_rgba(16,185,129,.28)] relative flex-none mx-auto";
                if (s.res === 'no') nodeClass = "w-[38px] h-[38px] rounded-full grid place-items-center bg-rose-500 border-2 border-rose-500 text-white shadow-[0_0_0_6px_rgba(244,63,94,.28)] relative flex-none mx-auto";
                if (s.res === 'obs') nodeClass = "w-[38px] h-[38px] rounded-full grid place-items-center bg-amber-500 border-2 border-amber-500 text-white shadow-[0_0_0_6px_rgba(245,158,11,.30)] relative flex-none mx-auto animate-pulse-obs";
              } else {
                nodeClass = "w-[38px] h-[38px] rounded-full grid place-items-center bg-white border-2 border-white text-violet-600 shadow-[0_0_0_6px_rgba(255,255,255,.22)] relative flex-none mx-auto before:content-[''] before:absolute before:inset-[-2px] before:rounded-full before:border-2 before:border-white before:animate-[pulseRing_1.8s_ease-out_infinite]";
              }
              nameClass = "mt-[9px] text-[12.5px] font-bold text-white transition-all duration-300 text-center";
              microClass = "mt-[1px] text-[10.5px] font-medium text-white/80 transition-all duration-300 text-center hidden md:block";
            }

            const stepKeys = ['revision', 'atu', 'aprobado', 'abonado'];
            const stepKey = stepKeys[i];
            const stepObj = STATES[stepKey];

            return (
              <div key={i} className="flex flex-col items-center px-1 relative">
                {/* Connecting Line Segment */}
                {i < 3 && (
                  <div className="absolute top-[17.5px] left-[calc(50%+19px)] w-[calc(100%-38px)] h-[3px] bg-white/20 z-0">
                    <div className="absolute top-0 left-0 h-full bg-white transition-all duration-500 ease-in-out" style={{ width: s.current > i ? '100%' : '0%' }} />
                  </div>
                )}
                
                {/* HoverCard removed */}
                    <div className={nodeClass}>
                      {isDone ? (
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        i === 0 ? <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M7.5 4h9a2 2 0 012 2v12a2 2 0 01-2 2h-9a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> :
                        i === 1 ? <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M4 20h16M6 20V8l6-4 6 4v12M9 20v-5h6v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> :
                        i === 2 && s.res === 'ok' ? <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg> :
                        i === 2 && s.res === 'no' ? <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg> :
                        i === 2 && s.res === 'obs' ? <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg> :
                        i === 2 ? <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M12 3v3M12 6a6 6 0 016 6c0 2-1 3.5-2 4.5-.6.6-1 1.3-1 2.2V19H9v-.3c0-.9-.4-1.6-1-2.2-1-1-2-2.5-2-4.5a6 6 0 016-6zM9.5 21h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> :
                        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none"><path d="M3 7h18v10H3zM3 10h18M7 14h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </div>
                <div className={nameClass}>{st.name}</div>
                <div className={microClass}>{st.micro}</div>
              </div>
            );
          })}
        </div>

        {/* Aside */}
        <div className="relative z-10 flex items-center justify-between md:justify-end gap-[18px]">
          <div className="text-right">
            <div className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-white/70">Ahorro</div>
            <div className="font-cabinet text-[22px] font-bold text-white mt-[2px]">{pctAhorro}%</div>
          </div>
          {s.isCountdown ? (
            <div className="bg-[#B91C1C] border border-red-500/25 rounded-[14px] p-[8px_16px] flex items-center shadow-[0_4px_20px_rgba(185,28,28,0.45)] text-white select-none">
              {/* Left Side: icon and deadline */}
              <div className="flex items-center gap-[6px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <span className="text-[11px] font-black tracking-wider uppercase">28 SEP</span>
              </div>
              
              {/* Divider */}
              <div className="w-[1.5px] h-[26px] bg-white/20 mx-3.5" />
              
              {/* Countdown Numbers */}
              <div className="flex items-center gap-[5px]">
                {/* Days */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none">{pad(timeLeft.days)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">D</span>
                </div>
                <span className="text-[14px] font-bold text-white/50 relative top-[-3px]">:</span>
                {/* Hours */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none">{pad(timeLeft.hours)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">H</span>
                </div>
                <span className="text-[14px] font-bold text-white/50 relative top-[-3px]">:</span>
                {/* Minutes */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none">{pad(timeLeft.minutes)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">M</span>
                </div>
                <span className="text-[14px] font-bold text-white/50 relative top-[-3px]">:</span>
                {/* Seconds */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none text-rose-300 animate-pulse">{pad(timeLeft.seconds)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">S</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 border border-white/20 rounded-[13px] p-[9px_13px] text-center min-w-[118px]">
              <div className="flex items-center justify-center gap-[5px] text-[10.5px] font-bold text-white/80 tracking-[0.04em]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="#fff" strokeWidth="1.8"/><path d="M12 9v4l2.5 2M9 3h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                <span>{s.dlLabel}</span>
              </div>
              <div className="font-cabinet text-[17px] font-bold text-white mt-[3px] tracking-[0.02em]">{s.dlClock}</div>
              <div className="text-[9px] font-bold tracking-[0.16em] text-white/50 mt-[1px]">28 SEP</div>
            </div>
          )}
        </div>
      </div>



      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseRing { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(1.55); opacity: 0 } }
      `}} />
    </div>
  );
}
