import { SHAPE_ORDER } from './shapes';
import { SIDES } from './types';
import type { EdgeModel, Endpoint, NodeModel, NodeShape, Point, Side } from './types';

let counter = 0;
export const uid = (prefix: string) => `${prefix}${++counter}`;

/** Bump the id counter so generated ids never collide with loaded ones. */
function syncCounter(ids: string[]) {
  for (const id of ids) {
    const n = parseInt(id.replace(/^\D+/, ''), 10);
    if (!Number.isNaN(n) && n > counter) counter = n;
  }
}

export type Selection =
  | { type: 'none' }
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | { type: 'multi'; nodeIds: string[] };

export class Store {
  nodes: NodeModel[] = [];
  edges: EdgeModel[] = [];
  // Nodes support multi-select; edges are single-select.
  selectedNodes = new Set<string>();
  selectedEdge: string | null = null;

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

  // ---- selection -------------------------------------------------------

  /** Normalised view of the current selection for the inspector. */
  selection(): Selection {
    if (this.selectedEdge) return { type: 'edge', id: this.selectedEdge };
    const ids = [...this.selectedNodes];
    if (ids.length === 1) return { type: 'node', id: ids[0] };
    if (ids.length > 1) return { type: 'multi', nodeIds: ids };
    return { type: 'none' };
  }

  selectNode(id: string, additive = false) {
    this.selectedEdge = null;
    if (additive) {
      if (this.selectedNodes.has(id)) this.selectedNodes.delete(id);
      else this.selectedNodes.add(id);
    } else {
      this.selectedNodes = new Set([id]);
    }
    this.emit();
  }

  /** Replace the node selection wholesale (used by marquee). */
  setNodeSelection(ids: Iterable<string>) {
    this.selectedEdge = null;
    this.selectedNodes = new Set(ids);
    this.emit();
  }

  selectEdge(id: string) {
    this.selectedNodes.clear();
    this.selectedEdge = id;
    this.emit();
  }

  clearSelection() {
    if (this.selectedNodes.size === 0 && this.selectedEdge === null) return;
    this.selectedNodes.clear();
    this.selectedEdge = null;
    this.emit();
  }

  addNode(at: Point, shape: NodeShape = 'rect'): NodeModel {
    const w = 120;
    const h = 60;
    const node: NodeModel = {
      id: uid('n'),
      label: `Box ${this.nodes.length + 1}`,
      shape,
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
    const nodeIds = this.selectedNodes;
    if (nodeIds.size) {
      // detach edges touching any deleted node, freezing them at the old anchor
      for (const e of this.edges) {
        for (const key of ['source', 'target'] as const) {
          const ep = e[key];
          if (ep.kind === 'attached' && nodeIds.has(ep.nodeId)) {
            const p = anchorPoint(this.getNode(ep.nodeId), ep.side);
            e[key] = { kind: 'free', x: p?.x ?? 0, y: p?.y ?? 0 };
          }
        }
      }
      this.nodes = this.nodes.filter((n) => !nodeIds.has(n.id));
    }
    if (this.selectedEdge) {
      this.edges = this.edges.filter((e) => e.id !== this.selectedEdge);
    }
    this.selectedNodes = new Set();
    this.selectedEdge = null;
    this.emit();
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.selectedNodes = new Set();
    this.selectedEdge = null;
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
      if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) return false;
      if (!data.nodes.every(isValidNode)) return false;
      const ids = new Set<string>(data.nodes.map((n: NodeModel) => n.id));
      if (!data.edges.every((e: unknown) => isValidEdge(e, ids))) return false;
      // everything checks out — only now touch the store, so a bad file
      // can never leave it partially replaced
      this.nodes = data.nodes;
      this.edges = data.edges;
      this.selectedNodes = new Set();
      this.selectedEdge = null;
      syncCounter([...this.nodes.map((n) => n.id), ...this.edges.map((e) => e.id)]);
      this.emit();
      return true;
    } catch {
      return false;
    }
  }
}

// ---- import validation -----------------------------------------------

function isValidNode(v: unknown): v is NodeModel {
  const n = v as NodeModel;
  return (
    !!n &&
    typeof n === 'object' &&
    typeof n.id === 'string' &&
    typeof n.label === 'string' &&
    (n.shape === undefined || SHAPE_ORDER.includes(n.shape)) &&
    [n.x, n.y, n.w, n.h].every(Number.isFinite)
  );
}

function isValidEndpoint(v: unknown, nodeIds: Set<string>): v is Endpoint {
  const ep = v as Endpoint;
  if (!ep || typeof ep !== 'object') return false;
  if (ep.kind === 'attached') return nodeIds.has(ep.nodeId) && SIDES.includes(ep.side);
  if (ep.kind === 'free') return Number.isFinite(ep.x) && Number.isFinite(ep.y);
  return false;
}

function isValidEdge(v: unknown, nodeIds: Set<string>): v is EdgeModel {
  const e = v as EdgeModel;
  return (
    !!e &&
    typeof e === 'object' &&
    typeof e.id === 'string' &&
    (e.label === undefined || typeof e.label === 'string') &&
    isValidEndpoint(e.source, nodeIds) &&
    isValidEndpoint(e.target, nodeIds)
  );
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
