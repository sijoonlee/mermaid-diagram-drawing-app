export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface NodeModel {
  id: string;
  label: string;
  x: number; // top-left
  y: number;
  w: number;
  h: number;
}

/** An edge endpoint is either pinned to a node's side, or floating at a point. */
export type Endpoint =
  | { kind: 'attached'; nodeId: string; side: Side }
  | { kind: 'free'; x: number; y: number };

export interface EdgeModel {
  id: string;
  label?: string;
  source: Endpoint; // tail
  target: Endpoint; // head (arrowhead / "pointy" end)
}

export interface Point {
  x: number;
  y: number;
}
