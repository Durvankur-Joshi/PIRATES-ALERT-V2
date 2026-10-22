import { PageDiagnostics } from '../modules/types/diagnostics';
import { discoverCandidateGroups } from '../modules/discovery/candidateDetector';

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
      restrictionReason: 'Browser-internal system pages cannot be inspected.'
    };
  }

  const allElements = document.querySelectorAll('body *');
  const candidateGroups = discoverCandidateGroups();

  return {
    url,
    hostname,
    title,
    timestamp,
    totalElements: allElements.length,
    candidateGroups,
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
