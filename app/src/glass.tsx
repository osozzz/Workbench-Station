

// Web approximation of Apple's Liquid Glass, which has no web version. Each map pushes the backdrop
// outward near the edges and leaves the middle alone, so the glass bends what is behind it at its rim.
function lensMap(insetX: number, insetY: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="r"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs><rect width="400" height="400" fill="url(#r)"/><rect width="400" height="400" fill="url(#g)" style="mix-blend-mode:screen"/><rect x="${insetX}" y="${insetY}" width="${400 - 2 * insetX}" height="${400 - 2 * insetY}" fill="#808000" filter="url(#b)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function GlassFilters() {
  const lenses: [string, number, number, number][] = [["lens-bar", 16, 120, 46], ["lens-pill", 60, 120, 38]];
  return (
    <svg className="filters" aria-hidden="true">
      {lenses.map(([id, insetX, insetY, scale]) => (
        <filter key={id} id={id} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
          <feImage href={lensMap(insetX, insetY)} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      ))}
    </svg>
  );
}
