# Plataforma Web Cotizador DGL — Laboratorio Geotécnico IDIEM
## Instrucciones de Instalación y Despliegue en Servidor Interno

Este paquete contiene el código fuente completo, estructura de base de datos local y configuración oficial de la plataforma web del Laboratorio Geotécnico DGL — IDIEM.

---

### 1. Requisitos del Servidor
* **Sistema Operativo:** Linux (Ubuntu, Debian, RHEL) o Windows Server.
* **Node.js:** Versión 18.x, 20.x o superior (se recomienda Node.js 20 LTS).
* **NPM:** 9.x o superior (incluido con Node.js).
* **Red:** Servidor interno / Hosting institucional IDIEM (acceso por intranet o VPN).

---

### 2. Instalación Paso a Paso

1. **Descomprimir el archivo ZIP** en la carpeta de destino del servidor (ej. `/var/www/dgl-cotizador` o `C:\inetpub\dgl-cotizador`).

2. **Abrir una terminal** en la carpeta descomprimida y ejecutar:
   ```bash
   npm install
   ```
   *(Esto descargará automáticamente todas las dependencias y librerías oficiales necesarias).*

3. **Verificar o crear el archivo de entorno `.env.local`** en la raíz del proyecto con las siguientes variables:
   ```env
   # Clave secreta para tokens de sesión JWT (Obligatoria para seguridad de producción)
   JWT_SECRET=dgl-super-secret-key-laboratorio-geotecnico-2026-secure

   # Entorno de ejecución
   NODE_ENV=production

   # Puerto del servicio (por defecto 3000)
   PORT=3000

   # Clave Google Gemini (Opcional - solo si el servidor tiene salida a Internet)
   # Si no hay conexión a Internet, el sistema opera 100% en modo heurístico local autónomo
   GEMINI_API_KEY=
   ```

4. **Compilar la aplicación para producción:**
   ```bash
   npm run build
   ```

5. **Iniciar el servidor en producción:**
   ```bash
   npm start
   ```

---

### 3. Puesta en Marcha en Segundo Plano (Servicios del Sistema)

Para mantener el servicio siempre activo y que reinicie automáticamente tras reinicios del servidor, se recomienda utilizar **PM2**:

```bash
# Instalar PM2 globalmente (si no está instalado)
npm install -g pm2

# Iniciar la plataforma con PM2
pm2 start npm --name "dgl-cotizador" -- start

# Guardar la configuración para que inicie con el sistema operativo
pm2 save
pm2 startup
```

Si se utiliza un Proxy Inverso (ej. **Nginx** o **IIS**), redirigir el tráfico del puerto 80/443 al puerto local `http://localhost:3000`.

---

### 4. Credenciales de Acceso Inicial

* **URL de Acceso:** `http://[IP-DEL-SERVIDOR]:3000` (o el dominio interno asignado, ej: `http://dgl-cotizador.idiem.cl`)
* **Usuario Administrador Principal:**
  * **Correo:** `diego.roman@idiem.cl`
  * **Contraseña:** `Diego.1988`

---

### 5. Respaldo de Datos
Todos los datos de usuarios, cotizaciones, tarifario y reglas de aprendizaje se almacenan localmente en la carpeta `/data`:
* `data/db.json`: Base de cotizaciones, tarifario, reglas y configuraciones (con respaldo rotativo `db.json.bak`).
* `data/clientes.db`: Base de datos SQLite (Modo WAL) con clientes, empresas, contactos y proyectos.

Para realizar un respaldo periódico, basta con copiar la carpeta `/data`.

