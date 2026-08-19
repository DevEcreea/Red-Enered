/* ============================================================================
 * ENERED · Recolector de precios de Facilito (OSINERGMIN)
 * ----------------------------------------------------------------------------
 * Facilito usa un captcha INVISIBLE (reCAPTCHA v3) que tu propio navegador
 * resuelve solo. Este script corre DENTRO de tu sesión (tú ya eres humano para
 * el sitio), recorre todos los departamentos/provincias y descarga UN archivo
 * .json con todos los precios, que luego subes en ENERED → Precios → Importar.
 *
 * CÓMO USARLO
 *   1. Abre  https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp
 *   2. F12 → pestaña "Console"
 *   3. Pega TODO este archivo y presiona Enter
 *   4. Espera (unos minutos); al terminar descarga "facilito-precios.json"
 *   5. En ENERED, botón "Importar página Facilito" → sube ese .json
 *
 * Para limitar a ciertos departamentos, edita SOLO_DPTOS abajo (por código).
 * ========================================================================== */
(async () => {
  const ACTION = "https://www.facilito.gob.pe/facilito/actions/PreciosCombustibleAutomotorAction.do";
  const SITEKEY = "6Le5C4cfAAAAABbO98BHMzZKAUVimVJSzcKrbK03";
  const ACTION_NAME = "PreciosCombustibleAutomotorAction";

  // Deja [] para TODO Perú, o pon códigos, p.ej. ["130000","150000"] (La Libertad, Lima).
  const SOLO_DPTOS = [];

  const DPTOS = [
    ["10000","AMAZONAS"],["20000","ANCASH"],["30000","APURIMAC"],["40000","AREQUIPA"],
    ["50000","AYACUCHO"],["60000","CAJAMARCA"],["70000","CALLAO"],["80000","CUSCO"],
    ["90000","HUANCAVELICA"],["100000","HUANUCO"],["110000","ICA"],["120000","JUNIN"],
    ["130000","LA LIBERTAD"],["140000","LAMBAYEQUE"],["150000","LIMA"],["160000","LORETO"],
    ["170000","MADRE DE DIOS"],["180000","MOQUEGUA"],["190000","PASCO"],["200000","PIURA"],
    ["210000","PUNO"],["220000","SAN MARTIN"],["230000","TACNA"],["240000","TUMBES"],
    ["250000","UCAYALI"],
  ].filter(([c]) => !SOLO_DPTOS.length || SOLO_DPTOS.includes(c));

  const PRODUCTOS = [["40","DB5 S-50 UV"],["126","Gasohol Regular"],["127","Gasohol Premium"]];

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const token = () => new Promise((res, rej) => {
    try { grecaptcha.ready(() => grecaptcha.execute(SITEKEY, { action: ACTION_NAME }).then(res, rej)); }
    catch (e) { rej(e); }
  });

  async function pedir(params) {
    const tk = await token();
    const body = new URLSearchParams({ ...params, "g-recaptcha-response": tk, nameRedirectfile: "buscadorEESS" });
    const r = await fetch(ACTION, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    return new DOMParser().parseFromString(await r.text(), "text/html");
  }

  const opciones = (doc, name) => Array.from(doc.querySelectorAll(`select[name="${name}"] option`))
    .map((o) => ({ code: (o.value || "").trim(), name: (o.textContent || "").trim() }))
    .filter((o) => o.code && o.code !== "9999999" && !/seleccione/i.test(o.name));

  function filas(doc, dptoName, provName, combName) {
    const out = [];
    doc.querySelectorAll("#tblPreciosAutomotor tbody tr").forEach((tr) => {
      const th = tr.querySelector("th");
      const td = Array.from(tr.querySelectorAll("td")).map((x) => x.textContent.trim());
      if (td.length < 3) return;
      const distrito = th ? th.textContent.trim() : "";
      const [establecimiento, direccion, telefono, precioRaw] =
        td.length >= 4 ? td : ["", td[0], td[1], td[2]];
      const precio = parseFloat((precioRaw || "").replace(/[^\d.,]/g, "").replace(",", "."));
      if (!establecimiento || !(precio > 5 && precio < 100)) return;
      out.push({
        departamento: dptoName, provincia: provName, distrito,
        establecimiento, direccion, telefono: telefono === " " ? "" : telefono,
        precio_venta: precio, combustible: combName,
      });
    });
    return out;
  }

  const todos = [];
  let nProv = 0;
  console.log(`%c[ENERED] Recolectando ${DPTOS.length} departamento(s)…`, "color:#7C3AED;font-weight:bold");

  for (const [dcode, dname] of DPTOS) {
    let provs = [];
    try {
      const doc = await pedir({ method: "cambiarDepartamento", departamento: dcode, departamentoAux: dcode, provincia: "9999999", distrito: "9999999", producto: "40" });
      provs = opciones(doc, "provincia");
    } catch (e) { console.warn(`  ✖ ${dname}: no se pudo cargar (${e})`); continue; }
    if (!provs.length) { console.warn(`  ⚠ ${dname}: sin provincias`); continue; }

    for (const p of provs) {
      for (const [pcode, pname] of PRODUCTOS) {
        try {
          const doc = await pedir({ method: "cambiarProducto", departamento: dcode, departamentoAux: dcode, provincia: p.code, distrito: "9999999", producto: pcode });
          const rows = filas(doc, dname, p.name, pname);
          todos.push(...rows);
        } catch (e) { /* una combinación falló; seguimos */ }
        await dormir(350);
      }
      nProv++;
      console.log(`  ✔ ${dname} / ${p.name} — acumulado: ${todos.length} precios`);
    }
  }

  console.log(`%c[ENERED] Listo: ${todos.length} precios en ${nProv} provincias.`, "color:#0EA46B;font-weight:bold");
  const blob = new Blob([JSON.stringify(todos)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "facilito-precios.json";
  a.click();
  console.log("%c[ENERED] Se descargó facilito-precios.json — súbelo en ENERED → Precios → Importar.", "color:#7C3AED");
})();
