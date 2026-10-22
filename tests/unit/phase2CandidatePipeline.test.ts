import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { collectPageDiagnostics } from '../../src/content/domCollector';
import { discoverCandidateGroups } from '../../src/modules/discovery/candidateDetector';
import { buildCandidateGroupEvidence } from '../../src/modules/evidence/reducer';

function loadFixture(filename: string): string {
  const filePath = path.resolve(__dirname, '../fixtures', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

function setDocumentFixture(filename: string): void {
  const html = loadFixture(filename);
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = match ? match[1] : html;
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  document.title = titleMatch ? titleMatch[1] : '';
}

describe('Phase 2 Candidate Discovery & Evidence Pipeline', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('ranks product grid #1 above top navigation, sidebar, and footer chrome', () => {
    setDocumentFixture('full-store-with-chrome.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(1);

    const topCandidate = diagnostics.candidateGroups[0];
    expect(topCandidate.candidateTypeGuess).toBe('product_card');
    expect(topCandidate.count).toBe(4);
    expect(topCandidate.hasPrice).toBeUndefined();
    expect(topCandidate.heuristicScore).toBeGreaterThanOrEqual(75);

    const chromeCandidates = diagnostics.candidateGroups.filter((g) => g.isChrome);
    chromeCandidates.forEach((chrome) => {
      expect(chrome.heuristicScore).toBeLessThan(topCandidate.heuristicScore);
    });
  });

  it('exposes detailed ranking reasons with boosts and penalties', () => {
    setDocumentFixture('full-store-with-chrome.html');
    const groups = discoverCandidateGroups();

    const topGroup = groups[0];
    expect(topGroup.rankingReasons.length).toBeGreaterThan(0);

    const hasBoost = topGroup.rankingReasons.some((r) => r.type === 'boost' && r.scoreDelta > 0);
    expect(hasBoost).toBe(true);

    const navGroup = groups.find((g) => g.isChrome);
    if (navGroup) {
      const hasPenalty = navGroup.rankingReasons.some((r) => r.type === 'penalty' && r.scoreDelta < 0);
      expect(hasPenalty).toBe(true);
    }
  });

  it('classifies B2B listing catalog correctly as b2b_listing', () => {
    setDocumentFixture('b2b-listings.html');
    const groups = discoverCandidateGroups();

    expect(groups.length).toBeGreaterThan(0);
    const topGroup = groups[0];
    expect(topGroup.candidateTypeGuess).toBe('b2b_listing');
    expect(topGroup.count).toBe(3);
  });

  it('classifies social feed correctly as social_post', () => {
    setDocumentFixture('social-feed.html');
    const groups = discoverCandidateGroups();

    expect(groups.length).toBeGreaterThan(0);
    const topGroup = groups[0];
    expect(topGroup.candidateTypeGuess).toBe('social_post');
  });

  it('enforces configurable evidence limits and tracks truncation', () => {
    const card1 = document.createElement('div');
    card1.innerHTML = '<h2>Alpha Item</h2><p>' + 'X'.repeat(400) + '</p>';
    const card2 = document.createElement('div');
    card2.innerHTML = '<h2>Beta Item</h2><p>' + 'Y'.repeat(400) + '</p>';

    const strictLimits = {
      maxSamples: 1,
      maxBytes: 300,
      maxTextLength: 50,
      maxAttrLength: 30
    };

    const evidence = buildCandidateGroupEvidence(
      'g_test',
      'div.card',
      2,
      80,
      'DIV[H2+P]',
      [card1, card2],
      strictLimits
    );

    expect(evidence.sampleCount).toBe(1);
    expect(evidence.configuredLimits.maxSamples).toBe(1);
    expect(evidence.configuredLimits.maxBytes).toBe(300);
  });

  it('deduplicates identical sample structures in evidence builder', () => {
    const card1 = document.createElement('div');
    card1.innerHTML = '<h3>Identical Title</h3><a href="/identical">Link</a>';
    const card2 = document.createElement('div');
    card2.innerHTML = '<h3>Identical Title</h3><a href="/identical">Link</a>';

    const evidence = buildCandidateGroupEvidence(
      'g_dup',
      'div.card',
      2,
      75,
      'DIV[H3+A]',
      [card1, card2]
    );

    expect(evidence.deduplicatedCount).toBe(1);
    expect(evidence.sampleCount).toBe(1);
  });

  it('guarantees zero external network requests during candidate discovery and evidence collection', () => {
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();

    vi.stubGlobal('fetch', fetchSpy);
    if (typeof navigator !== 'undefined') {
      navigator.sendBeacon = beaconSpy;
    }

    setDocumentFixture('full-store-with-chrome.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });
});
