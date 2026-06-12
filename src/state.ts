import type { EdgeModel, NodeModel, Point, Side } from './types';

let counter = 0;
export const uid = (prefix: string) => `${prefix}${++counter}`;

/** Bump the id counter so generated ids never collide with loaded ones. */
function syncCounter(ids: string[]) {
  for (const id of ids) {
    const n = parseInt(id.replace(/^\D+/, ''), 10);
    if (!Number.isNaN(n) && n > counter) counter = n;
  }
}

export class Store {
  nodes: NodeModel[] = [];
  edges: EdgeModel[] = [];
  selection: { type: 'node' | 'edge'; id: string } | null = null;

  /** subscribers re-render on change */
  private listeners = new Set<() => void>();
  onChange(fn: () => void) {
    this.listeners.add(fn);
  }
  emit() {
    this.listeners.forEach((fn) => fn());
  }

  getNode(id: string) {
    return this.nodes.find((n) => n.id === id);
  }

  addNode(at: Point): NodeModel {
    const w = 120;
    const h = 60;
    const node: NodeModel = {
      id: uid('n'),
      label: `Box ${this.nodes.length + 1}`,
      x: at.x - w / 2,
      y: at.y - h / 2,
      w,
      h,
    };
    this.nodes.push(node);
    this.emit();
    return node;
  }

  addEdge(at: Point): EdgeModel {
    const edge: EdgeModel = {
      id: uid('e'),
      source: { kind: 'free', x: at.x - 50, y: at.y },
      target: { kind: 'free', x: at.x + 50, y: at.y },
    };
    this.edges.push(edge);
    this.emit();
    return edge;
  }

  deleteSelected() {
    if (!this.selection) return;
    if (this.selection.type === 'node') {
      const id = this.selection.id;
      this.nodes = this.nodes.filter((n) => n.id !== id);
      // detach any edges that pointed at it
      for (const e of this.edges) {
        for (const key of ['source', 'target'] as const) {
          const ep = e[key];
          if (ep.kind === 'attached' && ep.nodeId === id) {
            const p = anchorPoint(this.getNodeById(id), ep.side);
            e[key] = { kind: 'free', x: p?.x ?? 0, y: p?.y ?? 0 };
          }
        }
      }
    } else {
      this.edges = this.edges.filter((e) => e.id !== this.selection!.id);
    }
    this.selection = null;
    this.emit();
  }

  // Used only inside deleteSelected before removal completes.
  private getNodeById(id: string) {
    return this.nodes.find((n) => n.id === id);
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.selection = null;
    this.emit();
  }

  // ---- serialization ---------------------------------------------------

  toJSON(): string {
    return JSON.stringify({ nodes: this.nodes, edges: this.edges }, null, 2);
  }

  /** Replace contents from a JSON string. Returns false on malformed input. */
  load(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return false;
      this.nodes = data.nodes as NodeModel[];
      this.edges = data.edges as EdgeModel[];
      this.selection = null;
      syncCounter([...this.nodes.map((n) => n.id), ...this.edges.map((e) => e.id)]);
      this.emit();
      return true;
    } catch {
      return false;
    }
  }
}

/** Absolute point of a node's side anchor. */
export function anchorPoint(node: NodeModel | undefined, side: Side): Point | null {
  if (!node) return null;
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: node.y };
    case 'bottom':
      return { x: cx, y: node.y + node.h };
    case 'left':
      return { x: node.x, y: cy };
    case 'right':
      return { x: node.x + node.w, y: cy };
  }
}
