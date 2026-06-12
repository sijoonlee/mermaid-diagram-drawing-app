import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

let renderSeq = 0;

export interface PreviewResult {
  ok: boolean;
  message: string;
  /** True when a newer render started while this one was in flight. */
  stale: boolean;
}

/**
 * Validate + render mermaid markdown into the given container.
 * mermaid.parse throws on invalid syntax; that is our validation step.
 * Renders can overlap (live preview while typing); only the latest one
 * may touch the container.
 */
export async function validateAndRender(
  md: string,
  container: HTMLElement,
): Promise<PreviewResult> {
  const seq = ++renderSeq;
  const stale = () => seq !== renderSeq;
  try {
    await mermaid.parse(md); // throws on invalid syntax
    const { svg } = await mermaid.render(`preview-${seq}`, md);
    if (!stale()) container.innerHTML = svg;
    return { ok: true, message: '✓ Valid — preview rendered', stale: stale() };
  } catch (err) {
    if (!stale()) container.innerHTML = '';
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `✗ Invalid mermaid:\n${message}`, stale: stale() };
  }
}
