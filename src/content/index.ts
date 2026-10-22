import {
  collectPageDiagnostics,
  highlightCandidateElements,
  clearCandidateHighlights
} from './domCollector';
import { ExtensionMessage } from '../modules/types/messaging';

function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', version: '2.0.0' });
    return false;
  }

  if (message.type === 'GET_PAGE_DIAGNOSTICS') {
    try {
      const diagnostics = collectPageDiagnostics();
      sendResponse({ type: 'PAGE_DIAGNOSTICS_RESPONSE', payload: diagnostics });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ type: 'ERROR', error: errorMsg });
    }
    return false;
  }

  if (message.type === 'HIGHLIGHT_CANDIDATE_GROUP') {
    const count = highlightCandidateElements(message.cardSelector);
    sendResponse({ success: true, count });
    return false;
  }

  if (message.type === 'CLEAR_HIGHLIGHTS') {
    clearCandidateHighlights();
    sendResponse({ success: true });
    return false;
  }

  return false;
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(handleMessage);
}
