import './style.css';
import { Canvas } from './canvas';
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
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    store.deleteSelected();
  }
});

// ---- buttons ------------------------------------------------------------

const mdEl = document.getElementById('md') as HTMLTextAreaElement;
const previewEl = document.getElementById('preview') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;

document.getElementById('generate-btn')!.addEventListener('click', async () => {
  const md = generateMarkdown(store);
  mdEl.value = md;
  statusEl.textContent = 'Validating…';
  statusEl.className = '';
  const result = await validateAndRender(md, previewEl);
  statusEl.textContent = result.message;
  statusEl.className = result.ok ? 'ok' : 'err';
});

document.getElementById('export-btn')!.addEventListener('click', () => {
  const blob = new Blob([store.toJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'diagram.json';
  a.click();
  URL.revokeObjectURL(a.href);
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
});
