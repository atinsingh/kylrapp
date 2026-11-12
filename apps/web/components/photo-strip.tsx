'use client';

import { useRef, useState } from 'react';

type Photo = { url: string; alt: string };

/**
 * Swipeable photos for a search card. Native scroll-snap, so touch swipe, trackpad and
 * Shift+wheel all work; arrow buttons for mouse and keyboard users.
 */
export function PhotoStrip({ photos, address, sample, href, tall }: { photos: Photo[]; address: string; sample: boolean; href?: string; tall?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (!photos.length) {
    return <div style={{ aspectRatio: '3 / 2', background: 'var(--bg)', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>No photos yet</div>;
  }

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="k-strip" role="region" aria-roledescription="carousel" aria-label={`Photos of ${address}`}>
      <div ref={track} className="k-strip-track" tabIndex={0} style={tall ? { aspectRatio: '16 / 9' } : undefined}
        onScroll={e => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onKeyDown={e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); } }}>
        {photos.map((p, i) => {
          const img = <img src={p.url} alt={p.alt || `Photo ${i + 1} of ${address}`} loading={i === 0 ? 'eager' : 'lazy'} draggable={false} />;
          // On a search card a tap on the photo opens the listing; the text link below is the keyboard path.
          return href
            ? <a key={p.url + i} href={href} tabIndex={-1} className="k-strip-slide" aria-roledescription="slide" aria-label={`${i + 1} of ${photos.length}`}>{img}</a>
            : <div key={p.url + i} className="k-strip-slide" aria-roledescription="slide" aria-label={`${i + 1} of ${photos.length}`}>{img}</div>;
        })}
      </div>
      {photos.length > 1 && (
        <>
          <button className="k-strip-nav" style={{ left: 8 }} aria-label="Previous photo" disabled={index === 0} onClick={() => go(index - 1)}>‹</button>
          <button className="k-strip-nav" style={{ right: 8 }} aria-label="Next photo" disabled={index === photos.length - 1} onClick={() => go(index + 1)}>›</button>
          <div className="k-strip-dots" aria-hidden>{photos.map((_, i) => <span key={i} className={i === index ? 'on' : ''} />)}</div>
          <div className="k-strip-count" aria-live="polite">{index + 1} / {photos.length}</div>
        </>
      )}
      {sample && <div className="k-strip-tag">Sample photos</div>}
    </div>
  );
}
