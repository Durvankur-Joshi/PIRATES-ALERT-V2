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
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [highlightedSelector, setHighlightedSelector] = useState<string | null>(null);

  const activePresetConfig = PRESET_SCHEMAS[selectedPreset];

  useEffect(() => {
    checkConnection();
  }, []);

  async function getActiveTabId(): Promise<number | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      return null;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }

  async function checkConnection(): Promise<boolean> {
    const tabId = await getActiveTabId();
    if (!tabId) {
      setConnected(false);
      return false;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' } as ExtensionMessage);
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

    const tabId = await getActiveTabId();
    if (!tabId) {
      setLoading(false);
      setError('No active browser tab found. Open a webpage and try again.');
      return;
    }

    try {
      let isAlive = await checkConnection();
      if (!isAlive && chrome.scripting && chrome.scripting.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        isAlive = await checkConnection();
      }

      const response = await chrome.tabs.sendMessage(tabId, {
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
      setError(`Cannot communicate with page: ${msg}. Refresh the page or ensure permissions are granted.`);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleHighlight(group: CandidateGroup): Promise<void> {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'HIGHLIGHT_CANDIDATE_GROUP',
        cardSelector: group.cardSelector
      } as ExtensionMessage);
      setHighlightedSelector(group.cardSelector);
    } catch {
      setError('Failed to apply element highlight on page.');
    }
  }

  async function handleClearHighlight(): Promise<void> {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
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
            <span className="badge badge-success">Live Page Active</span>
          ) : (
            <span className="badge badge-warning">Page Inactive</span>
          )}
        </div>
      </header>

      <section className="preset-card">
        <div className="preset-row">
          <span className="label-title">Extraction Target</span>
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
              {loading ? 'Inspecting Live DOM...' : 'Inspect Page DOM Candidates'}
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
                        const isExpanded = expandedSnippetId === group.groupId;
                        const isHighlighted = highlightedSelector === group.cardSelector;

                        return (
                          <div key={group.groupId} className="candidate-card">
                            <div className="candidate-header">
                              <span className="candidate-selector" title={group.cardSelector}>
                                {group.cardSelector}
                              </span>
                              <span
                                className={`badge ${
                                  group.confidence >= 0.75
                                    ? 'badge-success'
                                    : group.confidence >= 0.5
                                    ? 'badge-warning'
                                    : 'badge-info'
                                }`}
                              >
                                {Math.round(group.confidence * 100)}% match
                              </span>
                            </div>

                            <div className="candidate-metrics">
                              <span className="metric-item">
                                <strong>{group.count}</strong> items
                              </span>
                              <span className="metric-item">
                                Depth: {group.depth}
                              </span>
                              <span className="metric-item">
                                {group.hasLinks && 'Links ? '}
                                {group.hasImages && 'Images ? '}
                              </span>
                            </div>

                            <div className="candidate-actions">
                              <button
                                className="btn-secondary"
                                onClick={() =>
                                  setExpandedSnippetId(isExpanded ? null : group.groupId)
                                }
                              >
                                {isExpanded ? 'Hide Snippet' : 'Sample Snippet'}
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

                            {isExpanded && group.sampleSnippets.length > 0 && (
                              <pre className="snippets-box">
                                {group.sampleSnippets[0]}
                              </pre>
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
