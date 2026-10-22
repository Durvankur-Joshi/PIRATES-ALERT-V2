import { CandidateGroupEvidence } from './evidence';

export interface CandidateGroup {
  groupId: string;
  tag: string;
  containerSelector: string;
  cardSelector: string;
  count: number;
  liveMatchCount: number;
  isAmbiguous: boolean;
  depth: number;
  textDensity: number;
  hasLinks: boolean;
  hasImages: boolean;
  heuristicScore: number;
  structuralSignature: string;
  evidence: CandidateGroupEvidence;
  sampleSnippets: string[];
}

export interface PageDiagnostics {
  url: string;
  hostname: string;
  title: string;
  timestamp: string;
  totalElements: number;
  candidateGroups: CandidateGroup[];
  hasRestrictedAccess: boolean;
  restrictionReason?: string;
}
