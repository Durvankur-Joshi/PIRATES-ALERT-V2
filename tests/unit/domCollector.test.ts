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
      <header><nav><a>Home</a><a>Catalog</a></nav></header>
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
      <footer><span>Copyright 2026</span></footer>
    `;

    const diagnostics = collectPageDiagnostics();

    expect(diagnostics.title).toBe('Test Store');
    expect(diagnostics.hasRestrictedAccess).toBe(false);
    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);

    const topGroup = diagnostics.candidateGroups[0];
    expect(topGroup.count).toBe(4);
    expect(topGroup.hasLinks).toBe(true);
    expect(topGroup.hasImages).toBe(true);
    expect(topGroup.confidence).toBeGreaterThan(0.7);
    expect(topGroup.sampleSnippets.length).toBeGreaterThan(0);
  });

  it('ignores excluded navigation, header, and footer containers', () => {
    document.body.innerHTML = `
      <nav>
        <ul>
          <li><a href="/1">Link 1</a></li>
          <li><a href="/2">Link 2</a></li>
          <li><a href="/3">Link 3</a></li>
          <li><a href="/4">Link 4</a></li>
        </ul>
      </nav>
      <section class="posts">
        <article class="feed-item"><p>Post A</p><a href="/a">Read</a></article>
        <article class="feed-item"><p>Post B</p><a href="/b">Read</a></article>
        <article class="feed-item"><p>Post C</p><a href="/c">Read</a></article>
      </section>
    `;

    const diagnostics = collectPageDiagnostics();
    const candidateGroupSelectors = diagnostics.candidateGroups.map((g) => g.cardSelector);

    expect(candidateGroupSelectors.some((sel) => sel.includes('nav'))).toBe(false);
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
