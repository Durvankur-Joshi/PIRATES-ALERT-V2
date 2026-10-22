import {
  computeStructuralSignature,
  computeStructuralSimilarity
} from './structuralSignature';
import { buildCandidateGroupEvidence } from '../evidence/reducer';
import { CandidateGroup } from '../types/diagnostics';

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

function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function isExcludedNode(element: Element): boolean {
  return EXCLUDED_TAGS.has(element.tagName.toUpperCase());
}

function isVisible(element: Element): boolean {
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
  }
  return true;
}

function getElementDepth(element: Element): number {
  let depth = 0;
  let curr: Element | null = element;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    depth++;
    curr = curr.parentElement;
  }
  return depth;
}

function computeTextDensity(element: Element): number {
  const text = (element.textContent || '').trim();
  const html = element.innerHTML || '';
  if (!html.length) return 0;
  return Math.min(1, text.length / html.length);
}

function buildElementSelector(element: Element): string {
  if (element.id && !element.id.match(/^\d/) && !element.id.includes(':')) {
    return `#${escapeCss(element.id)}`;
  }

  const tagName = element.tagName.toLowerCase();
  const classList = Array.from(element.classList).filter(
    (c) =>
      !c.startsWith('pirates-v2-') &&
      !c.includes(':') &&
      !c.match(/^[0-9]/) &&
      c.length < 40
  );

  if (classList.length > 0) {
    return `${tagName}.${escapeCss(classList[0])}`;
  }

  return tagName;
}

function buildSafeCandidateSelector(container: Element, sampleElement: Element, expectedCount: number): { selector: string; liveMatchCount: number; isAmbiguous: boolean } {
  const childTag = sampleElement.tagName.toLowerCase();
  const containerSel = buildElementSelector(container);

  const stableClasses = Array.from(sampleElement.classList).filter(
    (c) =>
      !c.startsWith('pirates-v2-') &&
      !c.includes(':') &&
      !c.match(/^[0-9]/) &&
      c.length < 40
  );

  const candidatesToTry: string[] = [];

  if (stableClasses.length > 0) {
    candidatesToTry.push(`${containerSel} > ${childTag}.${escapeCss(stableClasses[0])}`);
    candidatesToTry.push(`${childTag}.${escapeCss(stableClasses[0])}`);
  }

  candidatesToTry.push(`${containerSel} > ${childTag}`);

  for (const sel of candidatesToTry) {
    try {
      const matches = document.querySelectorAll(sel);
      if (matches.length > 0) {
        const isAmbiguous = Math.abs(matches.length - expectedCount) > 2;
        return {
          selector: sel,
          liveMatchCount: matches.length,
          isAmbiguous
        };
      }
    } catch {
      continue;
    }
  }

  const fallbackSel = `${containerSel} > ${childTag}`;
  let fallbackMatches = 0;
  try {
    fallbackMatches = document.querySelectorAll(fallbackSel).length;
  } catch {
    fallbackMatches = expectedCount;
  }

  return {
    selector: fallbackSel,
    liveMatchCount: fallbackMatches,
    isAmbiguous: fallbackMatches !== expectedCount
  };
}

interface RawCluster {
  container: Element;
  signature: string;
  elements: Element[];
}

export function discoverCandidateGroups(): CandidateGroup[] {
  const candidateContainers = document.querySelectorAll(
    'div, ul, ol, section, main, article, tbody, header, footer'
  );

  const clusters: RawCluster[] = [];

  candidateContainers.forEach((container) => {
    if (isExcludedNode(container) || !isVisible(container)) {
      return;
    }

    const children = Array.from(container.children).filter(
      (child) => !isExcludedNode(child) && isVisible(child)
    );

    if (children.length < 3) return;

    const signatureMap: Map<string, Element[]> = new Map();

    children.forEach((child) => {
      const sig = computeStructuralSignature(child);
      let matchedKey: string | null = null;

      for (const existingSig of signatureMap.keys()) {
        if (computeStructuralSimilarity(sig, existingSig) >= 0.75) {
          matchedKey = existingSig;
          break;
        }
      }

      if (matchedKey) {
        signatureMap.get(matchedKey)!.push(child);
      } else {
        signatureMap.set(sig, [child]);
      }
    });

    signatureMap.forEach((elements, signature) => {
      if (elements.length >= 3) {
        clusters.push({
          container,
          signature,
          elements
        });
      }
    });
  });

  const prunedClusters = clusters.filter((current, idx) => {
    return !clusters.some((other, otherIdx) => {
      if (idx === otherIdx) return false;
      const isParent = current.container.contains(other.container);
      return isParent && other.elements.length >= 3;
    });
  });

  let groupCounter = 0;
  const candidateGroups: CandidateGroup[] = [];

  prunedClusters.forEach((cluster) => {
    const { container, signature, elements } = cluster;
    const sample = elements[0];
    const depth = getElementDepth(sample);
    if (depth < 1) return;

    let score = 30;

    const consistency = elements.length / container.children.length;
    score += Math.round(consistency * 15);

    if (elements.length >= 4 && elements.length <= 60) {
      score += 15;
    } else if (elements.length > 60) {
      score += 10;
    }

    const distinctLinks = new Set<string>();
    let hasImages = false;
    let hasHeadings = false;
    let totalTextChars = 0;

    elements.forEach((el) => {
      const links = el.querySelectorAll('a[href]');
      links.forEach((a) => {
        const href = a.getAttribute('href');
        if (href && href !== '#' && !href.startsWith('javascript:')) {
          distinctLinks.add(href);
        }
      });

      if (!hasImages && el.querySelector('img, picture, [data-src]')) {
        hasImages = true;
      }

      if (!hasHeadings && el.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
        hasHeadings = true;
      }

      totalTextChars += (el.textContent || '').trim().length;
    });

    const avgTextChars = totalTextChars / elements.length;

    if (distinctLinks.size >= 2) {
      score += 15;
    }
    if (hasImages) {
      score += 15;
    }
    if (hasHeadings) {
      score += 10;
    }

    const isNavLike =
      elements.every((el) => el.tagName === 'LI' && el.children.length <= 1 && !el.querySelector('img')) &&
      avgTextChars < 20;

    if (isNavLike) {
      score -= 35;
    }

    const heuristicScore = Math.max(5, Math.min(98, score));
    const avgTextDensity =
      elements.reduce((acc, el) => acc + computeTextDensity(el), 0) / elements.length;

    const { selector, liveMatchCount, isAmbiguous } = buildSafeCandidateSelector(
      container,
      sample,
      elements.length
    );

    const groupId = `group_${++groupCounter}_${sample.tagName.toLowerCase()}`;
    const evidence = buildCandidateGroupEvidence(
      groupId,
      selector,
      liveMatchCount,
      heuristicScore,
      signature,
      elements
    );

    const sampleSnippets = elements.slice(0, 2).map((el) => {
      const raw = el.outerHTML;
      return raw.length > 600 ? raw.slice(0, 600) + '...' : raw;
    });

    candidateGroups.push({
      groupId,
      tag: sample.tagName.toLowerCase(),
      containerSelector: buildElementSelector(container),
      cardSelector: selector,
      count: elements.length,
      liveMatchCount,
      isAmbiguous,
      depth,
      textDensity: Math.round(avgTextDensity * 100) / 100,
      hasLinks: distinctLinks.size > 0,
      hasImages,
      heuristicScore,
      structuralSignature: signature,
      evidence,
      sampleSnippets
    });
  });

  candidateGroups.sort((a, b) => b.heuristicScore - a.heuristicScore);

  return candidateGroups.slice(0, 8);
}
