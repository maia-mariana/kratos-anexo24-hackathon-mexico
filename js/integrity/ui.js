/**
 * Inspector UI — file ingest → hash → diff → explain → manifest → anchor.
 * Pure ES module, no framework, binds to DOM.
 */

import * as engine from '../engine/index.js';

/** @typedef {import('../engine/index.js').InspectionResult} InspectionResult */

let currentResult = null;

/**
 * Initialize the inspector screen.
 * Call once on app load.
 */
export function initInspector() {
  bindFileInputs();
  bindActions();
}

/**
 * Bind file input handlers (drag-drop + file picker).
 */
function bindFileInputs() {
  const dropZone = document.getElementById('integrity-drop');
  const fileInput = document.getElementById('integrity-file');

  if (!dropZone || !fileInput) return;

  // Click drop zone → open file picker
  dropZone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  // File picker change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
    e.target.value = ''; // allow re-select same file
  });
}

/**
 * Process selected files (max 2: original + compared).
 * @param {FileList} files
 */
async function handleFiles(files) {
  const originalFile = files[0];
  const comparedFile = files[1] || null;

  setBusy(true, 'Leyendo archivos...');
  updateFileLabels(originalFile, comparedFile);

  try {
    const originalBytes = await readFileAsArrayBuffer(originalFile);
    let comparedBytes = null;
    if (comparedFile) {
      comparedBytes = await readFileAsArrayBuffer(comparedFile);
    }

    setBusy(true, 'Calculando hashes y diff...');
    const result = await engine.inspect({
      original: originalBytes,
      compared: comparedBytes,
      originalName: originalFile.name,
      comparedName: comparedFile?.name || '(sin comparar)'
    });

    currentResult = result;
    renderResult(result);
    setBusy(false);
  } catch (err) {
    console.error('[integrity] Inspection failed:', err);
    setError(err.message);
    setBusy(false);
  }
}

/**
 * Read File as ArrayBuffer.
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Update file name labels in UI.
 */
function updateFileLabels(originalFile, comparedFile) {
  const origLabel = document.getElementById('integrity-orig-label');
  const compLabel = document.getElementById('integrity-comp-label');
  const actionsSection = document.getElementById('integrity-actions');
  if (origLabel) origLabel.textContent = originalFile ? `Original: ${originalFile.name} (${formatBytes(originalFile.size)})` : 'Original: —';
  if (compLabel) compLabel.textContent = comparedFile ? `Comparado: ${comparedFile.name} (${formatBytes(comparedFile.size)})` : 'Comparado: — (solo hash original)';
  if (actionsSection && originalFile) actionsSection.hidden = false;
}

/**
 * Format bytes human-readable.
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Bind action buttons: compare, explain, download, anchor.
 */
function bindActions() {
  const btnCompare = document.getElementById('btn-integrity-compare');
  const btnExplain = document.getElementById('btn-integrity-explain');
  const btnDownload = document.getElementById('btn-integrity-download');
  const btnAnchor = document.getElementById('btn-integrity-anchor');
  const anchorMode = document.getElementById('integrity-anchor-mode');

  if (btnCompare) btnCompare.addEventListener('click', () => runCompare());
  if (btnExplain) btnExplain.addEventListener('click', () => runExplain());
  if (btnDownload) btnDownload.addEventListener('click', () => downloadManifest());
  if (btnAnchor) btnAnchor.addEventListener('click', () => runAnchor(anchorMode?.value || 'dry-run'));
}

/**
 * Re-run compare (useful after loading files).
 */
async function runCompare() {
  if (!currentResult) return alert('Primero seleccione un archivo original.');
  setBusy(true, 'Recalculando...');
  // Re-inspect with same inputs (would need to store them; for now just re-render)
  renderResult(currentResult);
  setBusy(false);
}

/**
 * Show AI/local explanation (already in result).
 */
function runExplain() {
  if (!currentResult) return alert('Primero seleccione un archivo.');
  const explainEl = document.getElementById('integrity-explanation');
  const detailsEl = explainEl?.closest('details');
  if (explainEl) {
    explainEl.textContent = currentResult.aiExplanation;
    explainEl.hidden = false;
  }
  if (detailsEl) detailsEl.open = true;
}

/**
 * Download manifest as JSON file.
 */
function downloadManifest() {
  if (!currentResult) return alert('No hay resultado para descargar.');
  const blob = new Blob([currentResult.manifest], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manifest-${currentResult.original.name.replace(/\.[^.]+$/, '')}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Anchor hash to Solana Devnet.
 * @param {'dry-run'|'phantom'} mode
 */
async function runAnchor(mode) {
  if (!currentResult) return alert('Primero seleccione un archivo.');

  const hash = currentResult.original.canonicalSha256;
  const eventId = `INT-${hash.slice(0, 12).toUpperCase()}`;

  setBusy(true, mode === 'phantom' ? 'Conectando con Phantom...' : 'Generando dry-run...');

  try {
    const result = await engine.anchor(hash, eventId, { mode });
    renderAnchorResult(result);
    setBusy(false);
  } catch (err) {
    console.error('[integrity] Anchor failed:', err);
    setError(`Anclaje falló: ${err.message}`);
    setBusy(false);
  }
}

/**
 * Render inspection result to DOM.
 */
function renderResult(result) {
  // Match badge
  const badge = document.getElementById('integrity-match-badge');
  if (badge) {
    badge.textContent = result.match ? '✅ Integridad verificada' : '⚠️ Discrepancia detectada';
    badge.className = `badge ${result.match ? 'ok' : 'warn'}`;
  }

  // Hashes
  setText('integrity-hash-orig', result.original.canonicalSha256);
  setText('integrity-hash-comp', result.compared.canonicalSha256);
  setText('integrity-hash-bytes-orig', result.original.bytesSha256 || '— (no binario)');
  setText('integrity-hash-bytes-comp', result.compared.bytesSha256 || '— (no binario)');

  // Diff table
  renderDiffTable(result.differences);

  // Counts
  const counts = engine.countBySeverity(result.differences);
  setText('integrity-count-critical', counts.critical);
  setText('integrity-count-warning', counts.warning);
  setText('integrity-count-info', counts.info);

  // Explanation (hidden until clicked)
  const explainEl = document.getElementById('integrity-explanation');
  if (explainEl) {
    explainEl.textContent = result.aiExplanation;
    explainEl.hidden = true;
  }

  // Manifest hash
  setText('integrity-manifest-hash', result.manifestSha256);

  // Show result section
  const resultSection = document.getElementById('integrity-result');
  if (resultSection) resultSection.hidden = false;
}

/**
 * Render diff table.
 */
function renderDiffTable(diffs) {
  const tbody = document.getElementById('integrity-diff-tbody');
  if (!tbody) return;

  if (!diffs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Sin diferencias</td></tr>';
    return;
  }

  tbody.innerHTML = diffs.map(d => `
    <tr class="${d.severity}">
      <td><span class="severity-dot ${d.severity}"></span>${escapeHtml(d.path)}</td>
      <td>${escapeHtml(d.changeType)}</td>
      <td><span class="severity-badge ${d.severity}">${d.severity}</span></td>
      <td class="mono">${escapeHtml(d.originalValue ?? '—')}</td>
      <td class="mono">${escapeHtml(d.currentValue ?? '—')}</td>
    </tr>
  `).join('');
}

/**
 * Render anchor result.
 */
function renderAnchorResult(result) {
  const el = document.getElementById('integrity-anchor-result');
  if (!el) return;

  if (result.dryRun) {
    el.innerHTML = `
      <div class="alert warn">
        <strong>Dry-run (simulado):</strong> No se envió transacción real.
        <pre class="mono">${escapeHtml(result.memo)}</pre>
        <small>Longitud: ${result.memoLength} bytes</small>
      </div>
    `;
  } else if (result.signature) {
    el.innerHTML = `
      <div class="alert ok">
        <strong>✅ Anclado en Devnet</strong>
        <div class="mono">Firma: ${escapeHtml(result.signature)}</div>
        <a href="${escapeHtml(result.explorerUrl)}" target="_blank" rel="noopener">Ver en Solana Explorer</a>
      </div>
    `;
  } else {
    el.innerHTML = `<div class="alert error">Error: ${escapeHtml(result.error || 'Desconocido')}</div>`;
  }
  el.hidden = false;
}

/**
 * Show error message.
 */
function setError(msg) {
  const el = document.getElementById('integrity-error');
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
}

/**
 * Set busy state.
 */
function setBusy(busy, msg = '') {
  const btns = document.querySelectorAll('#integrity-actions button');
  btns.forEach(b => b.disabled = busy);
  const status = document.getElementById('integrity-status');
  if (status) {
    status.textContent = msg;
    status.hidden = !busy;
  }
}

/**
 * Safe set textContent.
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Escape HTML.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}