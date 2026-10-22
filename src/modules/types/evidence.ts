export interface EvidenceLimits {
  maxSamples: number;
  maxBytes: number;
  maxTextLength: number;
  maxAttrLength: number;
}

export const DEFAULT_EVIDENCE_LIMITS: EvidenceLimits = {
  maxSamples: 3,
  maxBytes: 8192,
  maxTextLength: 150,
  maxAttrLength: 100
};

export interface EvidenceElement {
  tag: string;
  id?: string;
  classes: string[];
  role?: string;
  ariaLabel?: string;
  textSnippet?: string;
  attributes: Record<string, string>;
  linkHref?: string;
  imageSrc?: string;
  imageAlt?: string;
  children?: EvidenceElement[];
}

export interface CandidateSampleEvidence {
  sampleIndex: number;
  structuralSignature: string;
  textLength: number;
  elementCount: number;
  root: EvidenceElement;
  conciseSummary: {
    headings: string[];
    links: Array<{ text: string; href: string }>;
    images: Array<{ src: string; alt?: string }>;
    badgesOrPrices: string[];
    rawTexts: string[];
  };
}

export interface CandidateGroupEvidence {
  groupId: string;
  cardSelector: string;
  matchCount: number;
  heuristicScore: number;
  structuralSignature: string;
  sampleCount: number;
  totalEvidenceBytes: number;
  isTruncated: boolean;
  deduplicatedCount: number;
  configuredLimits: EvidenceLimits;
  samples: CandidateSampleEvidence[];
}
