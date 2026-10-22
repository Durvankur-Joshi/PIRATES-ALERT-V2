import {
  computeStructuralSignature,
  computeStructuralSimilarity
} from './structuralSignature';
import { buildCandidateGroupEvidence } from '../evidence/reducer';
import {
  CandidateGroup,
  CandidateTypeGuess,
  RankingReason
} from '../types/diagnostics';
import { DEFAULT_EVIDENCE_LIMITS } from '../types/evidence';

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

const B2B_PATTERN = /\b(min(?:imum)?\s*order|moq|quotation|inquiry|rfq|supplier|exporter|manufacturer|wholesaler|pvt\s*ltd|corp|industrial|factory)\b/i;
const SOCIAL_PATTERN = /\b(repost|retweet|followers|following|posted|ago|likes?|repl(?:y|ies)|comments?)\b/i;
const ARTICLE_PATTERN = /\b(reading\s*time|min\s*read|published|author|byline|read\s*more|newsletter)\b/i;
const PRICE_PATTERN = /([$€£₹¥]|USD|EUR|GBP|INR|CAD|AUD)\s*[\d,]+(\.\d{1,2})?|\b[\d,]+(\.\d{1,2})?\s*([$€£₹¥]|USD|EUR|GBP|INR)|(?:price|rs\.?|inr)\s*[\d,]+/i;

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

function buildSafeCandidateSelector(
  container: Element,
  sampleElement: Element,
  expectedCount: number
): { selector: string; liveMatchCount: number; isAmbiguous: boolean } {
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
  averageSimilarity: number;
}

export function discoverCandidateGroups(): CandidateGroup[] {
  const candidateContainers = document.querySelectorAll(
    'div, ul, ol, section, main, article, tbody, header, footer, aside'
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
        let totalSim = 0;
        let count = 0;
        for (let i = 0; i < Math.min(elements.length, 5); i++) {
          for (let j = i + 1; j < Math.min(elements.length, 5); j++) {
            totalSim += computeStructuralSimilarity(
              computeStructuralSignature(elements[i]),
              computeStructuralSignature(elements[j])
            );
            count++;
          }
        }
        const averageSimilarity = count > 0 ? Math.round((totalSim / count) * 100) / 100 : 1.0;

        clusters.push({
          container,
          signature,
          elements,
          averageSimilarity
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
    const { container, signature, elements, averageSimilarity } = cluster;
    const sample = elements[0];
    const depth = getElementDepth(sample);
    if (depth < 1) return;

    let score = 30;
    const reasons: RankingReason[] = [];

    const consistency = elements.length / container.children.length;
    if (consistency >= 0.8) {
      score += 15;
      reasons.push({ type: 'boost', label: 'High container consistency (≥80% matching siblings)', scoreDelta: 15 });
    } else {
      score += Math.round(consistency * 10);
      reasons.push({ type: 'boost', label: 'Moderate container consistency', scoreDelta: Math.round(consistency * 10) });
    }

    if (elements.length >= 3 && elements.length <= 80) {
      score += 15;
      reasons.push({ type: 'boost', label: `Optimal candidate count (${elements.length} items)`, scoreDelta: 15 });
    } else if (elements.length > 80) {
      score += 5;
      reasons.push({ type: 'boost', label: `Large repeating list (${elements.length} items)`, scoreDelta: 5 });
    }

    const distinctLinks = new Set<string>();
    let hasImages = false;
    let hasHeadings = false;
    let hasPrice = false;
    let hasB2B = false;
    let hasSocial = false;
    let hasArticle = false;
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

      const text = (el.textContent || '').trim();
      totalTextChars += text.length;

      if (!hasPrice && PRICE_PATTERN.test(text)) {
        hasPrice = true;
      }
      if (!hasB2B && B2B_PATTERN.test(text)) {
        hasB2B = true;
      }
      if (!hasSocial && (SOCIAL_PATTERN.test(text) || el.querySelector('time'))) {
        hasSocial = true;
      }
      if (!hasArticle && ARTICLE_PATTERN.test(text)) {
        hasArticle = true;
      }
    });

    const avgTextChars = totalTextChars / elements.length;

    if (distinctLinks.size >= 2) {
      score += 15;
      reasons.push({ type: 'boost', label: `Distinct link destinations (${distinctLinks.size} links)`, scoreDelta: 15 });
    }
    if (hasImages) {
      score += 15;
      reasons.push({ type: 'boost', label: 'Contains thumbnail media or images', scoreDelta: 15 });
    }
    if (hasHeadings) {
      score += 10;
      reasons.push({ type: 'boost', label: 'Contains structured title/heading elements', scoreDelta: 10 });
    }
    if (hasPrice) {
      score += 15;
      reasons.push({ type: 'boost', label: 'Contains visible pricing or currency patterns', scoreDelta: 15 });
    }
    if (hasB2B) {
      score += 10;
      reasons.push({ type: 'boost', label: 'Contains supplier, quotation, or MOQ patterns', scoreDelta: 10 });
    }

    let candidateTypeGuess: CandidateTypeGuess = 'generic_repeating';
    if (hasPrice && !hasB2B) {
      candidateTypeGuess = 'product_card';
    } else if (hasB2B) {
      candidateTypeGuess = 'b2b_listing';
    } else if (hasSocial) {
      candidateTypeGuess = 'social_post';
    } else if (hasArticle) {
      candidateTypeGuess = 'article_entry';
    } else if (hasImages && hasHeadings) {
      candidateTypeGuess = 'profile_card';
    }

    const containerTag = container.tagName.toUpperCase();
    const containerClass = (container.className || '').toLowerCase();
    const isNavTag = containerTag === 'NAV' || container.closest('nav') !== null;
    const isFooterTag = containerTag === 'FOOTER' || container.closest('footer') !== null;
    const isAsideTag = containerTag === 'ASIDE';

    const isChromeContainer =
      isNavTag ||
      isFooterTag ||
      containerClass.includes('nav') ||
      containerClass.includes('menu') ||
      containerClass.includes('footer') ||
      containerClass.includes('cookie') ||
      containerClass.includes('sidebar-filter');

    const isNavLike =
      elements.every((el) => el.tagName === 'LI' && el.children.length <= 1 && !el.querySelector('img')) &&
      avgTextChars < 25;

    let isChrome = false;

    if (isNavLike || (isChromeContainer && !hasPrice && !hasImages && avgTextChars < 30)) {
      score -= 40;
      isChrome = true;
      candidateTypeGuess = 'site_navigation';
      reasons.push({
        type: 'penalty',
        label: 'Downranked: Site navigation or chrome (short text without media/pricing)',
        scoreDelta: -40
      });
    } else if (isAsideTag && !hasImages && !hasPrice) {
      score -= 15;
      isChrome = true;
      reasons.push({
        type: 'penalty',
        label: 'Downranked: Sidebar widget without media/pricing',
        scoreDelta: -15
      });
    }

    const heuristicScore = Math.max(5, Math.min(99, score));
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
      elements,
      DEFAULT_EVIDENCE_LIMITS
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
      structuralSimilarity: averageSimilarity,
      candidateTypeGuess,
      rankingReasons: reasons,
      isChrome,
      evidence,
      sampleSnippets
    });
  });

  candidateGroups.sort((a, b) => b.heuristicScore - a.heuristicScore);

  return candidateGroups.slice(0, 8);
}
