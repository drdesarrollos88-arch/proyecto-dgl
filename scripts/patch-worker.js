const fs = require('fs');
const path = require('path');

console.log('--- Aplicando parches de compatibilidad Cloudflare Worker / OpenNext ---');

// 1. Parche en node_modules/unenv (para que Wrangler incluya umask() { return 0; } en el bundle)
const unenvPath = path.join(__dirname, '..', 'node_modules', 'unenv', 'dist', 'runtime', 'node', 'internal', 'process', 'process.mjs');
if (fs.existsSync(unenvPath)) {
  let unenvContent = fs.readFileSync(unenvPath, 'utf8');
  if (unenvContent.includes('throw createNotImplementedError("process.umask");')) {
    unenvContent = unenvContent.replace(
      'throw createNotImplementedError("process.umask");',
      'return 0;'
    );
    fs.writeFileSync(unenvPath, unenvContent, 'utf8');
    console.log('✓ node_modules/unenv process.umask parchado para retornar 0');
  } else {
    console.log('✓ node_modules/unenv process.umask ya está parchado');
  }
}

// 2. Parche en .open-next/worker.js
const workerPath = path.join(__dirname, '..', '.open-next', 'worker.js');
if (fs.existsSync(workerPath)) {
  let content = fs.readFileSync(workerPath, 'utf8');
  
  // Limpiar versión previa si tenía la condición defectuosa
  content = content.replace(/if\s*\(typeof process !== "undefined" && typeof process\.umask !== "function"\)[^\n]*\n?/g, '');
  content = content.replace(/\/\/ OPEN_NEXT_UMASK_POLYFILL_START[\s\S]*?\/\/ OPEN_NEXT_UMASK_POLYFILL_END\n?/g, '');

  const polyfillBlock = `// OPEN_NEXT_UMASK_POLYFILL_START
function __applyUmaskPolyfill() {
  try {
    if (typeof globalThis !== 'undefined') {
      if (!globalThis.process) globalThis.process = {};
      globalThis.process.umask = () => 0;
      if (globalThis.process.constructor && globalThis.process.constructor.prototype) {
        globalThis.process.constructor.prototype.umask = () => 0;
      }
    }
    if (typeof process !== 'undefined') {
      process.umask = () => 0;
      if (process.constructor && process.constructor.prototype) {
        process.constructor.prototype.umask = () => 0;
      }
    }
  } catch (_) {}
}
__applyUmaskPolyfill();
// OPEN_NEXT_UMASK_POLYFILL_END\n`;

  // Asegurar que también se llame al inicio de fetch(request, env, ctx)
  if (!content.includes('__applyUmaskPolyfill();')) {
    content = content.replace(
      /async fetch\(request, env, ctx\) \{/,
      'async fetch(request, env, ctx) {\n        __applyUmaskPolyfill();'
    );
  }

  fs.writeFileSync(workerPath, polyfillBlock + content, 'utf8');
  console.log('✓ Polyfill umask incondicional inyectado en .open-next/worker.js');
} else {
  console.log('worker.js no encontrado en .open-next');
}

// 3. Parche en .open-next/server-functions/default/handler.mjs
const handlerPath = path.join(__dirname, '..', '.open-next', 'server-functions', 'default', 'handler.mjs');
if (fs.existsSync(handlerPath)) {
  let handlerContent = fs.readFileSync(handlerPath, 'utf8');
  if (!handlerContent.includes('__handlerUmaskPolyfill')) {
    const handlerPolyfill = `// __handlerUmaskPolyfill
try {
  if (typeof globalThis !== 'undefined' && globalThis.process) {
    globalThis.process.umask = () => 0;
    if (globalThis.process.constructor?.prototype) globalThis.process.constructor.prototype.umask = () => 0;
  }
  if (typeof process !== 'undefined') {
    process.umask = () => 0;
    if (process.constructor?.prototype) process.constructor.prototype.umask = () => 0;
  }
} catch (_) {}\n`;
    fs.writeFileSync(handlerPath, handlerPolyfill + handlerContent, 'utf8');
    console.log('✓ Polyfill umask inyectado en server-functions/default/handler.mjs');
  } else {
    console.log('✓ Polyfill umask ya presente en server-functions/default/handler.mjs');
  }
}

console.log('--- Fin de parches ---');
