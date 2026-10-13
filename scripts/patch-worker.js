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

// 2. Parche en @opennextjs/aws pattern-env.js (evitar "TypeError: value.patterns is not iterable")
const patternEnvPath = path.join(__dirname, '..', 'node_modules', '@opennextjs', 'aws', 'dist', 'overrides', 'originResolver', 'pattern-env.js');
if (fs.existsSync(patternEnvPath)) {
  let pContent = fs.readFileSync(patternEnvPath, 'utf8');
  let pChanged = false;
  if (pContent.includes('for (const pattern of value.patterns) {')) {
    pContent = pContent.replace(
      'for (const pattern of value.patterns) {',
      'for (const pattern of (value && Array.isArray(value.patterns) ? value.patterns : [])) {'
    );
    pChanged = true;
  }
  if (pContent.includes('patterns: value.patterns,')) {
    pContent = pContent.replace(
      'patterns: value.patterns,',
      'patterns: value?.patterns || [],'
    );
    pChanged = true;
  }
  if (pChanged) {
    fs.writeFileSync(patternEnvPath, pContent, 'utf8');
    console.log('✓ pattern-env.js parchado para manejar patterns indefinidos');
  }
}

// 3. Parches preventivos en node_modules/next (router-reducer & metadata)
const nextPatchFiles = [
  // refetch-inactive-parallel-segments
  {
    paths: [
      path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'client', 'components', 'router-reducer', 'refetch-inactive-parallel-segments.js'),
      path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'esm', 'client', 'components', 'router-reducer', 'refetch-inactive-parallel-segments.js')
    ],
    patches: [
      {
        find: 'function addRefreshMarkerToActiveParallelSegments(tree, path) {\n    const [segment, parallelRoutes, , refetchMarker] = tree;',
        replace: 'function addRefreshMarkerToActiveParallelSegments(tree, path) {\n    if (!tree || !Array.isArray(tree)) return;\n    const [segment, parallelRoutes, , refetchMarker] = tree;'
      },
      {
        find: 'async function refreshInactiveParallelSegmentsImpl(param) {\n    let { navigatedAt, state, updatedTree, updatedCache, includeNextUrl, fetchedSegments, rootTree = updatedTree, canonicalUrl } = param;\n    const [, parallelRoutes, refetchPath, refetchMarker] = updatedTree;',
        replace: 'async function refreshInactiveParallelSegmentsImpl(param) {\n    let { navigatedAt, state, updatedTree, updatedCache, includeNextUrl, fetchedSegments, rootTree = updatedTree, canonicalUrl } = param;\n    if (!updatedTree || !Array.isArray(updatedTree)) return;\n    const [, parallelRoutes, refetchPath, refetchMarker] = updatedTree;'
      }
    ]
  },
  // fill-lazy-items-till-leaf-with-head
  {
    paths: [
      path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'client', 'components', 'router-reducer', 'fill-lazy-items-till-leaf-with-head.js'),
      path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'esm', 'client', 'components', 'router-reducer', 'fill-lazy-items-till-leaf-with-head.js')
    ],
    patches: [
      {
        find: 'function fillLazyItemsTillLeafWithHead(navigatedAt, newCache, existingCache, routerState, cacheNodeSeedData, head, prefetchEntry) {\n    const isLastSegment = Object.keys(routerState[1]).length === 0;',
        replace: 'function fillLazyItemsTillLeafWithHead(navigatedAt, newCache, existingCache, routerState, cacheNodeSeedData, head, prefetchEntry) {\n    if (!routerState || !routerState[1] || typeof routerState[1] !== "object") { if (newCache) newCache.head = head; return; }\n    const isLastSegment = Object.keys(routerState[1]).length === 0;'
      }
    ]
  },
  // resolve-metadata
  {
    paths: [
      path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'lib', 'metadata', 'resolve-metadata.js'),
      path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'esm', 'lib', 'metadata', 'resolve-metadata.js')
    ],
    patches: [
      {
        find: 'async function resolveMetadataItemsImpl(metadataItems, tree, /** Provided tree can be nested subtree, this argument says what is the path of such subtree */ treePrefix, parentParams, searchParams, errorConvention, errorMetadataItem, getDynamicParamFromSegment, workStore) {\n    const [segment, parallelRoutes, { page }] = tree;',
        replace: 'async function resolveMetadataItemsImpl(metadataItems, tree, /** Provided tree can be nested subtree, this argument says what is the path of such subtree */ treePrefix, parentParams, searchParams, errorConvention, errorMetadataItem, getDynamicParamFromSegment, workStore) {\n    if (!tree || !Array.isArray(tree)) return metadataItems;\n    const [segment, parallelRoutes, { page }] = tree;'
      },
      {
        find: 'async function resolveViewportItemsImpl(viewportItems, tree, /** Provided tree can be nested subtree, this argument says what is the path of such subtree */ treePrefix, parentParams, searchParams, errorConvention, errorViewportItemRef, getDynamicParamFromSegment, workStore) {\n    const [segment, parallelRoutes, { page }] = tree;',
        replace: 'async function resolveViewportItemsImpl(viewportItems, tree, /** Provided tree can be nested subtree, this argument says what is the path of such subtree */ treePrefix, parentParams, searchParams, errorConvention, errorViewportItemRef, getDynamicParamFromSegment, workStore) {\n    if (!tree || !Array.isArray(tree)) return viewportItems;\n    const [segment, parallelRoutes, { page }] = tree;'
      }
    ]
  }
];

for (const group of nextPatchFiles) {
  for (const filePath of group.paths) {
    if (fs.existsSync(filePath)) {
      let fContent = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      for (const p of group.patches) {
        if (fContent.includes(p.find) && !fContent.includes(p.replace)) {
          fContent = fContent.replace(p.find, p.replace);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(filePath, fContent, 'utf8');
        console.log(`✓ Parchado módulo de Next.js: ${path.basename(filePath)}`);
      }
    }
  }
}

// 4. Parche en .open-next/worker.js
const workerPath = path.join(__dirname, '..', '.open-next', 'worker.js');
if (fs.existsSync(workerPath)) {
  let content = fs.readFileSync(workerPath, 'utf8');
  
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

  if (!content.includes('__applyUmaskPolyfill();')) {
    content = content.replace(
      /async fetch\(request, env, ctx\) \{/,
      'async fetch(request, env, ctx) {\n        __applyUmaskPolyfill();'
    );
  }

  fs.writeFileSync(workerPath, polyfillBlock + content, 'utf8');
  console.log('✓ Polyfill umask incondicional inyectado en .open-next/worker.js');
}

// 5. Parche en .open-next/server-functions/default/handler.mjs
const handlerPath = path.join(__dirname, '..', '.open-next', 'server-functions', 'default', 'handler.mjs');
if (fs.existsSync(handlerPath)) {
  let handlerContent = fs.readFileSync(handlerPath, 'utf8');
  let hChanged = false;

  // 5a. Polyfill umask
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
    handlerContent = handlerPolyfill + handlerContent;
    hChanged = true;
    console.log('✓ Polyfill umask inyectado en handler.mjs');
  }

  // 5b. Guard for e3 (addRefreshMarkerToActiveParallelSegments in client router reducer)
  const targetE3 = 'function e3(t3,r3){let[i,a,,s]=t3;for(let o in i.includes(n2.GC)&&s!=="refresh"&&(t3[2]=r3,t3[3]="refresh"),a)e3(a[o],r3)}';
  const replE3 = 'function e3(t3,r3){if(!t3||!Array.isArray(t3))return;let[i,a,,s]=t3;for(let o in i&&typeof i.includes==="function"&&i.includes(n2.GC)&&s!=="refresh"&&(t3[2]=r3,t3[3]="refresh"),a)e3(a&&a[o],r3)}';
  if (handlerContent.includes(targetE3)) {
    handlerContent = handlerContent.replace(targetE3, replE3);
    hChanged = true;
    console.log('✓ Guard para e3 aplicado en handler.mjs');
  }

  // 5c. Guard for a2 (addRefreshMarkerToActiveParallelSegments compiled)
  const targetA2 = 'function a2(b2,c2){let[d2,e2,,g2]=b2;for(let h2 in d2.includes(f.PAGE_SEGMENT_KEY)&&g2!=="refresh"&&(b2[2]=c2,b2[3]="refresh"),e2)a2(e2[h2],c2)}';
  const replA2 = 'function a2(b2,c2){if(!b2||!Array.isArray(b2))return;let[d2,e2,,g2]=b2;for(let h2 in d2&&typeof d2.includes==="function"&&d2.includes(f.PAGE_SEGMENT_KEY)&&g2!=="refresh"&&(b2[2]=c2,b2[3]="refresh"),e2)a2(e2&&e2[h2],c2)}';
  if (handlerContent.includes(targetA2)) {
    handlerContent = handlerContent.replace(targetA2, replA2);
    hChanged = true;
    console.log('✓ Guard para a2 aplicado en handler.mjs');
  }

  // 5d. Guard for B (resolveMetadataItemsImpl)
  const targetB = 'async function B(a2,b2,c2,d2,e2,f2,g2,h2,i2){let j2,[k2,l2,{page:m2}]=b2,';
  const replB = 'async function B(a2,b2,c2,d2,e2,f2,g2,h2,i2){if(!b2||!Array.isArray(b2))return a2;let j2,[k2,l2,{page:m2}]=b2,';
  if (handlerContent.includes(targetB)) {
    handlerContent = handlerContent.replace(targetB, replB);
    hChanged = true;
    console.log('✓ Guard para B (metadata) aplicado en handler.mjs');
  }

  // 5e. Guard for D (resolveViewportItemsImpl)
  const targetD = 'async function D(a2,b2,c2,d2,e2,f2,g2,h2,i2){let j2,[k2,l2,{page:m2}]=b2,';
  const replD = 'async function D(a2,b2,c2,d2,e2,f2,g2,h2,i2){if(!b2||!Array.isArray(b2))return a2;let j2,[k2,l2,{page:m2}]=b2,';
  if (handlerContent.includes(targetD)) {
    handlerContent = handlerContent.replace(targetD, replD);
    hChanged = true;
    console.log('✓ Guard para D (viewport) aplicado en handler.mjs');
  }

  // 5f. Guard for e11 (fillLazyItemsTillLeafWithHead inline)
  const targetE11 = 'function e11(t11,r11,n11,i3,a3,s3,o3){if(Object.keys(i3[1]).length===0){r11.head=s3;return}for(let l3 in i3[1]){';
  const replE11 = 'function e11(t11,r11,n11,i3,a3,s3,o3){if(!i3||!i3[1]||typeof i3[1]!=="object"||Object.keys(i3[1]).length===0){if(r11)r11.head=s3;return}for(let l3 in i3[1]){';
  if (handlerContent.includes(targetE11)) {
    handlerContent = handlerContent.replace(targetE11, replE11);
    hChanged = true;
    console.log('✓ Guard para e11 (fillLazy) aplicado en handler.mjs');
  }

  // 5g. Guard for a2 in fillLazyItemsTillLeafWithHead
  const targetFillLazyA2 = 'Object.defineProperty(b,"fillLazyItemsTillLeafWithHead",{enumerable:!0,get:function(){return function a2(b2,c2,f,g,h,i,j){if(Object.keys(g[1]).length===0){c2.head=i;return}for(let k in g[1]){';
  const replFillLazyA2 = 'Object.defineProperty(b,"fillLazyItemsTillLeafWithHead",{enumerable:!0,get:function(){return function a2(b2,c2,f,g,h,i,j){if(!g||!g[1]||typeof g[1]!=="object"||Object.keys(g[1]).length===0){if(c2)c2.head=i;return}for(let k in g[1]){';
  if (handlerContent.includes(targetFillLazyA2)) {
    handlerContent = handlerContent.replace(targetFillLazyA2, replFillLazyA2);
    hChanged = true;
    console.log('✓ Guard para fillLazy a2 aplicado en handler.mjs');
  }

  if (hChanged) {
    fs.writeFileSync(handlerPath, handlerContent, 'utf8');
    console.log('✓ handler.mjs actualizado con todos los parches de resiliencia');
  }
}

console.log('--- Fin de parches ---');
