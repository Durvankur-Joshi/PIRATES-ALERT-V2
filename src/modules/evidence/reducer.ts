import {
  EvidenceElement,
  CandidateSampleEvidence,
  CandidateGroupEvidence,
  EvidenceLimits,
  DEFAULT_EVIDENCE_LIMITS
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

const PRICE_BADGE_PATTERN = /([$€£₹¥]|USD|EUR|GBP|INR|CAD|AUD)\s*[\d,]+(\.\d{1,2})?|\b[\d,]+(\.\d{1,2})?\s*([$€£₹¥]|USD|EUR|GBP|INR)|(?:price|rs\.?|inr|quotation|moq)\s*[\d,]+/i;

function cleanString(str: string | null | undefined, maxLen = 150): string {
  if (!str) return '';
  const collapsed = str.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLen ? collapsed.slice(0, maxLen) + '...' : collapsed;
}

function extractElement(
  element: Element,
  currentDepth: number,
  maxDepth: number,
  limits: EvidenceLimits
): EvidenceElement | null {
  const tagName = element.tagName.toUpperCase();
  if (EXCLUDED_TAGS.has(tagName)) {
    return null;
  }

  const role = element.getAttribute('role') || undefined;
  const ariaLabel = cleanString(element.getAttribute('aria-label') || '', limits.maxAttrLength) || undefined;

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
      const val = cleanString(attr.value, limits.maxAttrLength);
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
    imageAlt = cleanString(element.getAttribute('alt') || '', limits.maxAttrLength) || undefined;
  }

  let directText = '';
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      directText += (node.textContent || '') + ' ';
    }
  });
  const textSnippet = cleanString(directText, limits.maxTextLength) || undefined;

  const children: EvidenceElement[] = [];
  if (currentDepth < maxDepth) {
    Array.from(element.children).forEach((child) => {
      const parsedChild = extractElement(child, currentDepth + 1, maxDepth, limits);
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

function collectConciseSummary(element: Element, limits: EvidenceLimits) {
  const headings: string[] = [];
  const links: Array<{ text: string; href: string }> = [];
  const images: Array<{ src: string; alt?: string }> = [];
  const badgesOrPrices: string[] = [];
  const rawTexts: string[] = [];

  const headingEls = element.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], [class*="title"], [class*="heading"]');
  headingEls.forEach((h) => {
    const text = cleanString(h.textContent, limits.maxTextLength);
    if (text && !headings.includes(text)) {
      headings.push(text);
    }
  });

  const anchorEls = element.querySelectorAll('a[href]');
  anchorEls.forEach((a) => {
    const href = a.getAttribute('href');
    const text = cleanString(a.textContent, limits.maxTextLength);
    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      links.push({ text, href: cleanString(href, 200) });
    }
  });

  const imgEls = element.querySelectorAll('img, picture img');
  imgEls.forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    const alt = img.getAttribute('alt') || undefined;
    if (src && !src.startsWith('data:image/svg')) {
      images.push({ src: cleanString(src, 200), alt: alt ? cleanString(alt, limits.maxAttrLength) : undefined });
    }
  });

  const allTextNodes = element.querySelectorAll('span, p, b, strong, em, div, time');
  allTextNodes.forEach((node) => {
    const text = cleanString(node.textContent, limits.maxTextLength);
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
  structuralSignature: string,
  limits: EvidenceLimits = DEFAULT_EVIDENCE_LIMITS
): CandidateSampleEvidence {
  const clone = element.cloneNode(true) as Element;
  const root = extractElement(clone, 0, 4, limits) || {
    tag: element.tagName.toLowerCase(),
    classes: [],
    attributes: {}
  };

  const conciseSummary = collectConciseSummary(clone, limits);
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
  elements: Element[],
  limits: EvidenceLimits = DEFAULT_EVIDENCE_LIMITS
): CandidateGroupEvidence {
  const sampleCandidates = elements.slice(0, limits.maxSamples);
  const distinctSamples: CandidateSampleEvidence[] = [];
  const seenSignatures = new Set<string>();
  let deduplicatedCount = 0;

  sampleCandidates.forEach((el, idx) => {
    const sample = buildSampleEvidence(el, idx, structuralSignature, limits);
    const summaryKey = `${sample.conciseSummary.headings.join('|')}::${sample.conciseSummary.links.map((l) => l.href).join('|')}`;
    if (seenSignatures.has(summaryKey)) {
      deduplicatedCount++;
    } else {
      seenSignatures.add(summaryKey);
      distinctSamples.push(sample);
    }
  });

  if (distinctSamples.length === 0 && sampleCandidates.length > 0) {
    distinctSamples.push(buildSampleEvidence(sampleCandidates[0], 0, structuralSignature, limits));
  }

  let finalSamples = distinctSamples;
  let isTruncated = false;

  let jsonString = JSON.stringify(finalSamples);
  let totalBytes = new TextEncoder().encode(jsonString).length;

  while (totalBytes > limits.maxBytes && finalSamples.length > 1) {
    finalSamples.pop();
    isTruncated = true;
    jsonString = JSON.stringify(finalSamples);
    totalBytes = new TextEncoder().encode(jsonString).length;
  }

  if (totalBytes > limits.maxBytes) {
    isTruncated = true;
  }

  return {
    groupId,
    cardSelector,
    matchCount,
    heuristicScore,
    structuralSignature,
    sampleCount: finalSamples.length,
    totalEvidenceBytes: totalBytes,
    isTruncated,
    deduplicatedCount,
    configuredLimits: limits,
    samples: finalSamples
  };
}
