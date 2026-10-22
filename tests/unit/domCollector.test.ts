import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectPageDiagnostics,
  highlightCandidateElements,
  clearCandidateHighlights
} from '../../src/content/domCollector';

describe('DOM Diagnostics Collector', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('detects repeating candidate listing cards', () => {
    document.title = 'Test Store';
    document.body.innerHTML = `
      <main>
        <section class="products-grid">
          <div class="product-card">
            <a href="/item/1"><h2>Item One</h2></a>
            <img src="https://example.com/1.jpg" alt="1" />
            <span class="price">$19.99</span>
          </div>
          <div class="product-card">
            <a href="/item/2"><h2>Item Two</h2></a>
            <img src="https://example.com/2.jpg" alt="2" />
            <span class="price">$29.99</span>
          </div>
          <div class="product-card">
            <a href="/item/3"><h2>Item Three</h2></a>
            <img src="https://example.com/3.jpg" alt="3" />
            <span class="price">$39.99</span>
          </div>
          <div class="product-card">
            <a href="/item/4"><h2>Item Four</h2></a>
            <img src="https://example.com/4.jpg" alt="4" />
            <span class="price">$49.99</span>
          </div>
        </section>
      </main>
    `;

    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.title).toBe('Test Store');
    expect(diagnostics.hasRestrictedAccess).toBe(false);
    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);

    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(4);
    expect(topGroup.hasLinks).toBe(true);
    expect(topGroup.hasImages).toBe(true);
    expect(topGroup.heuristicScore).toBeGreaterThanOrEqual(70);
    expect(topGroup.evidence.samples.length).toBeGreaterThan(0);
  });

  it('excludes non-content script, style, and template tags from candidate clustering', () => {
    document.body.innerHTML = `
      <section class="posts">
        <script>const x = 1;</script>
        <style>.feed-item { display: block; }</style>
        <template><div class="feed-item">Template</div></template>
        <article class="feed-item"><p>Post A</p><a href="/a">Read</a></article>
        <article class="feed-item"><p>Post B</p><a href="/b">Read</a></article>
        <article class="feed-item"><p>Post C</p><a href="/c">Read</a></article>
      </section>
    `;

    const diagnostics = collectPageDiagnostics();
    const candidateGroupSelectors = diagnostics.candidateGroups.map((g) => g.cardSelector);

    expect(candidateGroupSelectors.some((sel) => sel.includes('script') || sel.includes('style') || sel.includes('template'))).toBe(false);
    expect(candidateGroupSelectors.some((sel) => sel.includes('feed-item') || sel.includes('article'))).toBe(true);
  });

  it('highlights and clears candidate elements correctly', () => {
    document.body.innerHTML = `
      <div class="container">
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
      </div>
    `;

    const highlightedCount = highlightCandidateElements('div.container > div.item');
    expect(highlightedCount).toBe(3);

    const highlightedEls = document.querySelectorAll('.pirates-v2-candidate-highlight');
    expect(highlightedEls.length).toBe(3);

    clearCandidateHighlights();
    const clearedEls = document.querySelectorAll('.pirates-v2-candidate-highlight');
    expect(clearedEls.length).toBe(0);
  });
});
