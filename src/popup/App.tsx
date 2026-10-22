import React, { useState, useEffect } from 'react';
import { PRESET_SCHEMAS, RecordPresetType } from '../modules/types/schema';
import { PageDiagnostics, CandidateGroup } from '../modules/types/diagnostics';
import { ExtensionMessage } from '../modules/types/messaging';

export default function App() {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'rules' | 'settings'>('diagnostics');
  const [selectedPreset, setSelectedPreset] = useState<RecordPresetType>('ecommerce');
  const [diagnostics, setDiagnostics] = useState<PageDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [highlightedSelector, setHighlightedSelector] = useState<string | null>(null);

  const activePresetConfig = PRESET_SCHEMAS[selectedPreset];

  useEffect(() => {
    checkConnection();
  }, []);

  async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      return null;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  }

  async function checkConnection(): Promise<boolean> {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setConnected(false);
      return false;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' } as ExtensionMessage);
      const isOk = response?.type === 'PONG';
      setConnected(isOk);
      return isOk;
    } catch {
      setConnected(false);
      return false;
    }
  }

  async function handleInspectPage(): Promise<void> {
    setLoading(true);
    setError(null);

    const tab = await getActiveTab();
    if (!tab?.id) {
      setLoading(false);
      setError('No active browser tab found. Open a webpage and try again.');
      return;
    }

    const tabUrl = tab.url || '';
    if (
      tabUrl.startsWith('chrome://') ||
      tabUrl.startsWith('chrome-extension://') ||
      tabUrl.startsWith('edge://') ||
      tabUrl.startsWith('about:') ||
      tabUrl.startsWith('view-source:')
    ) {
      setLoading(false);
      setDiagnostics({
        url: tabUrl,
        hostname: 'system',
        title: tab.title || 'System Page',
        timestamp: new Date().toISOString(),
        totalElements: 0,
        candidateGroups: [],
        hasRestrictedAccess: true,
        restrictionReason: 'Browser-internal system pages (chrome://, edge://, about:) cannot be inspected or extracted.'
      });
      return;
    }

    try {
      let isAlive = await checkConnection();
      if (!isAlive && chrome.scripting && chrome.scripting.executeScript) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          isAlive = await checkConnection();
        } catch {
          isAlive = false;
        }
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_PAGE_DIAGNOSTICS'
      } as ExtensionMessage);

      if (response?.type === 'PAGE_DIAGNOSTICS_RESPONSE') {
        setDiagnostics(response.payload);
        setConnected(true);
      } else if (response?.type === 'ERROR') {
        setError(response.error);
      } else {
        setError('Unexpected diagnostics response from page content script.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Cannot communicate with page: ${msg}. Refresh the page and try again.`);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleHighlight(group: CandidateGroup): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'HIGHLIGHT_CANDIDATE_GROUP',
        cardSelector: group.cardSelector
      } as ExtensionMessage);
      setHighlightedSelector(group.cardSelector);
    } catch {
      setError('Failed to apply element highlight on page.');
    }
  }

  async function handleClearHighlight(): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'CLEAR_HIGHLIGHTS'
      } as ExtensionMessage);
      setHighlightedSelector(null);
    } catch {
      setError('Failed to clear highlights.');
    }
  }

  return (
    <div className="popup-container">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">PA</div>
          <span className="brand-title">PIRATES ALERT</span>
          <span className="brand-version">v2.0</span>
        </div>
        <div className="status-badge">
          {connected ? (
            <span className="badge badge-success">Tab Connected</span>
          ) : (
            <span className="badge badge-warning">Tab Idle</span>
          )}
        </div>
      </header>

      <section className="preset-card">
        <div className="preset-row">
          <span className="label-title">Target Schema Preset</span>
          <select
            className="preset-select"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value as RecordPresetType)}
          >
            {Object.values(PRESET_SCHEMAS).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fields-tags">
          {activePresetConfig.fields.map((f) => (
            <span
              key={f.name}
              className={`field-tag ${f.required ? 'required' : ''}`}
              title={f.description}
            >
              <span>{f.name}</span>
              <span className="field-type">{f.type}</span>
            </span>
          ))}
        </div>
      </section>

      <div className="disclaimer-box">
        Heuristic discovery identifies candidate clusters from DOM repetition patterns. Selecting a schema configures targets; extraction will run in Phase 4.
      </div>

      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          DOM Diagnostics
        </button>
        <button
          className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Saved Rules
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          AI & Proxy
        </button>
      </nav>

      {error && (
        <div className="notice-banner notice-warning">
          <strong>Notice</strong>
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <main className="diagnostics-panel">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={handleInspectPage}
              disabled={loading}
            >
              {loading ? 'Inspecting DOM...' : 'Inspect Page DOM Candidates'}
            </button>
            {highlightedSelector && (
              <button className="btn-secondary" onClick={handleClearHighlight}>
                Clear Highlights
              </button>
            )}
          </div>

          {diagnostics && (
            <>
              {diagnostics.hasRestrictedAccess ? (
                <div className="notice-banner notice-warning">
                  <strong>Restricted Page</strong>
                  <span>{diagnostics.restrictionReason}</span>
                </div>
              ) : (
                <>
                  <div className="meta-box">
                    <div className="meta-item">
                      <span>Host</span>
                      <span>{diagnostics.hostname || 'Unknown Host'}</span>
                    </div>
                    <div className="meta-item">
                      <span>Total Elements</span>
                      <span>{diagnostics.totalElements}</span>
                    </div>
                    <div className="meta-item" style={{ gridColumn: 'span 2' }}>
                      <span>Title</span>
                      <span>{diagnostics.title || 'Untitled Page'}</span>
                    </div>
                  </div>

                  <div className="candidate-list">
                    <div className="label-title">
                      Candidate Groups ({diagnostics.candidateGroups.length})
                    </div>

                    {diagnostics.candidateGroups.length === 0 ? (
                      <div className="empty-state">
                        <span>No repeating candidate sections detected on this page.</span>
                      </div>
                    ) : (
                      diagnostics.candidateGroups.map((group) => {
                        const isExpanded = expandedGroupId === group.groupId;
                        const isHighlighted = highlightedSelector === group.cardSelector;

                        return (
                          <div key={group.groupId} className="candidate-card">
                            <div className="candidate-header">
                              <span className="candidate-selector" title={group.cardSelector}>
                                {group.cardSelector}
                              </span>
                              <span
                                className={`score-badge ${
                                  group.heuristicScore >= 75
                                    ? 'score-high'
                                    : group.heuristicScore >= 50
                                    ? 'score-med'
                                    : 'score-low'
                                }`}
                              >
                                Heuristic Score: {group.heuristicScore}/100
                              </span>
                            </div>

                            <div className="structural-chip" title={group.structuralSignature}>
                              Sig: {group.structuralSignature}
                            </div>

                            <div className="candidate-metrics">
                              <span className="metric-item">
                                <strong>{group.count}</strong> items in container
                              </span>
                              <span className="metric-item">
                                <strong>{group.liveMatchCount}</strong> live matches
                              </span>
                              {group.isAmbiguous && (
                                <span className="badge badge-warning">
                                  Selector Ambiguous
                                </span>
                              )}
                              <span className="metric-item">
                                Depth: {group.depth}
                              </span>
                              <span className="metric-item">
                                {group.hasLinks && 'Links ✓ '}
                                {group.hasImages && 'Images ✓ '}
                              </span>
                            </div>

                            <div className="candidate-actions">
                              <button
                                className="btn-secondary"
                                onClick={() =>
                                  setExpandedGroupId(isExpanded ? null : group.groupId)
                                }
                              >
                                {isExpanded ? 'Hide Evidence' : 'Structured Evidence'}
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={() => handleHighlight(group)}
                                style={{
                                  borderColor: isHighlighted ? 'var(--accent-cyan)' : undefined,
                                  color: isHighlighted ? 'var(--accent-cyan)' : undefined
                                }}
                              >
                                {isHighlighted ? 'Highlighted' : 'Highlight on Page'}
                              </button>
                            </div>

                            {isExpanded && group.evidence && group.evidence.samples.length > 0 && (
                              <div className="preview-structured">
                                <span className="preview-section-title">
                                  Sample Evidence (Total Size: {group.evidence.totalEvidenceBytes} bytes)
                                </span>

                                {group.evidence.samples.slice(0, 2).map((s, idx) => (
                                  <div key={idx} className="preview-item-row">
                                    <strong>Item #{idx + 1}</strong>

                                    {s.conciseSummary.headings.length > 0 && (
                                      <div>
                                        <span className="label-title">Headings:</span>
                                        <div className="preview-tag-list">
                                          {s.conciseSummary.headings.map((h, i) => (
                                            <span key={i} className="preview-tag">{h}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {s.conciseSummary.badgesOrPrices.length > 0 && (
                                      <div>
                                        <span className="label-title">Badges/Prices:</span>
                                        <div className="preview-tag-list">
                                          {s.conciseSummary.badgesOrPrices.map((b, i) => (
                                            <span key={i} className="preview-tag" style={{ color: 'var(--accent-cyan)' }}>{b}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {s.conciseSummary.links.length > 0 && (
                                      <div>
                                        <span className="label-title">Links:</span>
                                        {s.conciseSummary.links.map((link, i) => (
                                          <div key={i} className="preview-link">
                                            {link.text ? `[${link.text}] ` : ''}{link.href}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {s.conciseSummary.images.length > 0 && (
                                      <div>
                                        <span className="label-title">Images:</span>
                                        {s.conciseSummary.images.map((img, i) => (
                                          <div key={i} className="preview-link">
                                            {img.src} {img.alt ? `(alt: ${img.alt})` : ''}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {!diagnostics && !loading && (
            <div className="empty-state">
              <span>Click "Inspect Page DOM Candidates" to scan the active page for repeating cards, feeds, or listings.</span>
            </div>
          )}
        </main>
      )}

      {activeTab === 'rules' && (
        <div className="empty-state">
          <span>Saved layout rules and version histories will appear here in Phase 5 & 6.</span>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="empty-state">
          <span>AI backend proxy configuration and token consumption metrics will appear here in Phase 3 & 6.</span>
        </div>
      )}
    </div>
  );
}
