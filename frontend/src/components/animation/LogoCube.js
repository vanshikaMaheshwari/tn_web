'use client';
import { useState } from 'react';
import styles from './LogoCube.module.css';
import logo from '../../assets/logo.png';

const FACES = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

function Faces() {
  return FACES.map((f) => (
    <div key={f} className={`${styles.face} ${styles[f]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="" />
    </div>
  ));
}

// The original TechNeeds cube-of-logos animation, redrawn as blueprint stickers.
// Click/tap (or Enter) swaps between the two choreographies, like the old site.
export default function LogoCube({ showWord = true }) {
  const [alt, setAlt] = useState(false);
  const anim = alt ? styles.rot2 : styles.rot;
  const word = 'TechNeeds';

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setAlt((a) => !a)}
          aria-label="TechNeeds logo cube. Press to change the animation."
        >
          <div className={`${styles.cube} ${anim} ${styles.alt}`}>
            <Faces />
            <div className={`${styles.cube} ${styles.inside} ${anim}`}>
              <Faces />
            </div>
            <div className={`${styles.cube} ${styles.inside} ${styles.round} ${anim} ${styles.alt}`}>
              <Faces />
            </div>
          </div>
        </button>
        <span className={styles.note} aria-hidden="true">tap me!</span>
      </div>

      {showWord && (
        <div className={styles.word}>
          <div className={styles.letters} aria-label="TechNeeds">
            {word.split('').map((ch, i) => (
              <span key={i} className={i >= 4 ? styles.needs : undefined} style={{ animationDelay: `${0.15 + i * 0.06}s` }} aria-hidden="true">
                {ch}
              </span>
            ))}
          </div>
          <div className={styles.tag}>all_you_need_to_know_about_tech</div>
        </div>
      )}
    </div>
  );
}
