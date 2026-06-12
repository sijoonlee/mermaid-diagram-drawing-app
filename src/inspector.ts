import { SHAPE_ORDER, SHAPES } from './shapes';
import { anchorPoint, Store } from './state';
import type { Endpoint, NodeShape } from './types';

/**
 * Context panel for the current selection.
 * Rebuilds only when the *selected element* changes (type+id), so typing in a
 * field doesn't tear down and refocus the input on every keystroke.
 */
export class Inspector {
  private lastKey: string | null = null;

  constructor(
    private root: HTMLElement,
    private store: Store,
  ) {
    store.onChange(() => this.maybeRender());
    this.render();
  }

  private key() {
    const s = this.store.selection();
    switch (s.type) {
      case 'node':
      case 'edge':
        return `${s.type}:${s.id}`;
      case 'multi':
        return `multi:${s.nodeIds.join(',')}`;
      case 'none':
        return null;
    }
  }

  private maybeRender() {
    const k = this.key();
    if (k === this.lastKey) return; // same element selected; live edits handle visuals
    this.render();
  }

  private render() {
    this.lastKey = this.key();
    this.root.replaceChildren();
    const sel = this.store.selection();
    switch (sel.type) {
      case 'none':
        this.root.append(hint('Nothing selected. Click a box or arrow.'));
        return;
      case 'node':
        return this.renderNode(sel.id);
      case 'edge':
        return this.renderEdge(sel.id);
      case 'multi':
        return this.renderMulti(sel.nodeIds.length);
    }
  }

  private renderMulti(count: number) {
    this.root.append(tag('h3', `${count} boxes selected`));
    this.root.append(hint('Drag any selected box to move them together.'));
    this.root.append(
      button('Delete selected', 'danger', () => this.store.deleteSelected()),
    );
  }

  // ---- node -------------------------------------------------------------

  private renderNode(id: string) {
    const node = this.store.getNode(id);
    if (!node) return;
    this.root.append(tag('h3', 'Box'));

    const input = field('Label', node.label, (v) => {
      node.label = v;
      this.store.emit();
    });
    this.root.append(input);

    this.root.append(
      shapeSelect(node.shape ?? 'rect', (shape) => {
        node.shape = shape;
        this.store.emit();
      }),
    );

    this.root.append(
      button('Delete box', 'danger', () => {
        this.store.selectNode(id);
        this.store.deleteSelected();
      }),
    );
  }

  // ---- edge -------------------------------------------------------------

  private renderEdge(id: string) {
    const edge = this.store.edges.find((e) => e.id === id);
    if (!edge) return;
    this.root.append(tag('h3', 'Arrow'));

    this.root.append(
      field('Label', edge.label ?? '', (v) => {
        edge.label = v.trim() || undefined;
        this.store.emit();
      }),
    );

    this.root.append(this.endpointRow('Tail (source)', edge, 'source'));
    this.root.append(this.endpointRow('Head (target)', edge, 'target'));

    this.root.append(
      button('Swap ends', 'secondary', () => {
        const tmp = edge.source;
        edge.source = edge.target;
        edge.target = tmp;
        this.store.emit();
        this.render(); // structural change: refresh endpoint rows
      }),
    );
    this.root.append(
      button('Delete arrow', 'danger', () => {
        this.store.selectEdge(id);
        this.store.deleteSelected();
      }),
    );
  }

  private endpointRow(label: string, edge: { source: Endpoint; target: Endpoint }, which: 'source' | 'target') {
    const ep = edge[which];
    const row = document.createElement('div');
    row.className = 'insp-row';

    const desc = document.createElement('span');
    if (ep.kind === 'attached') {
      const node = this.store.getNode(ep.nodeId);
      desc.textContent = `${label}: ${node?.label ?? ep.nodeId} · ${ep.side}`;
    } else {
      desc.textContent = `${label}: unattached`;
    }
    row.append(desc);

    if (ep.kind === 'attached') {
      row.append(
        button('Detach', 'secondary small', () => {
          const p = anchorPoint(this.store.getNode(ep.nodeId), ep.side);
          // drop it free, nudged off the box so its handle is grabbable
          const dx = ep.side === 'left' ? -30 : ep.side === 'right' ? 30 : 0;
          const dy = ep.side === 'top' ? -30 : ep.side === 'bottom' ? 30 : 0;
          edge[which] = { kind: 'free', x: (p?.x ?? 0) + dx, y: (p?.y ?? 0) + dy };
          this.store.emit();
          this.render(); // structural change: refresh endpoint rows
        }),
      );
    }
    return row;
  }
}

// ---- tiny DOM helpers ----------------------------------------------------

function tag(name: string, text: string) {
  const el = document.createElement(name);
  el.textContent = text;
  return el;
}

function hint(text: string) {
  const el = document.createElement('p');
  el.className = 'hint';
  el.textContent = text;
  return el;
}

function field(label: string, value: string, onInput: (v: string) => void) {
  const wrap = document.createElement('label');
  wrap.className = 'insp-field';
  wrap.append(tag('span', label));
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  wrap.append(input);
  return wrap;
}

function shapeSelect(current: NodeShape, onChange: (s: NodeShape) => void) {
  const wrap = document.createElement('label');
  wrap.className = 'insp-field';
  wrap.append(tag('span', 'Shape'));
  const sel = document.createElement('select');
  for (const key of SHAPE_ORDER) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = SHAPES[key].label;
    if (key === current) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value as NodeShape));
  wrap.append(sel);
  return wrap;
}

function button(text: string, cls: string, onClick: () => void) {
  const b = document.createElement('button');
  b.className = `insp-btn ${cls}`;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}
