// Helpers for video links: YouTube, Google Drive and Google Meet.

// Returns the 11-char YouTube id for watch / youtu.be / shorts / embed / live links, else null.
function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
        if (m) id = m[2];
      }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

function driveId(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'drive.google.com') return null;
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    return m ? m[1] : u.searchParams.get('id');
  } catch { return null; }
}

// Accepts any https link; YouTube and Drive links are also playable in-page.
function cleanVideoUrl(raw) {
  const url = String(raw || '').trim();
  if (!/^https:\/\/\S+$/i.test(url) || url.length > 400) return null;
  return url;
}

// Google Meet codes look like abc-defg-hij. We also accept other https meeting links (Zoom, Teams).
function cleanMeetUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(url)) return `https://meet.google.com/${url.toLowerCase()}`;
  if (!/^https:\/\/\S+$/i.test(url) || url.length > 300) return null;
  return url;
}

module.exports = { youtubeId, driveId, cleanVideoUrl, cleanMeetUrl };
