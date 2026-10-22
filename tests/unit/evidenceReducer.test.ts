import { describe, it, expect } from 'vitest';
import {
  buildSampleEvidence,
  buildCandidateGroupEvidence
} from '../../src/modules/evidence/reducer';

describe('Evidence Reducer Module', () => {
  it('strips scripts, styles, and unwanted tags while preserving content', () => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <script>alert("hack");</script>
      <style>.bad { color: red; }</style>
      <noscript>hidden</noscript>
      <a href="/item/42"><h3 class="name">Clean Wireless Keyboard</h3></a>
      <img src="https://example.com/kbd.png" alt="Keyboard" />
      <span class="price">$79.99</span>
      <button onclick="doSomething()">Click</button>
    `;

    const evidence = buildSampleEvidence(card, 0, 'DIV[A>H3+IMG+SPAN]');

    expect(evidence.sampleIndex).toBe(0);
    expect(evidence.root.tag).toBe('div');
    expect(evidence.conciseSummary.headings).toContain('Clean Wireless Keyboard');
    expect(evidence.conciseSummary.images[0].src).toBe('https://example.com/kbd.png');
    expect(evidence.conciseSummary.badgesOrPrices).toContain('$79.99');

    const jsonStr = JSON.stringify(evidence);
    expect(jsonStr).not.toContain('alert');
    expect(jsonStr).not.toContain('doSomething');
    expect(jsonStr).not.toContain('.bad');
  });

  it('bounds total evidence byte size under 8 KB for a group of samples', () => {
    const card1 = document.createElement('div');
    card1.innerHTML = '<h2>Title 1</h2><a href="/1">Link</a><p>' + 'A'.repeat(500) + '</p>';
    const card2 = document.createElement('div');
    card2.innerHTML = '<h2>Title 2</h2><a href="/2">Link</a><p>' + 'B'.repeat(500) + '</p>';
    const card3 = document.createElement('div');
    card3.innerHTML = '<h2>Title 3</h2><a href="/3">Link</a><p>' + 'C'.repeat(500) + '</p>';

    const groupEvidence = buildCandidateGroupEvidence(
      'group_1_div',
      'div.product-card',
      3,
      85,
      'DIV[H2+A+P]',
      [card1, card2, card3]
    );

    expect(groupEvidence.sampleCount).toBe(3);
    expect(groupEvidence.totalEvidenceBytes).toBeLessThan(8192);
  });
});
