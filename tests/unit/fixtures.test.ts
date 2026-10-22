import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { collectPageDiagnostics } from '../../src/content/domCollector';

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

describe('HTML Fixtures Suite', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('correctly discovers repeated cards in ecommerce-stable.html', () => {
    setDocumentFixture('ecommerce-stable.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(4);
    expect(topGroup.hasLinks).toBe(true);
    expect(topGroup.hasImages).toBe(true);
    expect(topGroup.heuristicScore).toBeGreaterThanOrEqual(70);
    expect(topGroup.evidence.samples.length).toBeGreaterThanOrEqual(1);
    expect(topGroup.evidence.samples[0].conciseSummary.headings.length).toBeGreaterThan(0);
  });

  it('discovers cards with hashed or dynamic class names in ecommerce-hashed.html', () => {
    setDocumentFixture('ecommerce-hashed.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(4);
    expect(topGroup.heuristicScore).toBeGreaterThanOrEqual(65);
    expect(topGroup.evidence.samples[0].conciseSummary.badgesOrPrices.length).toBeGreaterThan(0);
  });

  it('discovers B2B listings with seller and price quotations in b2b-listings.html', () => {
    setDocumentFixture('b2b-listings.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(3);
    expect(topGroup.evidence.samples[0].conciseSummary.headings.length).toBeGreaterThan(0);
  });

  it('discovers social feed posts in social-feed.html', () => {
    setDocumentFixture('social-feed.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(3);
    expect(topGroup.hasLinks).toBe(true);
    expect(topGroup.hasImages).toBe(true);
  });

  it('scores simple navigation lists lower than rich content in nav-links.html', () => {
    setDocumentFixture('nav-links.html');
    const diagnostics = collectPageDiagnostics();

    if (diagnostics.candidateGroups.length > 0) {
      const topGroup = diagnostics.candidateGroups[0];
      expect(topGroup.heuristicScore).toBeLessThan(60);
    }
  });

  it('preserves legitimate listing content located inside semantic header in header-listings.html', () => {
    setDocumentFixture('header-listings.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const headerGroup = diagnostics.candidateGroups.find((g) =>
      g.containerSelector.includes('header') || g.cardSelector.includes('featured-card')
    );
    expect(headerGroup).toBeDefined();
    expect(headerGroup?.count).toBe(3);
  });

  it('excludes hidden and aria-hidden elements in hidden-elements.html', () => {
    setDocumentFixture('hidden-elements.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(3);
  });

  it('handles ambiguous selectors gracefully in ambiguous-selectors.html', () => {
    setDocumentFixture('ambiguous-selectors.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const hasGroup = diagnostics.candidateGroups.some((g) => g.count === 3);
    expect(hasGroup).toBe(true);
  });

  it('returns zero candidate groups cleanly on empty-page.html', () => {
    setDocumentFixture('empty-page.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBe(0);
    expect(diagnostics.hasRestrictedAccess).toBe(false);
  });

  it('enforces total evidence byte size under 8 KB on large-dom.html', () => {
    setDocumentFixture('large-dom.html');
    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);
    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.evidence.totalEvidenceBytes).toBeLessThan(8192);
  });
});
