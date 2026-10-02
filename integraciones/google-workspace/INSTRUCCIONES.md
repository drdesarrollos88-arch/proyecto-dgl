# Guía de Instalación: Complemento de Gmail para Cotizador DGL IDIEM

Este complemento agrega un botón inteligente en el panel lateral de **Gmail (Google Workspace)** para que tú y Ximena Garrido puedan transformar cualquier correo de un cliente (con sus textos, PDFs adjuntos o enlaces) en una **cotización oficial en borrador con 1 solo clic**.

---

## Paso 1: Abrir Google Apps Script
1. Con tu cuenta `@idiem.cl`, ingresa a: **[script.google.com](https://script.google.com)**
2. Haz clic en el botón superior izquierdo: **"+ Nuevo proyecto"** (o "Crear proyecto").
3. En la parte superior, haz clic en *"Proyecto sin título"* y cámbiale el nombre a:  
   `Cotizador DGL IDIEM`.

---

## Paso 2: Mostrar el archivo `appsscript.json` (Manifiesto)
1. En el menú lateral izquierdo de Apps Script, haz clic en el ícono de engranaje **⚙️ Configuración del proyecto**.
2. Marca la casilla: **"Mostrar el archivo de manifiesto 'appsscript.json' en el editor"**.
3. Vuelve al editor haciendo clic en el ícono de código **`<> Editor`** a la izquierda.

---

## Paso 3: Pegar el Manifiesto (`appsscript.json`)
1. En la lista de archivos a la izquierda, haz clic en **`appsscript.json`**.
2. Borra todo lo que tenga y pega exactamente el siguiente contenido:

```json
{
  "timeZone": "America/Santiago",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.addons.execute",
    "https://www.googleapis.com/auth/gmail.addons.current.message.readonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email"
  ],
  "addOns": {
    "common": {
      "name": "Cotizador DGL IDIEM",
      "logoUrl": "https://img.icons8.com/color/48/artificial-intelligence.png",
      "layoutProperties": {
        "primaryColor": "#0F172A",
        "secondaryColor": "#E20000"
      }
    },
    "gmail": {
      "contextualTriggers": [
        {
          "unconditional": {},
          "onTriggerFunction": "buildAddOn"
        }
      ]
    }
  }
}
```
3. Guarda con `Ctrl + S` (o haz clic en el ícono de disquete 💾).

---

## Paso 4: Pegar el Código (`Codigo.gs`)
1. En la lista de archivos a la izquierda, haz clic en **`Código.gs`** (o `Codigo.gs`).
2. Borra el código existente y pega el archivo completo [Codigo.gs](./Codigo.gs).
3. Guarda con `Ctrl + S`.

---

## Paso 5: Probar e Instalar en tu Gmail (Implementación de Prueba)
1. En la parte superior derecha de Google Apps Script, haz clic en el botón azul **"Implementar"** $\rightarrow$ **"Implementaciones de prueba"**.
2. En la ventana que aparece:
   - Tipo de aplicación: asegúrate de que esté seleccionada **"Complemento de Google Workspace"**.
   - Haz clic en el botón **"Instalar"** (o "Habilitar prueba").
3. Si Google te solicita autorizaciones la primera vez:
   - Haz clic en *"Revisar permisos"*.
   - Elige tu cuenta `@idiem.cl`.
   - Si sale *"Google no ha verificado esta aplicación"*, haz clic en *"Opciones avanzadas"* $\rightarrow$ *"Ir a Cotizador DGL IDIEM (no seguro)"* y luego *"Permitir"*.
   *(Esto es completamente normal para scripts desarrollados internamente por ti mismo).*

---

## Paso 6: ¡Listo! Cómo usarlo en Gmail

1. Abre tu **Gmail** (`mail.google.com`) y recarga la página (`F5`).
2. Abre **cualquier correo** donde un cliente solicite cotización (o un correo de prueba).
3. En el **panel lateral derecho de Gmail** (donde están Google Calendar, Keep, Tareas), verás aparecer el nuevo ícono: **Cotizador DGL IDIEM**.
4. Haz clic en él:
   - Verás el remitente, el asunto y los archivos adjuntos detectados (PDFs, etc.).
   - Puedes confirmar si la cotización queda a nombre de **Diego Román** o de **Ximena Garrido**.
   - Presiona el botón rojo: **"⚡ Crear Borrador en DGL"**.
5. En 3 segundos la IA analizará la memoria técnica, calculará los ensayos oficiales, generará el correlativo oficial y te mostrará el botón:  
   **"🚀 Abrir y Editar en Cotizador DGL"**.
6. Al hacer clic, se abre la plataforma directamente en el borrador listo para tu revisión.

---

## ¿Cómo habilitarlo también para Ximena Garrido?
1. En la pantalla de [script.google.com](https://script.google.com) de tu proyecto, haz clic en el botón superior **"Compartir"**.
2. Agrega el correo de `ximena.garrido@idiem.cl` con permisos de edición o lectura.
3. Ximena solo debe ingresar al enlace del proyecto, hacer clic en **"Implementar"** $\rightarrow$ **"Implementaciones de prueba"** $\rightarrow$ **"Instalar"** y automáticamente tendrá el mismo botón en su Gmail.
