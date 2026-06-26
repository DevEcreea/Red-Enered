# 📐 Arquitectura del Proyecto Red-Enered

Este documento describe la arquitectura de software, el flujo de datos, el stack tecnológico y las herramientas utilizadas en la plataforma de gestión de subsidios de combustible **ENERED** (bajo el Decreto de Urgencia DU 004-2026).

---

## 🗺️ Vista General de la Arquitectura

La plataforma funciona bajo un modelo **decapitado (headless)** y distribuido, donde el frontend y el backend están completamente desacoplados y se comunican a través de una API RESTful protegida. Adicionalmente, se integra un subsistema de calculadora pública externa.

### Diagrama de Componentes y Flujo de Datos

```mermaid
graph TD
    subgraph Cliente ["Cliente / Navegador"]
        Calc[calculadoraEnered (React)]
        Front[Red-Enered Frontend (React)]
    end

    subgraph BackendServicio ["Servidor de Aplicaciones (Render)"]
        API[FastAPI Backend (Python)]
        OCR[Servicio Gemini Vision OCR]
    end

    subgraph BaseDatos ["Capa de Datos y Almacenamiento"]
        DB[(MongoDB Atlas)]
        R2[(Cloudflare R2 Bucket)]
        GSheets[Google Sheets API]
    end

    %% Flujos de Calculadora
    Calc -->|1. POST /api/calculations| API
    Calc -->|2. Redirección con ?calc_id| Front
    
    %% Flujos de Frontend a Backend
    Front -->|3. Registro / Login / JWT Cookies| API
    Front -->|4. Carga de Facturas / Docs| API
    Front -->|5. Consulta de Dashboard & BI| API
    
    %% Flujos del Backend a la Base de Datos y Almacenamiento
    API -->|Persistencia de datos| DB
    API -->|Subida de PDFs/QRs/Imágenes| R2
    API -->|Sincronización de Consumos| GSheets
    API -->|Extracción de Facturas| OCR
```

---

## 💻 Frontend (Capa de Presentación)

El frontend está desarrollado como una Single Page Application (SPA) responsiva y moderna enfocada en ofrecer un panel de control corporativo y flujos ágiles de registro.

### Stack Tecnológico Principal

*   **Framework**: [React 19](https://react.dev/)
*   **Enrutamiento**: [React Router Dom v7](https://reactrouter.com/) (manejo de rutas protegidas y dinámicas)
*   **Compilación y Configuración**: Create React App (CRA) optimizado mediante [CRACO](https://craco.js.org/) (`@craco/craco`) para personalización de PostCSS y Tailwind sin necesidad de hacer eject.
*   **Diseño y Estilos**:
    *   [Tailwind CSS (v3.4)](https://tailwindcss.com/) para diseño responsivo basado en clases de utilidad y variables CSS.
    *   [Radix UI](https://www.radix-ui.com/) para componentes primitivos accesibles e interactivos (Modales, Selects, Accordions, Tabs).
    *   Configuración estética inspirada en `shadcn/ui` usando utilidades como `class-variance-authority`, `clsx`, `tailwind-merge` y animaciones de `tailwindcss-animate`.
    *   [Lucide React](https://lucide.dev/) para el set de íconos.

### Estado y Formularios

*   **Gestión de Formularios**: [React Hook Form](https://react-hook-form.com/) para entrada interactiva optimizada y de alto rendimiento.
*   **Validación de Esquemas**: [Zod](https://zod.dev/) para validación rigurosa de datos en el cliente.
*   **Notificaciones**: [Sonner](https://sonar.dev/) para toasts flotantes premium y con soporte enriquecido.

### Visualización y Herramientas

*   **Gráficos / BI Analytics**: [Recharts](https://recharts.org/) para modelar datos históricos de consumo de combustible, ecodriving, emisiones de CO2 y analíticas de flotas en tiempo real.
*   **Lector / Generador de Documentos**:
    *   [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) para la generación de reportes y estados de cuenta en formato PDF directamente en el navegador del usuario.
    *   [SheetJS (xlsx)](https://sheetjs.com/) para el procesamiento e importación/exportación de archivos de Excel.
*   **Cliente HTTP**: [Axios](https://axios-http.com/) para la comunicación y consumo de APIs backend con interceptores.

---

## ⚙️ Backend (Capa de Lógica de Negocio)

El backend de ENERED está diseñado con un enfoque modular, eficiente y de alta concurrencia asíncrona.

### Stack Tecnológico Principal

*   **Framework API**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+). Provee validación automática mediante modelos [Pydantic v2](https://docs.pydantic.dev/) y documentación OpenAPI autogenerada interactiva (`/docs`).
*   **Servidor ASGI**: [Uvicorn](https://www.uvicorn.org/) para servir la aplicación con alto rendimiento y mínima latencia.
*   **Base de Datos NoSQL**: [MongoDB](https://www.mongodb.com/) gestionado con el driver oficial asíncrono [Motor](https://motor.readthedocs.io/).
*   **Seguridad y Autenticación**:
    *   [PyJWT](https://pyjwt.readthedocs.io/) para la generación y validación de tokens web (JWT).
    *   Mecanismo de cookies `HTTP-Only`, `Secure` y `SameSite=None` para almacenar los tokens `access_token` and `refresh_token`, reduciendo vulnerabilidades XSS.
    *   [bcrypt](https://pypi.org/project/bcrypt/) para hashing criptográfico de contraseñas de usuarios.

### Servicios e Integraciones de Inteligencia Artificial

1.  **Extracción Inteligente (OCR Invoice Service)**:
    *   Utiliza **Gemini 2.5 Flash** (a través de la API `emergentintegrations`) para analizar de forma semántica facturas de combustible de la SUNAT en formato JPG/PNG/PDF.
    *   Extrae datos de forma estructurada a través de un esquema JSON definido (RUC emisor, placa del vehículo, tipo de producto, galones, importe total, fecha, hora).
    *   Procesamiento de PDF a Imagen: Se integra con `pdf2image` (que requiere `poppler` del sistema) y `pdfplumber` para la manipulación y lectura de páginas.
2.  **Sincronización con Google Sheets API**:
    *   Conexión mediante `gspread` y `google-auth` para importar de manera automática los consumos de combustible reportados en plantillas de cálculo corporativas.
    *   Soporta credenciales por archivo local (`GOOGLE_SHEETS_CREDENTIALS_PATH`) o inyectadas dinámicamente como variables de entorno en formato JSON plano (`GOOGLE_SHEETS_CREDENTIALS_JSON`).

### Almacenamiento de Archivos (Storage Backend)

Provee una interfaz abstracta unificada (`backend/storage.py`) con dos implementaciones alternables:
*   **Cloudflare R2 (S3-Compatible)**: Usado en producción a través de [Boto3](https://aws.amazon.com/sdk-for-python/) (AWS SDK). Ofrece URLs firmadas temporalmente (presigned URLs) para descargas seguras y subidas directas.
*   **Local Storage Fallback**: Almacena archivos en la ruta local `/backend/uploads/` durante el desarrollo offline sin requerir acceso a internet.

---

## 🗄️ Modelo de Datos (Colecciones MongoDB)

Al ser MongoDB una base de datos documental libre de esquemas (schemaless), los esquemas de datos son impuestos en la capa de aplicación por FastAPI a través de Pydantic. Las principales colecciones utilizadas son:

| Colección | Propósito |
| :--- | :--- |
| `users` | Cuentas de usuario y perfiles con roles específicos (`admin_enered`, `administrador`, `logistica`, `contabilidad`, `cliente_subsidio`). |
| `calculations` | Simulaciones y estimaciones guardadas desde la calculadora pública de combustible. |
| `subsidio_leads` | Clientes prospectos o "leads" capturados para seguimiento en el flujo comercial. |
| `subsidio_vehicles` | Catálogo de vehículos registrados por clientes de subsidio (placas, marcas, capacidades). |
| `subsidio_documents` | Expedientes digitales (PDFs, imágenes de facturas, tarjetas de propiedad, DNI, vigencia de poder) indexados a nivel de R2/local. |
| `subsidio_bank_accounts` | Datos bancarios y Códigos de Cuenta Interbancarios (CCI) para la dispersión de reembolsos de subsidios. |
| `subsidio_declaraciones` | Declaraciones juradas digitales firmadas por los clientes que autorizan y validan su expediente legal. |
| `consumos_subsidio` | Registros de carga de combustible procesados a través del OCR o importados, en estados `draft` o `confirmed`. |
| `empresas_config` | Configuraciones y límites operacionales parametrizados para cada empresa cliente. |

---

## 🚀 Despliegue e Infraestructura

El entorno de producción está completamente automatizado a través de infraestructura en la nube sin servidor (Serverless / PaaS):

*   **Frontend**: Alojado en **Netlify** (configurado en `netlify.toml`). Utiliza redirecciones para manejar el enrutamiento de la SPA y distribución mediante CDN global.
*   **Backend**: Alojado en **Render** (definido en `render.yaml`). Se despliega como un servicio web Docker/Python que levanta la API de FastAPI.
*   **Base de Datos**: Clúster gestionado multi-región en **MongoDB Atlas** (capa M0/M10).
*   **Archivos / Documentos**: Almacenados en un bucket de **Cloudflare R2** (`enered-uploads`), asegurando costo de descarga (egress) a $0.
*   **Migración y Scripts**:
    *   `scripts/migrate_mongo_to_atlas.py` para mover base de datos local a Atlas de producción.
    *   `scripts/migrate_uploads_to_r2.py` para sincronizar uploads locales hacia R2.
