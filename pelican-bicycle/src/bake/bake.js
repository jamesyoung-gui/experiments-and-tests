// OWNER: baker. PLACEHOLDER: returns a static snapshot.
export function bakeSVG(svg) { return new XMLSerializer().serializeToString(svg); }
