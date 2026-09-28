const fs = require('fs');
const path = require('path');

const cacheDir = path.join(process.cwd(), '.next', 'cache');
if (fs.existsSync(cacheDir)) {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('✓ .next/cache limpiada exitosamente para compatibilidad con Cloudflare Pages (< 25MB limit).');
  } catch (err) {
    console.warn('Advertencia al limpiar cache:', err.message);
  }
}
