import mermaid from 'mermaid';
import { syncIdCounter, uid } from './state';
import type { EdgeModel, NodeModel, NodeShape, Point, Side } from './types';

/** The slice of mermaid's flowchart DB we read (kept minimal on purpose). */
interface MermaidVertex {
  id: string;
  text?: string;
  type?: string;
}
interface MermaidLink {
  start: string;
  end: string;
  text?: string;
}
interface FlowDb {
  getVertices(): Map<string, MermaidVertex>;
  getEdges(): MermaidLink[];
  getDirection(): string | undefined;
}

/** mermaid shape names/aliases -> the shapes this editor supports. */
const SHAPE_MAP: Record<string, NodeShape> = {
  square: 'rect', rect: 'rect', rectangle: 'rect', proc: 'rect', process: 'rect',
  round: 'rounded', rounded: 'rounded', event: 'rounded',
  stadium: 'stadium', pill: 'stadium', terminal: 'stadium',
  circle: 'circle', circ: 'circle', doublecircle: 'circle', ellipse: 'circle',
  diamond: 'diamond', diam: 'diamond', decision: 'diamond', question: 'diamond',
  hexagon: 'hexagon', hex: 'hexagon', prepare: 'hexagon',
  cylinder: 'cylinder', cyl: 'cylinder', database: 'cylinder', db: 'cylinder',
};

const W = 120;
const H = 60;
const PITCH_X = 180;
const PITCH_Y = 140;
const MARGIN = 60;

export interface DrawnFlowchart {
  nodes: NodeModel[];
  edges: EdgeModel[];
}

/**
 * Parse mermaid text and lay it out as editable canvas nodes/edges.
 * `keepPositions` pins ids that already exist on the canvas so a
 * generate -> tweak -> draw round-trip doesn't scramble a manual layout.
 * Throws a user-readable error for invalid or non-flowchart text.
 */
export async function flowchartToModel(
  md: string,
  keepPositions: Map<string, Point> = new Map(),
): Promise<DrawnFlowchart> {
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(md);
  if (!diagram.type.startsWith('flow')) {
    throw new Error(`Only flowcharts can be drawn on the canvas (this is "${diagram.type}").`);
  }
  const dbApi = diagram.db as unknown as FlowDb;
  const vertices = [...dbApi.getVertices().values()];
  const ids = new Set(vertices.map((v) => v.id));
  const links = dbApi.getEdges().filter((l) => ids.has(l.start) && ids.has(l.end));
  const dir = (dbApi.getDirection() ?? 'TB').toUpperCase();

  const auto = autoLayout(vertices.map((v) => v.id), links, dir);
  // ids from the text become canvas ids; keep uid() ahead of them
  syncIdCounter(vertices.map((v) => v.id));

  const nodes: NodeModel[] = vertices.map((v) => {
    const p = keepPositions.get(v.id) ?? auto.get(v.id)!;
    return {
      id: v.id,
      label: v.text ?? v.id,
      shape: SHAPE_MAP[v.type ?? 'square'] ?? 'rect',
      x: p.x,
      y: p.y,
      w: W,
      h: H,
    };
  });

  const [srcSide, tgtSide] = edgeSides(dir);
  const edges: EdgeModel[] = links.map((l) => ({
    id: uid('e'),
    label: l.text?.trim() || undefined,
    source: { kind: 'attached', nodeId: l.start, side: srcSide },
    target: { kind: 'attached', nodeId: l.end, side: tgtSide },
  }));

  return { nodes, edges };
}

/** Which box sides an edge should leave/enter for the flow direction. */
function edgeSides(dir: string): [Side, Side] {
  switch (dir) {
    case 'LR': return ['right', 'left'];
    case 'RL': return ['left', 'right'];
    case 'BT': return ['top', 'bottom'];
    default: return ['bottom', 'top']; // TB / TD
  }
}

/**
 * Simple layered layout: Kahn's algorithm ranks nodes by longest path from
 * the roots (cycle leftovers are appended below), then each rank becomes a
 * centred row (or column, for LR/RL).
 */
function autoLayout(ids: string[], links: MermaidLink[], dir: string): Map<string, Point> {
  const indeg = new Map(ids.map((id) => [id, 0]));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of links) {
    if (l.start === l.end) continue;
    indeg.set(l.end, indeg.get(l.end)! + 1);
    out.get(l.start)!.push(l.end);
  }

  const rank = new Map<string, number>();
  const queue = ids.filter((id) => indeg.get(id) === 0);
  for (const id of queue) rank.set(id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of out.get(id)!) {
      rank.set(next, Math.max(rank.get(next) ?? 0, rank.get(id)! + 1));
      indeg.set(next, indeg.get(next)! - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  let tail = Math.max(-1, ...rank.values()) + 1;
  for (const id of ids) if (!rank.has(id)) rank.set(id, tail++);

  const byRank: string[][] = [];
  for (const id of ids) {
    const r = rank.get(id)!;
    (byRank[r] ??= []).push(id);
  }
  if (dir === 'BT' || dir === 'RL') byRank.reverse();

  const horizontal = dir === 'LR' || dir === 'RL';
  const widest = Math.max(...byRank.map((row) => row.length));
  const pos = new Map<string, Point>();
  byRank.forEach((row, r) => {
    row.forEach((id, i) => {
      const along = MARGIN + ((widest - row.length) / 2 + i) * (horizontal ? PITCH_Y : PITCH_X);
      const across = MARGIN + r * (horizontal ? PITCH_X : PITCH_Y);
      pos.set(id, horizontal ? { x: across, y: along } : { x: along, y: across });
    });
  });
  return pos;
}
