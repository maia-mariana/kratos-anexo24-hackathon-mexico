/**
 * KRATOS-Anexo24 — Application Entry Point
 * Wires all UI to engine modules via store persistence.
 * No inline business logic — all rules live in js/engine/.
 */

import * as store from './js/store/index.js';
import * as engine from './js/engine/index.js';
import { initInspector } from './js/integrity/ui.js';
import { renderResumen } from './js/views/resumen.js';
import { renderRegistro } from './js/views/registro.js';

// Initialize inspector
initInspector();

// ============================================================
// State & Persistence
// ============================================================

/** @type {ReturnType<typeof store.loadState>} */
let state = store.loadState();

/** @type {Map<string, engine.Movement>} */
let movementsCache = new Map();

/** @type {Map<string, engine.AuditEvent[]>} */
let auditChainsCache = new Map();

// Debounced save
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.saveState(state);
    saveTimer = null;
  }, 300);
}

function forceSave() {
  if (saveTimer) clearTimeout(saveTimer);
  store.saveState(state);
  saveTimer = null;
}

/**
 * Load engine data from store into memory caches.
 */
async function hydrateEngine() {
  // Load movements
  for (const m of state.movements || []) {
    movementsCache.set(m.id, m);
  }
  // Load audit chains
  for (const [companyId, chain] of Object.entries(state.auditChains || {})) {
    auditChainsCache.set(companyId, chain);
  }
  // Restore engine internal state
  engine.__loadState?.(state);
}

// ============================================================
// DOM Utilities
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function hideAllViews() {
  for (const v of VIEWS) {
    const el = $(`#view-${v}`);
    if (el) el.hidden = true;
  }
}

function showView(view) {
  hideAllViews();
  const el = $(`#view-${view}`);
  if (el) {
    el.hidden = false;
    state.view = view;
    scheduleSave();
    renderView(view);
  }
  // Update nav active state
  for (const btn of $$('.nav [data-view]')) {
    btn.setAttribute('aria-current', btn.dataset.view === view ? 'page' : 'false');
  }
}

// ============================================================
// Navigation
// ============================================================

const VIEWS = [
  'resumen', 'panel', 'registro', 'cierre', 'datos',
  'chat', 'informe', 'viab', 'bitacora', 'integridad'
];

function initNavigation() {
  // Intro enter button
  $('#introEnter')?.addEventListener('click', () => {
    const intro = $('#intro');
    if (intro) intro.hidden = true;
    document.body.classList.remove('locked');
  });

  // Nav buttons
  for (const btn of $$('.nav [data-view]')) {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  }
  // Company select
  const empresaSel = $('#empresa');
  if (empresaSel) {
    empresaSel.addEventListener('change', (e) => {
      state.activeCompanyId = e.target.value;
      scheduleSave();
      renderView(state.view);
    });
  }
  // Reset demo
  const resetBtn = $('#resetDemo');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('¿Borrar todo y volver a los datos iniciales?')) {
        store.clearAll();
        store.clearDocuments();
        location.reload();
      }
    });
  }
  // Theme toggle
  const themeBtn = $('#themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
    });
  }
}

// ============================================================
// Company / Scope Helpers
// ============================================================

function getActiveCompanyId() {
  return state.activeCompanyId || state.companies[0]?.id || 'mb';
}

function scopedCompanies() {
  return state.companies.filter(c => c.id === getActiveCompanyId());
}

// ============================================================
// Render Dispatcher
// ============================================================

async function renderView(view) {
  switch (view) {
    case 'resumen': await renderResumen(); break;
    case 'panel': /* await renderPanel() */ break;
    case 'registro': await renderRegistro(); break;
    case 'cierre': /* await renderCierre() */ break;
    case 'datos': /* await renderDatos() */ break;
    case 'chat': /* await renderChat() */ break;
    case 'informe': /* await renderInforme() */ break;
    case 'viab': /* await renderViab() */ break;
    case 'bitacora': /* await renderBitacora() */ break;
    case 'integridad': /* inspector auto-init */ break;
  }
  // Update company selector
  updateCompanySelector();
}

// ============================================================
// Company Selector
// ============================================================

function updateCompanySelector() {
  const sel = $('#empresa');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '';
  for (const c of state.companies) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.corto} (${c.rfc})`;
    sel.appendChild(opt);
  }
  sel.value = current || getActiveCompanyId();
}

// ============================================================
// Formatters
// ============================================================

function fmtMXN(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100);
}

function fmtNum(n) {
  return new Intl.NumberFormat('es-MX').format(n);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ============================================================
// Immediate intro hide (after DOM ready)
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const intro = document.getElementById('intro');
    if (intro) intro.hidden = true;
    document.body.classList.remove('locked');
  });
} else {
  const intro = document.getElementById('intro');
  if (intro) intro.hidden = true;
  document.body.classList.remove('locked');
}

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {
  console.log('[bootstrap] starting, state.view=', state.view);
  await hydrateEngine();
  initNavigation();

  // Clear invalid saved view (must be in VIEWS)
  const savedView = state.view;
  console.log('[bootstrap] savedView from state:', savedView);
  const validView = (VIEWS.includes(savedView) ? savedView : 'resumen');
  console.log('[bootstrap] validView:', validView);
  state.view = validView;
  store.saveState(state, true);

  showView(validView);

  // Load company selector
  updateCompanySelector();

  // Restore theme
  const savedTheme = localStorage.getItem('kratos-theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;

  // Global listeners
  window.addEventListener('beforeunload', forceSave);
  console.log('[bootstrap] done, current view:', state.view);
}

// Start
bootstrap().catch(err => console.error('Bootstrap failed:', err));

// Expose for debugging
window.__KRATOS__ = { state, engine, store, showView, forceSave };