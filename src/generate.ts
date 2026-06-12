import { SHAPES } from './shapes';
import type { Store } from './state';

/** Sanitize a label for use inside a mermaid `["..."]` node. */
function escapeLabel(label: string): string {
  return label.replace(/"/g, '&quot;');
}

/** Edge labels use `|...|`; pipes and quotes must be neutralised. */
function escapeEdgeLabel(label: string): string {
  return label.replace(/"/g, '&quot;').replace(/\|/g, '&#124;');
}

/**
 * Turn the visual model into flowchart markdown.
 * Side-attachment is an editor concern; mermaid lays the graph out itself,
 * so we only emit node-to-node edges for arrows whose BOTH ends are attached.
 */
export function generateMarkdown(store: Store): string {
  const lines: string[] = ['flowchart TD'];

  for (const n of store.nodes) {
    const shape = n.shape ?? 'rect';
    // mermaid rejects an empty quoted label (`n1[""]`); fall back to the id
    const label = escapeLabel(n.label.trim() || n.id);
    if (shape === 'rect') {
      lines.push(`    ${n.id}["${label}"]`);
    } else {
      // typed syntax (v11.3+) for the non-default shapes
      lines.push(`    ${n.id}@{ shape: ${SHAPES[shape].mermaid}, label: "${label}" }`);
    }
  }

  for (const e of store.edges) {
    if (e.source.kind === 'attached' && e.target.kind === 'attached') {
      const label = e.label?.trim();
      const arrow = label ? `-->|${escapeEdgeLabel(label)}|` : '-->';
      lines.push(`    ${e.source.nodeId} ${arrow} ${e.target.nodeId}`);
    }
  }

  return lines.join('\n');
}
