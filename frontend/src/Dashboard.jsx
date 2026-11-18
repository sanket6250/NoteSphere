import React, { useEffect, useState } from 'react';
import { Archive, Clock3, FileText, Folder, RefreshCw, Sparkles } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || '';

function formatDate(value) {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function DailyActivityChart({ points }) {
  const width = 760;
  const height = 210;
  const left = 38;
  const right = 10;
  const top = 14;
  const bottom = 34;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(4, slot * 0.56);

  return (
    <div className="chart-wrap">
      <svg className="activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notes created per day over the last 30 days">
        {[0, 0.5, 1].map((fraction) => {
          const y = top + plotHeight * fraction;
          return (
            <g key={fraction}>
              <line className="chart-grid-line" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="chart-axis-label" x={left - 8} y={y + 3} textAnchor="end">
                {Math.round(maxCount * (1 - fraction))}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const barHeight = point.count === 0 ? 2 : Math.max(4, (point.count / maxCount) * plotHeight);
          const x = left + index * slot + (slot - barWidth) / 2;
          const y = top + plotHeight - barHeight;
          const labelDate = new Date(`${point.date}T00:00:00`);
          const showLabel = index === 0 || index === points.length - 1 || index % 7 === 0;
          return (
            <g key={point.date} tabIndex={0}>
              <title>{`${labelDate.toLocaleDateString()}: ${point.count} ${point.count === 1 ? 'note' : 'notes'} created`}</title>
              <rect className="chart-bar" x={x} y={y} width={barWidth} height={barHeight} rx="3" />
              {showLabel && (
                <text className="chart-axis-label" x={left + index * slot + slot / 2} y={height - 10} textAnchor="middle">
                  {labelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Distribution({ items, onSelectFolder }) {
  if (!items.length) return <div className="empty-panel">No notes have been created yet.</div>;
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="distribution-list">
      {items.map((item) => {
        const content = (
          <>
            <span className="distribution-label">{item.name}</span>
            <span className="distribution-track">
              <span className="distribution-fill" style={{ width: `${(item.count / maxCount) * 100}%` }} />
            </span>
            <span className="distribution-count">{item.count}</span>
          </>
        );
        return item.folderId ? (
          <button
            type="button"
            className="distribution-item distribution-button"
            key={`${item.name}-${item.folderId}`}
            onClick={() => onSelectFolder(item.folderId)}
          >
            {content}
          </button>
        ) : (
          <div className="distribution-item" key={item.name}>{content}</div>
        );
      })}
    </div>
  );
}

function NoteActivity({ notes, onOpenNote }) {
  if (!notes.length) return <div className="empty-panel">Nothing to show here yet.</div>;
  return (
    <div className="activity-list">
      {notes.map((note) => (
        <button type="button" className="activity-row" key={note.id} onClick={() => onOpenNote(note)}>
          <FileText size={15} />
          <span className="activity-row-copy">
            <strong>{note.title || 'Untitled note'}</strong>
            <small>{note.folderName || 'Unfiled'} · {formatDate(note.updatedAt)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function DashboardPanel({ title, description, children, action }) {
  return (
    <section className="dashboard-panel">
      <div className="panel-heading">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard({ refreshKey, onOpenFolder, onOpenNote }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API}/api/dashboard`);
        if (!response.ok) throw new Error(`Could not load workspace statistics (${response.status}).`);
        const result = await response.json();
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not load workspace statistics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey, retry]);

  if (loading) {
    return <section className="productivity-dashboard"><div className="empty-panel">Loading workspace insights…</div></section>;
  }
  if (error) {
    return (
      <section className="productivity-dashboard">
        <div className="dashboard-panel dashboard-error" role="alert">
          <strong>Dashboard data is unavailable.</strong><span>{error}</span>
          <button type="button" className="secondary-action" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={14} /> Retry</button>
        </div>
      </section>
    );
  }
  if (!data) return null;

  return (
    <section className="productivity-dashboard">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">YOUR WORKSPACE, AT A GLANCE</span>
          <h1>Good ideas, in motion.</h1>
          <p>Real activity from your notes and folders.</p>
        </div>
        <span className="dashboard-updated"><Sparkles size={14} /> Live workspace data</span>
      </div>

      <div className="metric-grid">
        <article className="metric-card"><span className="metric-icon"><FileText size={18} /></span><span><strong className="metric-value">{data.totalNotes}</strong><small className="metric-label">Total notes</small></span></article>
        <article className="metric-card"><span className="metric-icon"><Folder size={18} /></span><span><strong className="metric-value">{data.totalFolders}</strong><small className="metric-label">Folders</small></span></article>
        <article className="metric-card"><span className="metric-icon"><Clock3 size={18} /></span><span><strong className="metric-value">{data.activeNotes}</strong><small className="metric-label">Active notes</small></span></article>
        <article className="metric-card"><span className="metric-icon"><Archive size={18} /></span><span><strong className="metric-value">{data.archivedNotes}</strong><small className="metric-label">Archived</small></span></article>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-column">
          <DashboardPanel title="Notes created" description="Daily activity over the last 30 days">
            <DailyActivityChart points={data.notesCreatedOverTime} />
          </DashboardPanel>
          <DashboardPanel title="Notes by folder" description="Select a folder to open it">
            <Distribution items={data.notesByFolder} onSelectFolder={onOpenFolder} />
          </DashboardPanel>
          <DashboardPanel title="Notes by type" description="Distribution across note templates">
            <Distribution items={data.notesByType} onSelectFolder={() => {}} />
          </DashboardPanel>
        </div>
        <div className="dashboard-column">
          <DashboardPanel title="Recently edited" description="Your latest updates">
            <NoteActivity notes={data.recentlyEdited} onOpenNote={onOpenNote} />
          </DashboardPanel>
          <DashboardPanel title="Most active folders" description="Folders with the most notes">
            {!data.mostActiveFolders.length
              ? <div className="empty-panel">Folders become active when they contain notes.</div>
              : <div className="activity-list">{data.mostActiveFolders.map((folder) => (
                <button type="button" className="activity-row" key={folder.folderId} onClick={() => onOpenFolder(folder.folderId)}>
                  <Folder size={15} />
                  <span className="activity-row-copy"><strong>{folder.name}</strong><small>{folder.noteCount} notes · {formatDate(folder.lastEdited)}</small></span>
                </button>
              ))}</div>}
          </DashboardPanel>
          <DashboardPanel title="Favorites" description="Notes you marked as favorites">
            <NoteActivity notes={data.favorites} onOpenNote={onOpenNote} />
          </DashboardPanel>
          <DashboardPanel title="Pinned notes" description="Quick access to important ideas">
            <NoteActivity notes={data.pinned} onOpenNote={onOpenNote} />
          </DashboardPanel>
        </div>
      </div>
    </section>
  );
}
