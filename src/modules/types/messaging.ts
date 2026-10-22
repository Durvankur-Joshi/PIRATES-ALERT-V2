import { PageDiagnostics } from './diagnostics';

export type MessageType =
  | 'PING'
  | 'PONG'
  | 'GET_PAGE_DIAGNOSTICS'
  | 'PAGE_DIAGNOSTICS_RESPONSE'
  | 'HIGHLIGHT_CANDIDATE_GROUP'
  | 'CLEAR_HIGHLIGHTS'
  | 'ERROR';

export interface PingMessage {
  type: 'PING';
}

export interface PongMessage {
  type: 'PONG';
  version: string;
}

export interface GetPageDiagnosticsMessage {
  type: 'GET_PAGE_DIAGNOSTICS';
}

export interface PageDiagnosticsResponseMessage {
  type: 'PAGE_DIAGNOSTICS_RESPONSE';
  payload: PageDiagnostics;
}

export interface HighlightCandidateGroupMessage {
  type: 'HIGHLIGHT_CANDIDATE_GROUP';
  cardSelector: string;
}

export interface ClearHighlightsMessage {
  type: 'CLEAR_HIGHLIGHTS';
}

export interface ErrorMessage {
  type: 'ERROR';
  error: string;
}

export type ExtensionMessage =
  | PingMessage
  | PongMessage
  | GetPageDiagnosticsMessage
  | PageDiagnosticsResponseMessage
  | HighlightCandidateGroupMessage
  | ClearHighlightsMessage
  | ErrorMessage;
