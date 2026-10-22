import { CandidateGroupEvidence } from './evidence';

export type CandidateTypeGuess =
  | 'product_card'
  | 'b2b_listing'
  | 'social_post'
  | 'profile_card'
  | 'article_entry'
  | 'site_navigation'
  | 'generic_repeating';

export interface RankingReason {
  type: 'boost' | 'penalty';
  label: string;
  scoreDelta: number;
}

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
  structuralSimilarity: number;
  candidateTypeGuess: CandidateTypeGuess;
  rankingReasons: RankingReason[];
  isChrome: boolean;
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
