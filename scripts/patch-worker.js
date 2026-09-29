const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '..', '.open-next', 'worker.js');
if (fs.existsSync(workerPath)) {
  let content = fs.readFileSync(workerPath, 'utf8');
  if (!content.includes('process.umask = () => 0')) {
    const polyfill = 'if (typeof process !== "undefined" && typeof process.umask !== "function") { process.umask = () => 0; }\n';
    fs.writeFileSync(workerPath, polyfill + content, 'utf8');
    console.log('✓ Polyfill process.umask agregado al inicio de .open-next/worker.js');
  } else {
    console.log('✓ Polyfill process.umask ya presente en .open-next/worker.js');
  }
} else {
  console.log('worker.js no encontrado en .open-next');
}
