import { SHAPE_ORDER, SHAPES, shapeIcon } from './shapes';
import type { NodeShape } from './types';

/** Build draggable palette tiles: one per shape, plus an arrow. */
export function buildPalette(container: HTMLElement) {
  for (const shape of SHAPE_ORDER) {
    container.append(tile('box', shape, SHAPES[shape].label, shapeIcon(shape)));
  }
  const arrow = document.createElement('div');
  arrow.className = 'palette-arrow';
  arrow.textContent = '→';
  container.append(tile('arrow', null, 'Arrow', arrow));
}

function tile(tool: 'box' | 'arrow', shape: NodeShape | null, label: string, icon: Element) {
  const div = document.createElement('div');
  div.className = 'palette-item';
  div.draggable = true;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'palette-icon';
  iconWrap.append(icon);
  div.append(iconWrap);

  const span = document.createElement('span');
  span.textContent = label;
  div.append(span);

  div.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/tool', tool);
    if (shape) e.dataTransfer?.setData('text/shape', shape);
  });
  return div;
}
