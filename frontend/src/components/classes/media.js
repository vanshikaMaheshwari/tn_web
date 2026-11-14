// Client-side twins of backend/services/media.js plus calendar helpers.
export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/); if (m) id = m[2]; }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export function driveId(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'drive.google.com') return null;
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    return m ? m[1] : u.searchParams.get('id');
  } catch { return null; }
}
export const thumbOf = (url) => { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null; };

const gcalStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// "Add to Google Calendar" link for a class.
export function googleCalendarUrl(s) {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + (s.durationMin || 60) * 60000);
  const details = [s.agenda, s.meetUrl ? `Join: ${s.meetUrl}` : '', 'TechNeeds IGDTUW'].filter(Boolean).join('\n\n');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `TechNeeds · ${s.title}`, dates: `${gcalStamp(start)}/${gcalStamp(end)}`, details, location: s.meetUrl || '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
