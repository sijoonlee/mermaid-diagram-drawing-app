import type { NodeShape } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export interface ShapeSpec {
  label: string; // human name, shown in palette / dropdown
  mermaid: string; // short name for the `@{ shape: ... }` syntax
  /**
   * Build the SVG for this shape inside the box (x,y,w,h).
   * `main` is the filled, selectable/clickable outline; `decorations` are
   * extra stroke-only flourishes (e.g. a cylinder's top rim).
   */
  render(x: number, y: number, w: number, h: number): {
    main: SVGElement;
    decorations: SVGElement[];
  };
}

const poly = (pts: Array<[number, number]>) =>
  svg('polygon', { points: pts.map(([x, y]) => `${x},${y}`).join(' ') });

export const SHAPES: Record<NodeShape, ShapeSpec> = {
  rect: {
    label: 'Rectangle',
    mermaid: 'rect',
    render: (x, y, w, h) => ({ main: svg('rect', { x, y, width: w, height: h }), decorations: [] }),
  },

  rounded: {
    label: 'Rounded',
    mermaid: 'rounded',
    render: (x, y, w, h) => ({
      main: svg('rect', { x, y, width: w, height: h, rx: 14 }),
      decorations: [],
    }),
  },

  stadium: {
    label: 'Stadium',
    mermaid: 'stadium',
    render: (x, y, w, h) => ({
      main: svg('rect', { x, y, width: w, height: h, rx: h / 2 }),
      decorations: [],
    }),
  },

  circle: {
    label: 'Circle',
    mermaid: 'circle',
    render: (x, y, w, h) => ({
      main: svg('ellipse', { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 }),
      decorations: [],
    }),
  },

  diamond: {
    label: 'Diamond',
    mermaid: 'diam',
    render: (x, y, w, h) => {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return {
        main: poly([
          [cx, y],
          [x + w, cy],
          [cx, y + h],
          [x, cy],
        ]),
        decorations: [],
      };
    },
  },

  hexagon: {
    label: 'Hexagon',
    mermaid: 'hex',
    render: (x, y, w, h) => {
      const i = Math.min(w * 0.18, h * 0.5);
      const cy = y + h / 2;
      return {
        main: poly([
          [x + i, y],
          [x + w - i, y],
          [x + w, cy],
          [x + w - i, y + h],
          [x + i, y + h],
          [x, cy],
        ]),
        decorations: [],
      };
    },
  },

  cylinder: {
    label: 'Cylinder',
    mermaid: 'cyl',
    render: (x, y, w, h) => {
      const rx = w / 2;
      const ry = Math.min(h * 0.14, 12);
      const left = x;
      const right = x + w;
      const topMid = y + ry;
      const botMid = y + h - ry;
      // body: left side down, front bottom curve, right side up, back top rim
      const body = svg('path', {
        d:
          `M ${left},${topMid} L ${left},${botMid} ` +
          `A ${rx},${ry} 0 0 0 ${right},${botMid} ` +
          `L ${right},${topMid} ` +
          `A ${rx},${ry} 0 0 1 ${left},${topMid} Z`,
      });
      // visible front of the top ellipse (the rim line)
      const rim = svg('path', {
        d: `M ${left},${topMid} A ${rx},${ry} 0 0 0 ${right},${topMid}`,
        class: 'node-deco',
      });
      return { main: body, decorations: [rim] };
    },
  },
};

export const SHAPE_ORDER: NodeShape[] = [
  'rect',
  'rounded',
  'stadium',
  'circle',
  'diamond',
  'hexagon',
  'cylinder',
];

/** Render a small standalone preview SVG (used for palette tiles). */
export function shapeIcon(shape: NodeShape, w = 40, h = 28): SVGSVGElement {
  const root = svg('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
  const { main, decorations } = SHAPES[shape].render(3, 3, w - 6, h - 6);
  main.setAttribute('class', 'icon-shape');
  root.appendChild(main);
  decorations.forEach((d) => root.appendChild(d));
  return root;
}
