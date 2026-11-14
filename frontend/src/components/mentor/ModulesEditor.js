'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  addSubtopic, createModule, deleteModule, deleteSubtopic, getModules, placeResource, reorderModules, updateModule, updateSubtopic,
} from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const TYPE_ICON = { video: 'play', quiz: 'quiz', project: 'code' };
const TYPE_BG = { video: 'var(--tn-yellow)', quiz: 'var(--tn-sky)', project: '#C9F5DF' };

// Encodes a placement as "moduleId:subId" ("" = not in a module).
const placeKey = (m, s) => (m ? `${m}:${s || ''}` : '');

export default function ModulesEditor({ program, onChange }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [nm, setNm] = useState({ title: '', description: '', subs: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setData(await getModules(program._id)); } catch (e) { setError(e.message); }
  }, [program._id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, msg) => {
    try { await fn(); if (msg) toast(msg); await load(); onChange?.(); } catch (e) { toast(e.message, 'error'); }
  };

  async function addModule(e) {
    e.preventDefault();
    setBusy(true);
    await run(() => createModule(program._id, {
      title: nm.title, description: nm.description,
      subtopics: nm.subs.split('\n').map((t) => t.trim()).filter(Boolean).map((title) => ({ title })),
    }), `Module “${nm.title}” added`);
    setNm({ title: '', description: '', subs: '' });
    setBusy(false);
  }

  const moveModule = (i, dir) => {
    const ids = data.modules.map((m) => m._id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderModules(program._id, ids));
  };

  // every (module, sub-topic) target a mission can be moved to
  const targets = data ? [['', 'Not in a module'], ...data.modules.flatMap((m, mi) => [
    [placeKey(m._id), `${mi + 1}. ${m.title} (no sub-topic)`],
    ...m.subtopics.map((s, si) => [placeKey(m._id, s._id), `${mi + 1}.${si + 1} ${s.title}`]),
  ])] : [];
  const move = (r, key) => { const [m, s] = key.split(':'); run(() => placeResource(r._id, m || null, s || null), 'Mission moved'); };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Loading rows={3} />;

  return (
    <div className="tn-stack" style={{ gap: 24 }}>
      <div className="tn-stack" style={{ gap: 6 }}>
        <span className="tn-eyebrow">mentor@{program.name.toLowerCase().replace(/\s+/g, '_')}:~$ tree modules/</span>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Modules</h1>
        <span style={{ fontSize: 15, color: 'var(--tn-ink-2)', maxWidth: 760 }}>Organise missions as <b>Module → sub-topics → missions</b>. Mentees see this exact tree on their Launchpad. Tick <b>“lock until previous”</b> on a sub-topic to make mentees finish the one before it first.</span>
      </div>

      <section className="tn-row" style={{ gap: 26, alignItems: 'flex-start' }}>
        <div className="tn-stack" style={{ flex: '2 1 520px', minWidth: 0, gap: 16 }}>
          {data.modules.length === 0 && <div className="tn-empty">No modules yet. Create the first one on the right.</div>}
          {data.modules.map((m, mi) => (
            <ModuleCard key={m._id} m={m} mi={mi} count={data.modules.length} run={run} moveModule={moveModule} targets={targets} move={move} />
          ))}
        </div>

        <div className="tn-stack" style={{ flex: '1 1 320px', minWidth: 0, gap: 16 }}>
          <form onSubmit={addModule} className="tn-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 22 }}>New module</h2>
            <div className="tn-field"><label htmlFor="nm-t">Title</label><input id="nm-t" className="tn-input" required value={nm.title} onChange={(e) => setNm({ ...nm, title: e.target.value })} placeholder="JavaScript basics" /></div>
            <div className="tn-field"><label htmlFor="nm-d">One-line description</label><input id="nm-d" className="tn-input" value={nm.description} onChange={(e) => setNm({ ...nm, description: e.target.value })} placeholder="Variables to async/await" /></div>
            <div className="tn-field"><label htmlFor="nm-s">Sub-topics (one per line)</label><textarea id="nm-s" className="tn-textarea" style={{ minHeight: 90 }} value={nm.subs} onChange={(e) => setNm({ ...nm, subs: e.target.value })} placeholder={'Variables & types\nFunctions & scope\nPromises & async'} /></div>
            <button className="tn-btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add module'}</button>
          </form>
          <div className="tn-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontSize: 18 }}>Not in a module ({data.unplaced.length})</h3>
            <span className="tn-muted" style={{ fontSize: 13 }}>Mentees still see these under “More missions”. Pick a sub-topic to place one.</span>
            {data.unplaced.map((r) => <PlaceRow key={r._id} r={r} value="" targets={targets} move={move} />)}
            {data.unplaced.length === 0 && <span className="tn-muted" style={{ fontSize: 13 }}>Every mission is placed. 👌</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

function ModuleCard({ m, mi, count, run, moveModule, targets, move }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: m.title, description: m.description || '' });
  const [sub, setSub] = useState('');
  const total = m.subtopics.reduce((s, x) => s + x.resources.length, 0) + m.looseResources.length;

  return (
    <div className="tn-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderBottom: 'var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--tn-blue)' }}>{String(mi + 1).padStart(2, '0')}</span>
        {editing ? (
          <form className="tn-stack" style={{ flex: 1, gap: 8, minWidth: 200 }} onSubmit={(e) => { e.preventDefault(); run(() => updateModule(m._id, f), 'Module updated'); setEditing(false); }}>
            <input className="tn-input" aria-label="Module title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <input className="tn-input" aria-label="Module description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description" />
            <div style={{ display: 'flex', gap: 8 }}><button className="tn-btn sm primary">Save</button><button type="button" className="tn-btn sm" onClick={() => setEditing(false)}>Cancel</button></div>
          </form>
        ) : (
          <div className="tn-stack" style={{ flex: 1, gap: 2, minWidth: 200 }}>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{m.title}</b>
            <span className="tn-muted" style={{ fontSize: 13 }}>{m.subtopics.length} sub-topics · {total} missions{m.description ? ` · ${m.description}` : ''}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="tn-btn sm" aria-label="Move module up" disabled={mi === 0} onClick={() => moveModule(mi, -1)}><Icon name="up" size={16} /></button>
          <button className="tn-btn sm" aria-label="Move module down" disabled={mi === count - 1} onClick={() => moveModule(mi, 1)}><Icon name="down" size={16} /></button>
          <button className="tn-btn sm" aria-label="Rename module" onClick={() => setEditing(true)}><Icon name="edit" size={16} /></button>
          <button className="tn-btn sm" aria-label="Delete module" onClick={() => { if (window.confirm(`Delete module “${m.title}”? Its missions are kept but become unplaced.`)) run(() => deleteModule(m._id), 'Module deleted'); }}><Icon name="trash" size={16} /></button>
        </div>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {m.subtopics.map((s, si) => (
          <SubRow key={s._id} m={m} s={s} num={`${mi + 1}.${si + 1}`} first={si === 0} last={si === m.subtopics.length - 1} run={run} targets={targets} move={move} />
        ))}
        {m.looseResources.length > 0 && (
          <li className="tn-stack" style={{ gap: 8 }}>
            <span className="tn-label">in module, no sub-topic</span>
            {m.looseResources.map((r) => <PlaceRow key={r._id} r={r} value={placeKey(m._id)} targets={targets} move={move} />)}
          </li>
        )}
        <li>
          <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!sub.trim()) return; run(() => addSubtopic(m._id, { title: sub }), 'Sub-topic added'); setSub(''); }}>
            <input className="tn-input" style={{ minHeight: 40 }} aria-label={`New sub-topic in ${m.title}`} value={sub} onChange={(e) => setSub(e.target.value)} placeholder="+ Add a sub-topic" />
            <button className="tn-btn sm">Add</button>
          </form>
        </li>
      </ol>
    </div>
  );
}

function SubRow({ m, s, num, first, last, run, targets, move }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  return (
    <li style={{ border: '2px dashed #9fb4d8', borderRadius: 14, padding: 12, background: '#f7faff', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="tn-mono" style={{ color: 'var(--tn-blue)', fontWeight: 700 }}>{num}</span>
        {editing ? (
          <form style={{ display: 'flex', gap: 6, flex: 1 }} onSubmit={(e) => { e.preventDefault(); run(() => updateSubtopic(m._id, s._id, { title }), 'Renamed'); setEditing(false); }}>
            <input className="tn-input" style={{ minHeight: 36 }} aria-label="Sub-topic title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="tn-btn sm primary">Save</button>
          </form>
        ) : <b style={{ flex: 1, fontSize: 15 }}>{s.title}</b>}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 600 }} title={first ? 'The first sub-topic of a module can still be locked behind the previous module’s last sub-topic.' : undefined}>
          <input type="checkbox" checked={!!s.lockUntilPrevious} onChange={(e) => run(() => updateSubtopic(m._id, s._id, { lockUntilPrevious: e.target.checked }), e.target.checked ? 'Locked until the previous sub-topic is done' : 'Unlocked')} style={{ width: 16, height: 16 }} />
          <Icon name="lock" size={14} /> lock until previous
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="tn-btn sm" aria-label="Move sub-topic up" disabled={first} onClick={() => run(() => updateSubtopic(m._id, s._id, { move: 'up' }))}><Icon name="up" size={14} /></button>
          <button className="tn-btn sm" aria-label="Move sub-topic down" disabled={last} onClick={() => run(() => updateSubtopic(m._id, s._id, { move: 'down' }))}><Icon name="down" size={14} /></button>
          <button className="tn-btn sm" aria-label="Rename sub-topic" onClick={() => setEditing(!editing)}><Icon name="edit" size={14} /></button>
          <button className="tn-btn sm" aria-label="Delete sub-topic" onClick={() => { if (window.confirm(`Delete sub-topic “${s.title}”?`)) run(() => deleteSubtopic(m._id, s._id), 'Sub-topic deleted'); }}><Icon name="trash" size={14} /></button>
        </div>
      </div>
      {s.resources.length === 0 && <span className="tn-muted" style={{ fontSize: 13 }}>No missions yet. Place one from “Not in a module”, or pick this sub-topic when building a mission.</span>}
      {s.resources.map((r) => <PlaceRow key={r._id} r={r} value={placeKey(m._id, s._id)} targets={targets} move={move} />)}
    </li>
  );
}

function PlaceRow({ r, value, targets, move }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '2px solid var(--tn-navy)', borderRadius: 10, padding: '6px 10px', flexWrap: 'wrap' }}>
      <span className="tn-ico" style={{ width: 30, height: 30, borderRadius: 8, background: TYPE_BG[r.type] }}><Icon name={TYPE_ICON[r.type] || 'play'} size={16} /></span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 140 }}>{r.title}</span>
      <select className="tn-select" style={{ minHeight: 34, width: 'auto', maxWidth: 240, fontSize: 13 }} aria-label={`Move ${r.title} to`} value={value} onChange={(e) => move(r, e.target.value)}>
        {targets.map(([k, l]) => <option key={k || 'none'} value={k}>{l}</option>)}
      </select>
    </div>
  );
}
