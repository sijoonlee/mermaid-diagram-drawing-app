import './style.css';
import { Canvas } from './canvas';
import { download, svgBlob } from './export';
import { generateMarkdown } from './generate';
import { Inspector } from './inspector';
import { buildPalette } from './palette';
import { validateAndRender } from './preview';
import { Store } from './state';
import type { NodeShape } from './types';

const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
const store = new Store();
const canvas = new Canvas(svg, store);
new Inspector(document.getElementById('inspector')!, store);

// ---- persistence: restore on load, auto-save on every change ------------

const STORAGE_KEY = 'mermaid-draw:diagram';
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) store.load(saved);
store.onChange(() => localStorage.setItem(STORAGE_KEY, store.toJSON()));

// ---- palette drag & drop ------------------------------------------------

buildPalette(document.getElementById('palette-items')!);

svg.addEventListener('dragover', (e) => {
  e.preventDefault();
  svg.classList.add('dragover');
});
svg.addEventListener('dragleave', () => svg.classList.remove('dragover'));
svg.addEventListener('drop', (e) => {
  e.preventDefault();
  svg.classList.remove('dragover');
  const tool = e.dataTransfer?.getData('text/tool');
  const at = canvas.toLocal(e);
  if (tool === 'box') {
    const shape = (e.dataTransfer?.getData('text/shape') || 'rect') as NodeShape;
    store.addNode(at, shape);
  } else if (tool === 'arrow') {
    store.addEdge(at);
  }
});

// ---- keyboard -----------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || ['TEXTAREA', 'INPUT', 'SELECT'].includes(t.tagName)))
      return;
    store.deleteSelected();
  }
});

// ---- buttons ------------------------------------------------------------

const mdEl = document.getElementById('md') as HTMLTextAreaElement;
const previewEl = document.getElementById('preview') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const saveSvgBtn = document.getElementById('save-svg-btn') as HTMLButtonElement;

async function renderPreview(md: string) {
  if (!md.trim()) {
    previewEl.innerHTML = '';
    statusEl.textContent = '';
    statusEl.className = '';
    saveSvgBtn.disabled = true;
    return;
  }
  statusEl.textContent = 'Validating…';
  statusEl.className = '';
  const result = await validateAndRender(md, previewEl);
  if (result.stale) return; // a newer render owns the status line now
  statusEl.textContent = result.message;
  statusEl.className = result.ok ? 'ok' : 'err';
  saveSvgBtn.disabled = !result.ok;
}

document.getElementById('generate-btn')!.addEventListener('click', () => {
  const md = generateMarkdown(store);
  mdEl.value = md;
  void renderPreview(md);
});

// the textarea is also an input: paste or edit mermaid and preview it live
let mdDebounce: number | undefined;
mdEl.addEventListener('input', () => {
  clearTimeout(mdDebounce);
  mdDebounce = window.setTimeout(() => void renderPreview(mdEl.value), 300);
});

saveSvgBtn.addEventListener('click', () => {
  const svg = previewEl.querySelector('svg');
  if (svg) download(svgBlob(svg), 'diagram.svg');
});

document.getElementById('export-btn')!.addEventListener('click', () => {
  download(new Blob([store.toJSON()], { type: 'application/json' }), 'diagram.json');
});

const importFile = document.getElementById('import-file') as HTMLInputElement;
document.getElementById('import-btn')!.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  const ok = store.load(await file.text());
  if (!ok) alert('Could not import: invalid diagram JSON.');
  importFile.value = '';
});

document.getElementById('clear-btn')!.addEventListener('click', () => {
  store.clear();
  mdEl.value = '';
  previewEl.innerHTML = '';
  statusEl.textContent = '';
  statusEl.className = '';
  saveSvgBtn.disabled = true;
});
