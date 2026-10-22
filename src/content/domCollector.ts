import { CandidateGroup, PageDiagnostics } from '../modules/types/diagnostics';

const EXCLUDED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'HEADER',
  'FOOTER',
  'NAV',
  'ASIDE'
]);

function isExcluded(element: Element): boolean {
  if (EXCLUDED_TAGS.has(element.tagName.toUpperCase())) {
    return true;
  }
  const role = element.getAttribute('role')?.toLowerCase();
  if (role === 'navigation' || role === 'banner' || role === 'contentinfo') {
    return true;
  }
  return false;
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

function escapeCss(str: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(str);
  }
  return str.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function buildElementSelector(element: Element): string {
  if (element.id && !element.id.match(/^[0-9]/) && !element.id.includes(':')) {
    return `#${escapeCss(element.id)}`;
  }

  const tagName = element.tagName.toLowerCase();
  const classList = Array.from(element.classList).filter(
    (c) => !c.startsWith('pirates-v2-') && !c.includes(':') && c.length < 50
  );

  if (classList.length > 0) {
    return `${tagName}.${escapeCss(classList[0])}`;
  }

  return tagName;
}

function buildUniqueCardSelector(container: Element, sampleChild: Element): string {
  const containerSel = buildElementSelector(container);
  const childTag = sampleChild.tagName.toLowerCase();
  const childClasses = Array.from(sampleChild.classList).filter(
    (c) => !c.startsWith('pirates-v2-') && !c.includes(':') && c.length < 50
  );

  if (childClasses.length > 0) {
    return `${containerSel} > ${childTag}.${escapeCss(childClasses[0])}`;
  }

  return `${containerSel} > ${childTag}`;
}

function sanitizeSampleSnippet(element: Element): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const unwanted = clone.querySelectorAll(
    'script, style, noscript, svg, nav, header, footer, [style*="display: none"]'
  );
  unwanted.forEach((el) => el.remove());

  clone.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on') || attr.name.startsWith('data-reactroot')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  const rawHtml = clone.outerHTML;
  return rawHtml.length > 800 ? rawHtml.slice(0, 800) + '...' : rawHtml;
}

export function collectPageDiagnostics(): PageDiagnostics {
  const url = window.location.href;
  const hostname = window.location.hostname;
  const title = document.title;
  const timestamp = new Date().toISOString();

  const isRestricted =
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:');

  if (isRestricted) {
    return {
      url,
      hostname,
      title,
      timestamp,
      totalElements: 0,
      candidateGroups: [],
      hasRestrictedAccess: true,
      restrictionReason: 'Browser-internal system pages cannot be extracted.'
    };
  }

  const allElements = document.querySelectorAll('body *');
  const candidateGroups: CandidateGroup[] = [];

  const candidateContainers = document.querySelectorAll(
    'div, ul, ol, section, main, article, tbody'
  );

  let groupCounter = 0;

  candidateContainers.forEach((container) => {
    if (isExcluded(container)) return;

    const children = Array.from(container.children).filter((child) => {
      if (isExcluded(child)) return false;
      const style = window.getComputedStyle ? window.getComputedStyle(child) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      return true;
    });

    if (children.length < 3) return;

    const tagBuckets: Record<string, Element[]> = {};
    children.forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (!tagBuckets[tag]) {
        tagBuckets[tag] = [];
      }
      tagBuckets[tag].push(child);
    });

    Object.entries(tagBuckets).forEach(([tag, elements]) => {
      if (elements.length < 3) return;

      const firstEl = elements[0];
      const depth = getElementDepth(firstEl);
      if (depth < 2) return;

      const hasLinks = elements.some((el) => Boolean(el.querySelector('a[href]')));
      const hasImages = elements.some((el) => Boolean(el.querySelector('img, picture, [style*="background-image"]')));
      const avgTextDensity =
        elements.reduce((acc, el) => acc + computeTextDensity(el), 0) / elements.length;

      let confidence = 0.4;
      if (hasLinks) confidence += 0.25;
      if (hasImages) confidence += 0.15;
      if (elements.length >= 5 && elements.length <= 100) confidence += 0.1;
      if (avgTextDensity > 0.05 && avgTextDensity < 0.8) confidence += 0.1;
      confidence = Math.min(0.99, Math.round(confidence * 100) / 100);

      const cardSelector = buildUniqueCardSelector(container, firstEl);
      const containerSelector = buildElementSelector(container);

      const sampleSnippets = elements.slice(0, 2).map((el) => sanitizeSampleSnippet(el));

      candidateGroups.push({
        groupId: `group_${++groupCounter}_${tag}`,
        tag,
        containerSelector,
        cardSelector,
        count: elements.length,
        depth,
        textDensity: Math.round(avgTextDensity * 100) / 100,
        hasLinks,
        hasImages,
        confidence,
        sampleSnippets
      });
    });
  });

  candidateGroups.sort((a, b) => b.confidence * b.count - a.confidence * a.count);

  const topCandidateGroups = candidateGroups.slice(0, 8);

  return {
    url,
    hostname,
    title,
    timestamp,
    totalElements: allElements.length,
    candidateGroups: topCandidateGroups,
    hasRestrictedAccess: false
  };
}

const HIGHLIGHT_STYLE_ID = 'pirates-v2-highlight-style';
const HIGHLIGHT_CLASS = 'pirates-v2-candidate-highlight';

function ensureHighlightStyles(): void {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 2px dashed #00e5ff !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.3) !important;
      transition: outline 0.2s ease-in-out !important;
    }
  `;
  document.head.appendChild(style);
}

export function highlightCandidateElements(selector: string): number {
  ensureHighlightStyles();
  clearCandidateHighlights();

  try {
    const matched = document.querySelectorAll(selector);
    matched.forEach((el) => {
      el.classList.add(HIGHLIGHT_CLASS);
    });
    if (matched.length > 0 && typeof (matched[0] as HTMLElement).scrollIntoView === 'function') {
      matched[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return matched.length;
  } catch {
    return 0;
  }
}

export function clearCandidateHighlights(): void {
  const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  highlighted.forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
}
