# Sistema DGL - Plataforma Oficial de Tarifario y Cotizaciones

Plataforma web moderna y segura diseñada para la gestión centralizada del tarifario oficial de ensayos de laboratorio y la generación inteligente de cotizaciones comerciales (reemplazando planillas Excel con fórmulas `BUSCARV` enlazadas).

---

## Características Principales

1. **Seguridad y Control de Accesos:**
   - Autenticación con RUT o Correo y Contraseña cifrada con `bcrypt`.
   - Sesiones seguras mediante tokens JWT en cookies `httpOnly`.
   - Limitador de tasa (*Rate Limiting*) para mitigar ataques de fuerza bruta en el inicio de sesión.
   - Roles de usuario:
     - **Administrador:** Puede modificar tarifas oficiales, cargar nuevos Excel y crear/administrar usuarios.
     - **Comercial:** Puede consultar tarifas, descargar copias en Excel, crear cotizaciones y generar PDFs.

2. **Tarifario Oficial Centralizado:**
   - Pre-cargado con los **358 ensayos técnicos** de mecánica de suelos y materiales bajo acreditación INN LE-304.
   - Buscador predictivo en tiempo real por código, designación, norma o SKU.
   - Filtro por categorías (*Ensayos Básicos, Permeabilidad, etc.*).
   - Botón para descargar una copia oficial en Excel en cualquier momento.
   - Carga de nuevos archivos Excel para actualizar el catálogo completo cuando sea necesario.

3. **Cotizador Inteligente (Adiós `BUSCARV`):**
   - Formulario de datos del cliente, proyecto y sede (*Santiago / Concepción / Terreno*).
   - Selector predictivo de ensayos: autocompleta Norma, Unidad, Masa mínima de muestra en kg y Precio Unitario en UF.
   - Cálculo automático de subtotales en UF y conversión a Pesos Chilenos (CLP) con la UF del día.
   - Cálculo de **Masa Total de Muestras Requerida (kg)** que debe entregar el cliente al laboratorio.
   - Generación de **PDF Oficial** con membrete institucional, formato corporativo y condiciones comerciales.
   - Exportación de la cotización a **Excel (.xlsx)** limpio y sin fórmulas rotas.

---

## Credenciales Iniciales de Administrador

- **Correo:** `diego.roman@idiem.cl`
- **RUT:** `16.898.141-4`
- **Contraseña:** `Diego.1988`
- **Rol:** `Administrador`

---

## Ejecución Local

Para ejecutar la plataforma en cualquier computador:

```bash
# 1. Instalar dependencias (ya instaladas en este proyecto)
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

La plataforma estará disponible en: [http://localhost:3000](http://localhost:3000)

---

## Despliegue en la Nube (Vercel)

El proyecto está 100% preparado y optimizado para desplegarse en **Vercel**:

1. Sube este repositorio a **GitHub**, **GitLab** o **Bitbucket**.
2. Conecta tu repositorio en [Vercel](https://vercel.com).
3. Configura las siguientes Variables de Entorno en el panel de Vercel (*Project Settings > Environment Variables*):
   - `JWT_SECRET`: Llave secreta aleatoria para la firma de tokens (ej. `dgl-prod-secret-key-2026`).
   - `NODE_ENV`: `production`
4. Haz clic en **Deploy**. Vercel se encargará automáticamente de la compilación, certificados HTTPS y protección perimetral DDoS/DNS.

