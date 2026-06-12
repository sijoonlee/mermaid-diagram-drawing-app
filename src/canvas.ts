import { anchorPoint, Store } from './state';
import type { EdgeModel, Endpoint, Point, Side } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const ATTACH_RADIUS = 22; // px snap distance for endpoint -> anchor

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Resolve an endpoint to an absolute canvas point. */
function endpointPoint(store: Store, ep: Endpoint): Point {
  if (ep.kind === 'free') return { x: ep.x, y: ep.y };
  return anchorPoint(store.getNode(ep.nodeId), ep.side) ?? { x: 0, y: 0 };
}

/** Outward normal of a box side. */
const SIDE_NORMAL: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/**
 * Direction a curve should leave an endpoint:
 * - attached -> perpendicular to the box side (so it visibly honours top/bottom/…)
 * - free     -> straight toward the other end.
 */
function leaveDir(ep: Endpoint, self: Point, other: Point): Point {
  if (ep.kind === 'attached') return SIDE_NORMAL[ep.side];
  const dx = other.x - self.x;
  const dy = other.y - self.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Side-aware cubic bezier from a -> b given each end's leave direction. */
function bezierPath(a: Point, b: Point, da: Point, db: Point) {
  const off = Math.min(120, Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4));
  const c1 = { x: a.x + da.x * off, y: a.y + da.y * off };
  const c2 = { x: b.x + db.x * off, y: b.y + db.y * off };
  // midpoint at t=0.5 for label placement
  const mid = {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  };
  const d = `M ${a.x},${a.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
  return { d, mid };
}

export class Canvas {
  private svg: SVGSVGElement;
  // active gesture, tracked on the document so full re-renders don't break it
  private gesture:
    | { type: 'node'; id: string; dx: number; dy: number }
    | { type: 'endpoint'; edge: EdgeModel; which: 'source' | 'target' }
    | null = null;
  private hoverAnchor: { nodeId: string; side: Side } | null = null;

  constructor(
    svg: SVGSVGElement,
    private store: Store,
  ) {
    this.svg = svg;
    store.onChange(() => this.render());
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
    this.render();
  }

  /** Convert a mouse event to SVG-local coordinates (1 unit = 1px, no viewBox). */
  toLocal(e: { clientX: number; clientY: number }): Point {
    const r = this.svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ---- rendering -------------------------------------------------------

  render() {
    const s = this.store;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    this.svg.appendChild(this.arrowDefs());

    // edges under nodes
    for (const edge of s.edges) this.renderEdge(edge);
    for (const node of s.nodes) this.renderNode(node);
    // endpoints on top of everything so they stay grabbable
    for (const edge of s.edges) this.renderEndpoints(edge);
  }

  private arrowDefs(): SVGDefsElement {
    const defs = el('defs');
    const marker = el('marker', {
      id: 'arrowhead',
      markerWidth: 10,
      markerHeight: 10,
      refX: 8,
      refY: 3,
      orient: 'auto',
      markerUnits: 'strokeWidth',
    });
    marker.appendChild(el('path', { d: 'M0,0 L8,3 L0,6 Z', fill: '#475569' }));
    defs.appendChild(marker);
    return defs;
  }

  private renderNode(node: ReturnType<Store['getNode']> & {}) {
    const sel = this.store.selection;
    const rect = el('rect', {
      x: node.x,
      y: node.y,
      width: node.w,
      height: node.h,
      rx: 6,
      class: 'node-rect' + (sel?.type === 'node' && sel.id === node.id ? ' selected' : ''),
    });
    rect.addEventListener('mousedown', (e) => this.startNodeDrag(e, node.id));
    rect.addEventListener('dblclick', () => this.renameNode(node.id));
    this.svg.appendChild(rect);

    const label = el('text', {
      x: node.x + node.w / 2,
      y: node.y + node.h / 2,
      class: 'node-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    label.textContent = node.label;
    this.svg.appendChild(label);

    // side anchors
    for (const side of SIDES) {
      const p = anchorPoint(node, side)!;
      const active =
        this.hoverAnchor?.nodeId === node.id && this.hoverAnchor.side === side;
      const dot = el('circle', {
        cx: p.x,
        cy: p.y,
        r: 5,
        class: 'anchor' + (active ? ' active' : ''),
      });
      this.svg.appendChild(dot);
    }
  }

  private renderEdge(edge: EdgeModel) {
    const a = endpointPoint(this.store, edge.source);
    const b = endpointPoint(this.store, edge.target);
    const { d, mid } = bezierPath(
      a,
      b,
      leaveDir(edge.source, a, b),
      leaveDir(edge.target, b, a),
    );
    const selected =
      this.store.selection?.type === 'edge' && this.store.selection.id === edge.id;

    // wide invisible hit area so the thin curve is easy to click
    const hit = el('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 14 });
    const onPick = (e: MouseEvent) => {
      e.stopPropagation();
      this.select('edge', edge.id);
    };
    hit.addEventListener('mousedown', onPick);
    hit.addEventListener('dblclick', () => this.editEdgeLabel(edge.id));
    this.svg.appendChild(hit);

    const path = el('path', {
      d,
      fill: 'none',
      'marker-end': 'url(#arrowhead)',
      class: 'edge-line' + (selected ? ' selected' : ''),
    });
    this.svg.appendChild(path);

    if (edge.label?.trim()) this.renderEdgeLabel(edge.label.trim(), mid);
  }

  private renderEdgeLabel(text: string, at: Point) {
    const padX = 5;
    const charW = 7;
    const w = text.length * charW + padX * 2;
    const bg = el('rect', {
      x: at.x - w / 2,
      y: at.y - 11,
      width: w,
      height: 22,
      rx: 4,
      fill: '#fff',
      stroke: '#e2e2e6',
    });
    this.svg.appendChild(bg);
    const label = el('text', {
      x: at.x,
      y: at.y,
      class: 'edge-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    label.textContent = text;
    this.svg.appendChild(label);
  }

  private editEdgeLabel(id: string) {
    const edge = this.store.edges.find((e) => e.id === id);
    if (!edge) return;
    const next = prompt('Arrow label (leave blank to clear):', edge.label ?? '');
    if (next != null) {
      edge.label = next.trim() || undefined;
      this.store.emit();
    }
  }

  private renderEndpoints(edge: EdgeModel) {
    for (const which of ['source', 'target'] as const) {
      const ep = edge[which];
      const p = endpointPoint(this.store, ep);
      const handle = el('circle', {
        cx: p.x,
        cy: p.y,
        r: 7,
        class: 'endpoint' + (ep.kind === 'attached' ? ' attached' : ''),
      });
      handle.addEventListener('mousedown', (e) =>
        this.startEndpointDrag(e, edge, which),
      );
      this.svg.appendChild(handle);
    }
  }

  // ---- selection / editing --------------------------------------------

  private select(type: 'node' | 'edge', id: string) {
    this.store.selection = { type, id };
    this.store.emit();
  }

  clearSelection() {
    if (this.store.selection) {
      this.store.selection = null;
      this.store.emit();
    }
  }

  private renameNode(id: string) {
    const node = this.store.getNode(id);
    if (!node) return;
    const name = prompt('Box label:', node.label);
    if (name != null) {
      node.label = name;
      this.store.emit();
    }
  }

  // ---- gestures --------------------------------------------------------

  private startNodeDrag(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const node = this.store.getNode(id);
    if (!node) return;
    const m = this.toLocal(e);
    this.gesture = { type: 'node', id, dx: m.x - node.x, dy: m.y - node.y };
    this.select('node', id);
  }

  private startEndpointDrag(
    e: MouseEvent,
    edge: EdgeModel,
    which: 'source' | 'target',
  ) {
    e.preventDefault();
    e.stopPropagation();
    this.gesture = { type: 'endpoint', edge, which };
    this.select('edge', edge.id);
  }

  private onMove = (e: MouseEvent) => {
    if (!this.gesture) return;
    const m = this.toLocal(e);

    if (this.gesture.type === 'node') {
      const node = this.store.getNode(this.gesture.id);
      if (node) {
        node.x = m.x - this.gesture.dx;
        node.y = m.y - this.gesture.dy;
        this.store.emit();
      }
      return;
    }

    // endpoint drag: snap to nearest anchor within radius
    const near = this.nearestAnchor(m);
    this.hoverAnchor = near?.ref ?? null;
    const ep = this.gesture.edge[this.gesture.which];
    if (near) {
      this.gesture.edge[this.gesture.which] = {
        kind: 'attached',
        nodeId: near.ref.nodeId,
        side: near.ref.side,
      };
    } else {
      // keep it free, following the cursor
      this.gesture.edge[this.gesture.which] = { kind: 'free', x: m.x, y: m.y };
    }
    void ep;
    this.store.emit();
  };

  private onUp = () => {
    if (this.gesture?.type === 'endpoint') this.hoverAnchor = null;
    if (this.gesture) {
      this.gesture = null;
      this.store.emit();
    }
  };

  private nearestAnchor(p: Point): { ref: { nodeId: string; side: Side }; d: number } | null {
    let best: { ref: { nodeId: string; side: Side }; d: number } | null = null;
    for (const node of this.store.nodes) {
      for (const side of SIDES) {
        const a = anchorPoint(node, side)!;
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d <= ATTACH_RADIUS && (!best || d < best.d)) {
          best = { ref: { nodeId: node.id, side }, d };
        }
      }
    }
    return best;
  }
}
