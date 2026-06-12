import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

let renderSeq = 0;

export interface PreviewResult {
  ok: boolean;
  message: string;
}

/**
 * Validate + render mermaid markdown into the given container.
 * mermaid.parse throws on invalid syntax; that is our validation step.
 */
export async function validateAndRender(
  md: string,
  container: HTMLElement,
): Promise<PreviewResult> {
  try {
    await mermaid.parse(md); // throws on invalid syntax
    const id = `preview-${++renderSeq}`;
    const { svg } = await mermaid.render(id, md);
    container.innerHTML = svg;
    return { ok: true, message: '✓ Valid — preview rendered' };
  } catch (err) {
    container.innerHTML = '';
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `✗ Invalid mermaid:\n${message}` };
  }
}
