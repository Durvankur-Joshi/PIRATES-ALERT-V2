import React, { useState, useEffect } from 'react';
import { PRESET_SCHEMAS, RecordPresetType } from '../modules/types/schema';
import { PageDiagnostics, CandidateGroup, CandidateTypeGuess } from '../modules/types/diagnostics';
import { ExtensionMessage } from '../modules/types/messaging';

function formatCandidateType(type: CandidateTypeGuess): string {
  switch (type) {
    case 'product_card':
      return 'Likely E-Commerce Product';
    case 'b2b_listing':
      return 'Likely B2B Marketplace Listing';
    case 'social_post':
      return 'Likely Social Media Post';
    case 'profile_card':
      return 'Likely Member / Profile Card';
    case 'article_entry':
      return 'Likely Article Entry';
    case 'site_navigation':
      return 'Site Navigation (Downranked)';
    case 'generic_repeating':
    default:
      return 'Generic Repeating Section';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'rules' | 'settings'>('diagnostics');
  const [selectedPreset, setSelectedPreset] = useState<RecordPresetType>('ecommerce');
  const [diagnostics, setDiagnostics] = useState<PageDiagnostics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [showReasonsGroupId, setShowReasonsGroupId] = useState<string | null>(null);
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

      <div className="privacy-banner">
        <span>✓</span>
        <span>Phase 2 Local Mode — Zero External AI Calls / No Page Data Transmitted Externally</span>
      </div>

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

      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          Candidate Discovery
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
              {loading ? 'Inspecting DOM...' : 'Inspect & Rank Candidate Groups'}
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
                      Ranked Candidates ({diagnostics.candidateGroups.length})
                    </div>

                    {diagnostics.candidateGroups.length === 0 ? (
                      <div className="empty-state">
                        <span>No repeating candidate sections detected on this page.</span>
                      </div>
                    ) : (
                      diagnostics.candidateGroups.map((group, rankIdx) => {
                        const isExpanded = expandedGroupId === group.groupId;
                        const isShowingReasons = showReasonsGroupId === group.groupId;
                        const isHighlighted = highlightedSelector === group.cardSelector;

                        return (
                          <div
                            key={group.groupId}
                            className={`candidate-card ${group.isChrome ? 'chrome-item' : ''}`}
                          >
                            <div className="candidate-header">
                              <span className="candidate-selector" title={group.cardSelector}>
                                #{rankIdx + 1} {group.cardSelector}
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
                                Score: {group.heuristicScore}/100
                              </span>
                            </div>

                            <div className="candidate-subrow">
                              <span className="type-guess-badge">
                                {formatCandidateType(group.candidateTypeGuess)}
                              </span>
                              <span className="structural-chip" title={group.structuralSignature}>
                                Sig: {group.structuralSignature}
                              </span>
                            </div>

                            <div className="candidate-metrics">
                              <span className="metric-item">
                                <strong>{group.count}</strong> items
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
                                Similarity: {Math.round(group.structuralSimilarity * 100)}%
                              </span>
                              <span className="metric-item">
                                Depth: {group.depth}
                              </span>
                            </div>

                            <div className="candidate-actions">
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn-secondary"
                                  onClick={() =>
                                    setExpandedGroupId(isExpanded ? null : group.groupId)
                                  }
                                >
                                  {isExpanded ? 'Hide Evidence' : 'View Evidence'}
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() =>
                                    setShowReasonsGroupId(isShowingReasons ? null : group.groupId)
                                  }
                                >
                                  {isShowingReasons ? 'Hide Signals' : `Signals (${group.rankingReasons.length})`}
                                </button>
                              </div>

                              <button
                                className="btn-secondary"
                                onClick={() => handleHighlight(group)}
                                style={{
                                  borderColor: isHighlighted ? 'var(--accent-cyan)' : undefined,
                                  color: isHighlighted ? 'var(--accent-cyan)' : undefined
                                }}
                              >
                                {isHighlighted ? 'Highlighted' : 'Highlight'}
                              </button>
                            </div>

                            {isShowingReasons && (
                              <div className="reasons-box">
                                {group.rankingReasons.map((r, i) => (
                                  <div key={i} className="reason-item">
                                    <strong className={r.type === 'boost' ? 'reason-boost' : 'reason-penalty'}>
                                      {r.scoreDelta > 0 ? `+${r.scoreDelta}` : r.scoreDelta}
                                    </strong>
                                    <span>{r.label}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isExpanded && group.evidence && (
                              <div className="preview-structured">
                                <div className="preview-meta-row">
                                  <span>
                                    Evidence Size: {group.evidence.totalEvidenceBytes} / {group.evidence.configuredLimits.maxBytes} bytes
                                  </span>
                                  <span>
                                    Samples: {group.evidence.sampleCount} | Truncated: {group.evidence.isTruncated ? 'Yes' : 'No'}
                                  </span>
                                </div>

                                {group.evidence.samples.map((s, idx) => (
                                  <div key={idx} className="preview-item-row">
                                    <strong>Sample Item #{idx + 1}</strong>

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
              <span>Click "Inspect & Rank Candidate Groups" to scan the active page for candidate listing cards, feeds, or directories.</span>
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
