'use client';
import { useEffect } from 'react';
import Icon from '@/components/ui/Icon';
import { driveId, youtubeId } from './media';

// Plays YouTube (privacy-enhanced embed) or Google Drive videos in-page; anything else opens in a new tab.
export default function VideoModal({ video, onClose }) {
  useEffect(() => {
    if (!video) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, onClose]);
  if (!video) return null;
  const yt = youtubeId(video.url);
  const dr = driveId(video.url);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0` : dr ? `https://drive.google.com/file/d/${dr}/preview` : null;
  return (
    <div className="tn-modal-backdrop" role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose}>
      <div className="tn-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(960px, 94vw)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="tn-between" style={{ gap: 10 }}>
          <div className="tn-stack" style={{ gap: 2, minWidth: 0 }}>
            <b style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</b>
            {video.channel && <span className="tn-muted" style={{ fontSize: 13 }}>{video.channel}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="tn-btn sm" href={video.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> Open</a>
            <button className="tn-btn sm" onClick={onClose} aria-label="Close video">✕</button>
          </div>
        </div>
        {src ? (
          <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', border: '2px solid var(--tn-navy)', background: '#000' }}>
            <iframe src={src} title={video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
          </div>
        ) : (
          <div className="tn-empty">This video can’t be played here. <a href={video.url} target="_blank" rel="noopener noreferrer">Open it in a new tab ↗</a></div>
        )}
        {video.notes && <p className="tn-muted" style={{ margin: 0, fontSize: 13 }}>{video.notes}</p>}
      </div>
    </div>
  );
}
