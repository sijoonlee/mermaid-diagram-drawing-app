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

  const idList = vertices.map((v) => v.id);
  const rank = computeRanks(idList, links);
  const auto = placeByRank(idList, rank, dir);
  // ids from the text become canvas ids; keep uid() ahead of them
  syncIdCounter(idList);

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

  const pos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const edges: EdgeModel[] = links.map((l) => {
    const [srcSide, tgtSide] = linkSides(l, rank, pos, dir);
    return {
      id: uid('e'),
      label: l.text?.trim() || undefined,
      source: { kind: 'attached', nodeId: l.start, side: srcSide },
      target: { kind: 'attached', nodeId: l.end, side: tgtSide },
    };
  });

  return { nodes, edges };
}

/**
 * Which box sides an edge should leave/enter. Forward edges follow the flow
 * direction; same-rank edges connect facing sides; back edges (loops) bow
 * out beside the flow, where the curve isn't buried under nodes and other
 * arrows.
 */
function linkSides(
  l: MermaidLink,
  rank: Map<string, number>,
  pos: Map<string, Point>,
  dir: string,
): [Side, Side] {
  const vertical = dir !== 'LR' && dir !== 'RL';
  const dr = rank.get(l.end)! - rank.get(l.start)!;
  if (dr === 0) {
    const a = pos.get(l.start)!;
    const b = pos.get(l.end)!;
    if (vertical) return b.x >= a.x ? ['right', 'left'] : ['left', 'right'];
    return b.y >= a.y ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  if (dr < 0) return vertical ? ['right', 'right'] : ['bottom', 'bottom'];
  switch (dir) {
    case 'LR': return ['right', 'left'];
    case 'RL': return ['left', 'right'];
    case 'BT': return ['top', 'bottom'];
    default: return ['bottom', 'top']; // TB / TD
  }
}

/**
 * Rank nodes by longest path from the roots via DFS, ignoring back edges
 * (so cycles like `retry --> task` don't collapse the ranking).
 */
function computeRanks(ids: string[], links: MermaidLink[]): Map<string, number> {
  const indeg = new Map(ids.map((id) => [id, 0]));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of links) {
    if (l.start === l.end) continue;
    indeg.set(l.end, indeg.get(l.end)! + 1);
    out.get(l.start)!.push(l.end);
  }

  const rank = new Map<string, number>();
  const inStack = new Set<string>();
  const visit = (id: string, r: number) => {
    if (inStack.has(id)) return; // back edge: a cycle member keeps its rank
    if ((rank.get(id) ?? -1) >= r) return; // already at least this deep
    rank.set(id, r);
    inStack.add(id);
    for (const next of out.get(id)!) visit(next, r + 1);
    inStack.delete(id);
  };
  const roots = ids.filter((id) => indeg.get(id) === 0);
  for (const root of roots) visit(root, 0);
  // pure cycles / disconnected cycle components have no root; start anywhere
  for (const id of ids) if (!rank.has(id)) visit(id, 0);
  return rank;
}

/** Each rank becomes a centred row (or column, for LR/RL). */
function placeByRank(ids: string[], rank: Map<string, number>, dir: string): Map<string, Point> {
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
