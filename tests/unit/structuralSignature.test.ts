import { describe, it, expect } from 'vitest';
import {
  computeStructuralSignature,
  computeStructuralSimilarity
} from '../../src/modules/discovery/structuralSignature';

describe('Structural Signature Module', () => {
  it('computes deterministic structural signatures for elements', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <h2>Product Title</h2>
      <a href="/link"><img src="/pic.jpg" alt="Pic" /></a>
      <span>$19.99</span>
    `;

    const sig = computeStructuralSignature(el);
    expect(sig).toContain('DIV[');
    expect(sig).toContain('H2');
    expect(sig).toContain('A');
    expect(sig).toContain(':LIH');
  });

  it('computes 1.0 similarity for identical structures', () => {
    const el1 = document.createElement('div');
    el1.innerHTML = '<h3>Title A</h3><img src="1.jpg" /><a href="/1">Link</a>';

    const el2 = document.createElement('div');
    el2.innerHTML = '<h3>Title B</h3><img src="2.jpg" /><a href="/2">Link</a>';

    const sig1 = computeStructuralSignature(el1);
    const sig2 = computeStructuralSignature(el2);

    expect(sig1).toBe(sig2);
    expect(computeStructuralSimilarity(sig1, sig2)).toBe(1.0);
  });

  it('computes low similarity for structurally divergent elements', () => {
    const el1 = document.createElement('div');
    el1.innerHTML = '<h3>Title</h3><img src="1.jpg" /><a href="/1">Link</a>';

    const el2 = document.createElement('li');
    el2.innerHTML = '<a href="/link">Nav Item</a>';

    const sig1 = computeStructuralSignature(el1);
    const sig2 = computeStructuralSignature(el2);

    const similarity = computeStructuralSimilarity(sig1, sig2);
    expect(similarity).toBeLessThan(0.6);
  });
});
