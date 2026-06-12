/** Trigger a browser download of the given blob. */
export function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Standalone .svg file for a rendered diagram (e.g. the mermaid preview).
 * Mermaid sizes the inline preview responsively (max-width style); a file
 * needs explicit pixel dimensions so viewers open it at its natural size.
 */
export function svgBlob(svg: SVGSVGElement): Blob {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) {
    clone.setAttribute('width', String(Math.ceil(vb.width)));
    clone.setAttribute('height', String(Math.ceil(vb.height)));
    clone.style.maxWidth = '';
  }
  const xml = new XMLSerializer().serializeToString(clone);
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + xml], {
    type: 'image/svg+xml',
  });
}
