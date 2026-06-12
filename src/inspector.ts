import { anchorPoint, Store } from './state';
import type { Endpoint } from './types';

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
    const s = this.store.selection;
    return s ? `${s.type}:${s.id}` : null;
  }

  private maybeRender() {
    const k = this.key();
    if (k === this.lastKey) return; // same element selected; live edits handle visuals
    this.render();
  }

  private render() {
    this.lastKey = this.key();
    this.root.replaceChildren();
    const sel = this.store.selection;
    if (!sel) {
      this.root.append(hint('Nothing selected. Click a box or arrow.'));
      return;
    }
    if (sel.type === 'node') this.renderNode(sel.id);
    else this.renderEdge(sel.id);
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
      button('Delete box', 'danger', () => {
        this.store.selection = { type: 'node', id };
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
        this.store.selection = { type: 'edge', id };
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

function button(text: string, cls: string, onClick: () => void) {
  const b = document.createElement('button');
  b.className = `insp-btn ${cls}`;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}
