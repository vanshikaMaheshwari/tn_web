'use client';
import { useCallback, useEffect, useState } from 'react';
import { createEvent, deleteEvent, getAdminEvents, updateEvent } from '@/lib/api';
import { Chip, PastCard, TYPE_BG, TYPE_LABEL, UpcomingCard, eventWhen } from '@/components/events/EventBits';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const TYPES = ['hackathon', 'workshop', 'talk', 'bootcamp', 'contest', 'cohort-launch', 'orientation', 'pitch', 'challenge', 'other'];
const STATUS_BG = { live: '#FFD1DC', upcoming: 'var(--tn-sky)', past: '#e8f0ff', draft: '#fff' };
const BLANK = { title: '', type: 'workshop', description: '', tracks: '', startsAt: '', endsAt: '', dateLabel: '', mode: 'offline', venue: '', registerUrl: '', registrationClosesAt: '', imageUrl: '', gallery: '', recapUrl: '', highlight: '', featured: false, published: true };

// datetime-local <-> ISO helpers
const toLocal = (d) => { if (!d) return ''; const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toIso = (v) => (v ? new Date(v).toISOString() : '');

export default function EventsManager() {
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setEvents(await getAdminEvents()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const reset = () => { setF(BLANK); setEditing(null); };
  const edit = (ev) => {
    setEditing(ev._id);
    setF({
      ...BLANK, ...ev,
      tracks: (ev.tracks || []).join(', '), gallery: (ev.gallery || []).join('\n'),
      startsAt: toLocal(ev.startsAt), endsAt: toLocal(ev.endsAt), registrationClosesAt: toLocal(ev.registrationClosesAt),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        title: f.title, type: f.type, description: f.description, tracks: f.tracks, dateLabel: f.dateLabel, mode: f.mode, venue: f.venue,
        registerUrl: f.registerUrl, imageUrl: f.imageUrl, gallery: f.gallery, recapUrl: f.recapUrl, highlight: f.highlight,
        featured: !!f.featured, published: !!f.published,
        startsAt: toIso(f.startsAt), endsAt: toIso(f.endsAt), registrationClosesAt: toIso(f.registrationClosesAt),
      };
      if (editing) { await updateEvent(editing, body); toast('Event updated'); } else { await createEvent(body); toast(f.published ? 'Event published on /events' : 'Saved as draft'); }
      reset();
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function remove(ev) {
    if (!window.confirm(`Delete "${ev.title}"? Its ratings are deleted too.`)) return;
    try { await deleteEvent(ev._id); toast('Event deleted'); if (editing === ev._id) reset(); load(); } catch (err) { toast(err.message, 'error'); }
  }
  async function togglePublish(ev) {
    try { await updateEvent(ev._id, { published: !ev.published }); load(); } catch (err) { toast(err.message, 'error'); }
  }

  // Live preview uses the same card the public page uses.
  const startsAt = toIso(f.startsAt) || new Date(Date.now() + 7 * 86400000).toISOString();
  const preview = {
    ...f, _id: 'preview', title: f.title || 'Your event title', startsAt, endsAt: toIso(f.endsAt) || undefined,
    tracks: f.tracks.split(',').map((t) => t.trim()).filter(Boolean), gallery: f.gallery.split('\n').map((t) => t.trim()).filter(Boolean),
    registrationClosesAt: toIso(f.registrationClosesAt) || undefined,
    registrationOpen: !!f.registerUrl && new Date(startsAt) > new Date(),
  };
  const isPast = new Date(toIso(f.endsAt) || startsAt) < new Date();

  return (
    <div className="tn-stack" style={{ gap: 26 }}>
      <div className="tn-stack" style={{ gap: 6 }}>
        <span className="tn-eyebrow">core@techneeds:~$ events --manage</span>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Events</h1>
        <span style={{ fontSize: 15, color: 'var(--tn-ink-2)' }}>Whatever you publish here appears on <a href="/events" target="_blank" rel="noopener noreferrer">/events</a>, the Techboard and the home page banner. Registration happens on your external link.</span>
      </div>

      <section className="tn-row" style={{ gap: 26, alignItems: 'flex-start' }}>
        <form onSubmit={submit} className="tn-card" style={{ flex: '1 1 460px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="tn-between"><h2 style={{ fontSize: 24 }}>{editing ? 'Edit event' : 'Add an event'}</h2>{editing && <button type="button" className="tn-btn sm" onClick={reset}>Cancel edit</button>}</div>
          <div className="tn-field"><label htmlFor="ev-t">Title *</label><input id="ev-t" className="tn-input" required value={f.title} onChange={set('title')} placeholder="InnoVortex 5.0" /></div>
          <div className="tn-form-grid">
            <div className="tn-field"><label htmlFor="ev-ty">Type</label><select id="ev-ty" className="tn-select" value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL(t)}</option>)}</select></div>
            <div className="tn-field"><label htmlFor="ev-m">Mode</label><select id="ev-m" className="tn-select" value={f.mode} onChange={set('mode')}>{['offline', 'online', 'hybrid'].map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="tn-field"><label htmlFor="ev-d">Short description</label><textarea id="ev-d" className="tn-textarea" style={{ minHeight: 80 }} maxLength={600} value={f.description} onChange={set('description')} /></div>
          <div className="tn-form-grid">
            <div className="tn-field"><label htmlFor="ev-s">Starts *</label><input id="ev-s" type="datetime-local" className="tn-input" required value={f.startsAt} onChange={set('startsAt')} /></div>
            <div className="tn-field"><label htmlFor="ev-e">Ends</label><input id="ev-e" type="datetime-local" className="tn-input" value={f.endsAt} onChange={set('endsAt')} /></div>
          </div>
          <div className="tn-form-grid">
            <div className="tn-field"><label htmlFor="ev-dl">Date label (optional)</label><input id="ev-dl" className="tn-input" value={f.dateLabel} onChange={set('dateLabel')} placeholder="1 Jan onwards" /></div>
            <div className="tn-field"><label htmlFor="ev-v">Venue</label><input id="ev-v" className="tn-input" value={f.venue} onChange={set('venue')} placeholder="IGDTUW, Delhi" /></div>
          </div>
          <div className="tn-field"><label htmlFor="ev-r">Registration link</label><input id="ev-r" className="tn-input mono" value={f.registerUrl} onChange={set('registerUrl')} placeholder="https://unstop.com/… or a Google Form" /></div>
          <div className="tn-form-grid">
            <div className="tn-field"><label htmlFor="ev-rc">Registrations close</label><input id="ev-rc" type="datetime-local" className="tn-input" value={f.registrationClosesAt} onChange={set('registrationClosesAt')} /></div>
            <div className="tn-field"><label htmlFor="ev-tr">Tracks (comma separated)</label><input id="ev-tr" className="tn-input" value={f.tracks} onChange={set('tracks')} placeholder="AI/ML, Web3, FinTech" /></div>
          </div>
          <div className="tn-field"><label htmlFor="ev-i">Poster image URL</label><input id="ev-i" className="tn-input mono" value={f.imageUrl} onChange={set('imageUrl')} placeholder="/events/iv4-banner.jpg or https://…" /></div>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>After the event: photos, recap, highlight</summary>
            <div className="tn-stack" style={{ gap: 12, marginTop: 12 }}>
              <div className="tn-field"><label htmlFor="ev-h">Highlight</label><input id="ev-h" className="tn-input" value={f.highlight} onChange={set('highlight')} placeholder="3500+ registrations · 48 hours" /></div>
              <div className="tn-field"><label htmlFor="ev-g">Gallery image URLs (one per line)</label><textarea id="ev-g" className="tn-textarea mono" style={{ minHeight: 70 }} value={f.gallery} onChange={set('gallery')} /></div>
              <div className="tn-field"><label htmlFor="ev-rec">Recap link (Instagram / LinkedIn)</label><input id="ev-rec" className="tn-input mono" value={f.recapUrl} onChange={set('recapUrl')} /></div>
            </div>
          </details>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}><input type="checkbox" checked={!!f.featured} onChange={set('featured')} style={{ width: 18, height: 18 }} /> Feature at the top</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}><input type="checkbox" checked={!!f.published} onChange={set('published')} style={{ width: 18, height: 18 }} /> Published (untick = draft)</label>
          </div>
          <button className="tn-btn primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? 'Saving…' : editing ? 'Save changes' : f.published ? 'Publish event' : 'Save draft'}</button>
        </form>

        <div className="tn-stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 12, position: 'sticky', top: 20 }}>
          <span className="tn-label">live preview · how it looks on /events</span>
          {isPast ? <PastCard e={preview} /> : <UpcomingCard e={preview} />}
        </div>
      </section>

      <section className="tn-stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 24 }}>All events</h2>
        {error && <ErrorBox message={error} onRetry={load} />}
        {!events && !error && <Loading rows={3} />}
        {events?.length === 0 && <div className="tn-empty">No events yet. Add the first one above.</div>}
        {events?.map((ev) => {
          const st = ev.published ? ev.status : 'draft';
          return (
            <div key={ev._id} className="tn-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {ev.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={ev.imageUrl} alt="" style={{ width: 64, height: 48, objectFit: 'cover', border: '2px solid var(--tn-navy)', borderRadius: 8 }} />
                : <span style={{ width: 64, height: 48, borderRadius: 8, border: '2px dashed var(--tn-navy)', background: TYPE_BG[ev.type] }} />}
              <div className="tn-stack" style={{ gap: 2, flex: 1, minWidth: 180 }}>
                <b style={{ fontSize: 15 }}>{ev.title}{ev.featured && <span style={{ color: 'var(--tn-blue)' }}> ★</span>}</b>
                <span className="tn-muted" style={{ fontSize: 13 }}>{TYPE_LABEL(ev.type)} · {eventWhen(ev)}{ev.registerUrl ? ' · has register link' : ''}</span>
              </div>
              <Chip bg={STATUS_BG[st]}>{st}</Chip>
              <button className="tn-btn sm" onClick={() => togglePublish(ev)}>{ev.published ? 'Unpublish' : 'Publish'}</button>
              <button className="tn-btn sm" aria-label={`Edit ${ev.title}`} onClick={() => edit(ev)}><Icon name="edit" size={16} /></button>
              <button className="tn-btn sm" aria-label={`Delete ${ev.title}`} onClick={() => remove(ev)}><Icon name="trash" size={16} /></button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
