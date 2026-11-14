'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { thumbOf } from './media';

// Small clickable card for a reference video or a recording.
export default function VideoThumb({ video, onPlay, tag, width = 220 }) {
  const [broken, setBroken] = useState(false);
  const thumb = broken ? null : thumbOf(video.url);
  return (
    <button type="button" className="tn-vthumb" style={{ width }} onClick={() => onPlay(video)} aria-label={`Play ${video.title}`}>
      <span className="tn-vthumb-img">
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt="" loading="lazy" onError={() => setBroken(true)} />
          : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'repeating-linear-gradient(45deg, var(--tn-sky) 0 12px, #d9f1ff 12px 24px)' }}><Icon name="video" size={30} /></span>}
        <span className="tn-vthumb-play"><Icon name="play" size={16} color="#fff" /></span>
        {video.minutes ? <span className="tn-vthumb-len">{video.minutes} min</span> : null}
        {tag && <span className="tn-vthumb-tag">{tag}</span>}
      </span>
      <span className="tn-vthumb-title">{video.title}</span>
      {video.channel && <span className="tn-vthumb-ch">{video.channel}</span>}
    </button>
  );
}
