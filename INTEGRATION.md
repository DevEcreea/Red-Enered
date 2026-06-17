# Integración Calculadora ↔ Plataforma Red-Enered

Este archivo describe cómo conectar el repo **`calculadoraEnered`** con la plataforma **`Red-Enered`** (este repo).

## Arquitectura

```
[calculadoraEnered]  --POST /api/calculations-->  [Backend FastAPI]
       |                                                  ^
       |  redirect ?calc_id=XXX                            |
       v                                                   |
[Red-Enered frontend]  ---/auth/register-from-calculator-->
```

- **calculadoraEnered** (repo separado): es la entrada pública. Solo calcula.
- **Red-Enered frontend** (este repo): login, registro, dashboard cliente_subsidio.
- **Backend FastAPI** (también en este repo, carpeta `/backend`): sirve a ambos.

---

## Cambios a hacer en el repo `calculadoraEnered`

### 1) Variables de entorno

Crea archivo `.env` en la raíz del repo `calculadoraEnered`:

```bash
# Producción (Netlify)
REACT_APP_API_URL=https://api.enered.pe
REACT_APP_PLATAFORMA_URL=https://app.enered.pe
```

Y `.env.development` para local:
```bash
REACT_APP_API_URL=http://localhost:8001
REACT_APP_PLATAFORMA_URL=http://localhost:3001
```

### 2) Instalar axios

```bash
yarn add axios
```

### 3) Modificar `src/pages/Calculator.jsx`

Importa axios al inicio del archivo:

```javascript
import axios from "axios";
```

Agrega esta función dentro del componente `Calculator`:

```javascript
const [submitting, setSubmitting] = useState(false);

async function handleEmpezarRegistro({ califica, rows, computed }) {
  setSubmitting(true);
  try {
    const { data } = await axios.post(
      `${process.env.REACT_APP_API_URL}/api/calculations`,
      {
        califica,                                    // boolean
        categorias: rows.map(r => ({
          code: r.code,                              // "M2"|"M3"|"N1"|"N2"|"N3"
          cantidad: Number(r.cantidad),
          galones_mensuales: Number(r.galones_mensuales),
        })),
        total_galones_mensuales: rows.reduce(
          (a, r) => a + Number(r.cantidad) * Number(r.galones_mensuales),
          0
        ),
        subsidio_estimado: computed.subsidio_estimado,
        detalle: computed,                           // objeto computed completo
        canal_origen: "calculadora",
      }
    );

    const plataforma = process.env.REACT_APP_PLATAFORMA_URL;
    if (califica) {
      window.location.href = `${plataforma}/register?calc_id=${data.calc_id}`;
    } else {
      window.location.href = `${plataforma}/no-califica?calc_id=${data.calc_id}`;
    }
  } catch (err) {
    console.error("No se pudo guardar el cálculo", err);
    alert("Hubo un problema al guardar tu cálculo. Inténtalo de nuevo.");
    setSubmitting(false);
  }
}
```

Y en el botón final de la pantalla de resultado, reemplaza el handler:

```jsx
<button
  onClick={() => handleEmpezarRegistro({ califica, rows, computed })}
  disabled={submitting}
>
  {submitting ? "Guardando..." : (califica ? "Empezar mi registro" : "Ver servicios de ahorro")}
</button>
```

---

## Estructura del payload aceptado por el backend

Endpoint: `POST /api/calculations` (público, sin auth)

```json
{
  "califica": true,
  "categorias": [
    { "code": "N2", "cantidad": 12, "galones_mensuales": 280 }
  ],
  "total_galones_mensuales": 3360,
  "subsidio_estimado": 26880,
  "detalle": { /* tu objeto computed entero */ },
  "canal_origen": "calculadora"
}
```

Respuesta:
```json
{
  "calc_id": "uuid-...",
  "subsidio_estimado": 26880,
  "califica": true,
  "created_at": "2026-01-15T..."
}
```

---

## Deploy

| Proyecto | Plataforma | Variables de entorno requeridas |
|---|---|---|
| `calculadoraEnered` | Netlify · calc.enered.pe | `REACT_APP_API_URL`, `REACT_APP_PLATAFORMA_URL` |
| `Red-Enered` (este repo, frontend) | Netlify · app.enered.pe | `REACT_APP_BACKEND_URL`, `REACT_APP_GOOGLE_CLIENT_ID`, `REACT_APP_CALCULADORA_URL` |
| Backend (este repo, /backend) | Render · api.enered.pe | `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CORS_ORIGINS=https://calc.enered.pe,https://app.enered.pe` |

En Google Cloud Console, agrega como **Authorized JavaScript origins**:
- `https://calc.enered.pe`
- `https://app.enered.pe`
- (mantén también `http://localhost:3000` para dev)
