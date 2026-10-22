const EXCLUDED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'IFRAME',
  'OBJECT',
  'EMBED'
]);

function getSubtreeSkeleton(element: Element, depth = 0, maxDepth = 3): string {
  if (depth > maxDepth) return '';

  const childTokens: string[] = [];
  Array.from(element.children).forEach((child) => {
    const tag = child.tagName.toUpperCase();
    if (EXCLUDED_TAGS.has(tag)) return;

    if (depth < maxDepth && child.children.length > 0) {
      const nested = getSubtreeSkeleton(child, depth + 1, maxDepth);
      childTokens.push(nested ? `${tag}>${nested}` : tag);
    } else {
      childTokens.push(tag);
    }
  });

  return childTokens.slice(0, 8).join('+');
}

export function computeStructuralSignature(element: Element): string {
  const rootTag = element.tagName.toUpperCase();
  const skeleton = getSubtreeSkeleton(element, 0, 2);
  const hasLinks = element.querySelector('a[href]') ? 'L' : '';
  const hasImages = element.querySelector('img, picture') ? 'I' : '';
  const hasHeadings = element.querySelector('h1, h2, h3, h4, h5, h6') ? 'H' : '';

  const flags = [hasLinks, hasImages, hasHeadings].filter(Boolean).join('');
  const suffix = flags ? `:${flags}` : '';

  return `${rootTag}[${skeleton}]${suffix}`;
}

export function computeStructuralSimilarity(sigA: string, sigB: string): number {
  if (sigA === sigB) return 1.0;

  const getTokens = (sig: string) => {
    return new Set(sig.split(/[^A-Za-z0-9]+/).filter(Boolean));
  };

  const setA = getTokens(sigA);
  const setB = getTokens(sigB);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) {
      intersection++;
    }
  });

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0.0;
}
