export interface CandidateGroup {
  groupId: string;
  tag: string;
  containerSelector: string;
  cardSelector: string;
  count: number;
  depth: number;
  textDensity: number;
  hasLinks: boolean;
  hasImages: boolean;
  confidence: number;
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
