import {
  EvidenceElement,
  CandidateSampleEvidence,
  CandidateGroupEvidence
} from '../types/evidence';

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

const SENSITIVE_ATTRS = new Set([
  'type',
  'autocomplete',
  'password',
  'token',
  'auth',
  'cookie'
]);

const PRICE_BADGE_PATTERN = /([$€£₹¥]|USD|EUR|GBP|INR|CAD|AUD)\s*[\d,]+(\.\d{1,2})?|\b[\d,]+(\.\d{1,2})?\s*([$€£₹¥]|USD|EUR|GBP|INR)|(?:price|rs\.?|inr)\s*[\d,]+/i;

function cleanString(str: string | null | undefined, maxLen = 150): string {
  if (!str) return '';
  const collapsed = str.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLen ? collapsed.slice(0, maxLen) + '...' : collapsed;
}

function extractElement(element: Element, currentDepth = 0, maxDepth = 4): EvidenceElement | null {
  const tagName = element.tagName.toUpperCase();
  if (EXCLUDED_TAGS.has(tagName)) {
    return null;
  }

  const role = element.getAttribute('role') || undefined;
  const ariaLabel = cleanString(element.getAttribute('aria-label') || '', 100) || undefined;

  const classes = Array.from(element.classList).filter(
    (c) => !c.startsWith('pirates-v2-') && c.length < 50
  );

  const attributes: Record<string, string> = {};
  Array.from(element.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || name === 'style' || SENSITIVE_ATTRS.has(name)) {
      return;
    }
    if (name.startsWith('data-') || name === 'itemprop' || name === 'itemtype' || name === 'name') {
      const val = cleanString(attr.value, 100);
      if (val && !val.startsWith('data:image')) {
        attributes[name] = val;
      }
    }
  });

  let linkHref: string | undefined;
  if (element.tagName === 'A' && element.hasAttribute('href')) {
    const rawHref = element.getAttribute('href') || '';
    if (!rawHref.startsWith('javascript:') && !rawHref.startsWith('#')) {
      linkHref = cleanString(rawHref, 200);
    }
  }

  let imageSrc: string | undefined;
  let imageAlt: string | undefined;
  if (element.tagName === 'IMG') {
    const src =
      element.getAttribute('src') ||
      element.getAttribute('data-src') ||
      element.getAttribute('data-lazy-src') ||
      '';
    if (src && !src.startsWith('data:image/svg')) {
      imageSrc = cleanString(src, 200);
    }
    imageAlt = cleanString(element.getAttribute('alt') || '', 100) || undefined;
  }

  let directText = '';
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      directText += (node.textContent || '') + ' ';
    }
  });
  const textSnippet = cleanString(directText, 150) || undefined;

  const children: EvidenceElement[] = [];
  if (currentDepth < maxDepth) {
    Array.from(element.children).forEach((child) => {
      const parsedChild = extractElement(child, currentDepth + 1, maxDepth);
      if (parsedChild) {
        children.push(parsedChild);
      }
    });
  }

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id && !element.id.match(/^\d/) ? element.id : undefined,
    classes,
    role,
    ariaLabel,
    textSnippet,
    attributes,
    linkHref,
    imageSrc,
    imageAlt,
    children: children.length > 0 ? children : undefined
  };
}

function collectConciseSummary(element: Element) {
  const headings: string[] = [];
  const links: Array<{ text: string; href: string }> = [];
  const images: Array<{ src: string; alt?: string }> = [];
  const badgesOrPrices: string[] = [];
  const rawTexts: string[] = [];

  const headingEls = element.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
  headingEls.forEach((h) => {
    const text = cleanString(h.textContent, 120);
    if (text && !headings.includes(text)) {
      headings.push(text);
    }
  });

  const anchorEls = element.querySelectorAll('a[href]');
  anchorEls.forEach((a) => {
    const href = a.getAttribute('href');
    const text = cleanString(a.textContent, 100);
    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      links.push({ text, href: cleanString(href, 200) });
    }
  });

  const imgEls = element.querySelectorAll('img, picture img');
  imgEls.forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    const alt = img.getAttribute('alt') || undefined;
    if (src && !src.startsWith('data:image/svg')) {
      images.push({ src: cleanString(src, 200), alt: alt ? cleanString(alt, 80) : undefined });
    }
  });

  const allTextNodes = element.querySelectorAll('span, p, b, strong, em, div');
  allTextNodes.forEach((node) => {
    const text = cleanString(node.textContent, 100);
    if (!text) return;

    if (PRICE_BADGE_PATTERN.test(text)) {
      if (!badgesOrPrices.includes(text)) {
        badgesOrPrices.push(text);
      }
    } else if (text.length > 3 && !rawTexts.includes(text) && rawTexts.length < 8) {
      rawTexts.push(text);
    }
  });

  return {
    headings: headings.slice(0, 3),
    links: links.slice(0, 4),
    images: images.slice(0, 3),
    badgesOrPrices: badgesOrPrices.slice(0, 4),
    rawTexts: rawTexts.slice(0, 6)
  };
}

export function buildSampleEvidence(
  element: Element,
  sampleIndex: number,
  structuralSignature: string
): CandidateSampleEvidence {
  const clone = element.cloneNode(true) as Element;
  const root = extractElement(clone) || {
    tag: element.tagName.toLowerCase(),
    classes: [],
    attributes: {}
  };

  const conciseSummary = collectConciseSummary(clone);
  const fullText = (element.textContent || '').trim();

  return {
    sampleIndex,
    structuralSignature,
    textLength: fullText.length,
    elementCount: element.querySelectorAll('*').length + 1,
    root,
    conciseSummary
  };
}

export function buildCandidateGroupEvidence(
  groupId: string,
  cardSelector: string,
  matchCount: number,
  heuristicScore: number,
  structuralSignature: string,
  elements: Element[]
): CandidateGroupEvidence {
  const samplesToTake = elements.slice(0, 3);
  const samples = samplesToTake.map((el, idx) =>
    buildSampleEvidence(el, idx, structuralSignature)
  );

  const jsonString = JSON.stringify(samples);
  const totalEvidenceBytes = new TextEncoder().encode(jsonString).length;

  return {
    groupId,
    cardSelector,
    matchCount,
    heuristicScore,
    structuralSignature,
    sampleCount: samples.length,
    totalEvidenceBytes,
    samples
  };
}
