import { describe, it, expect } from 'vitest';
import { collectPageDiagnostics } from '../../src/content/domCollector';

describe('DOM Non-Mutation Integrity', () => {
  it('does not alter innerHTML, classes, or attributes of the inspected DOM during diagnostics collection', () => {
    document.body.innerHTML = `
      <section class="listings">
        <div class="card" id="c1" data-custom="123">
          <h2>Item 1</h2>
          <a href="/link1">View</a>
        </div>
        <div class="card" id="c2" data-custom="124">
          <h2>Item 2</h2>
          <a href="/link2">View</a>
        </div>
        <div class="card" id="c3" data-custom="125">
          <h2>Item 3</h2>
          <a href="/link3">View</a>
        </div>
      </section>
    `;

    const beforeHtml = document.body.innerHTML;

    const diagnostics = collectPageDiagnostics();
    expect(diagnostics.candidateGroups.length).toBeGreaterThan(0);

    const afterHtml = document.body.innerHTML;
    expect(afterHtml).toBe(beforeHtml);
  });
});
