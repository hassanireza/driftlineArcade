import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './VoidrunnerPage.module.css';
import { VoidrunnerEngine } from './VoidrunnerEngine';
import { LeaderboardStore } from '../../engine/LeaderboardStore';
import type { VoidrunnerHud, VoidrunnerMode, VoidrunnerScoreEntry } from './types';

const leaderboard = new LeaderboardStore<VoidrunnerScoreEntry>({
  storageKey: 'voidrunner.leaderboard.v3',
  maxEntries: 10,
  compare: (a, b) => b.score - a.score,
  normalize: (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Partial<VoidrunnerScoreEntry>;
    const score = Number(item.score);
    if (!Number.isFinite(score) || score <= 0) return null;
    return { score: Math.floor(score), date: typeof item.date === 'string' ? item.date : new Date().toISOString() };
  }
});

function pad(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(5, '0');
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Saved run';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VoidrunnerPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<VoidrunnerEngine | null>(null);

  const [scores, setScores] = useState<VoidrunnerScoreEntry[]>(() => leaderboard.load());
  const [runCount, setRunCount] = useState(0);
  const [mode, setMode] = useState<VoidrunnerMode>('ready');
  const [hud, setHud] = useState<VoidrunnerHud>({ score: 0, best: leaderboard.best(), lives: 3, maxLives: 5 });

  const bestScore = useMemo(() => (scores.length ? scores[0].score : 0), [scores]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new VoidrunnerEngine(
      canvas,
      {
        onHudChange: setHud,
        onModeChange: setMode,
        onRunEnd: (result) => {
          if (result.score > 0) {
            const updated = leaderboard.add({ score: result.score, date: new Date().toISOString() });
            setScores(updated);
            setRunCount((prev) => prev + 1);
          }
        }
      },
      leaderboard.best()
    );
    engineRef.current = engine;
    engine.mount();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const bindHold = useCallback((onDown: () => void, onUp?: () => void) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      onDown();
    },
    onPointerUp: (event: React.PointerEvent) => {
      event.preventDefault();
      onUp?.();
    },
    onPointerCancel: () => onUp?.(),
    onPointerLeave: () => onUp?.()
  }), []);

  const overlayCopy = useMemo(() => {
    if (mode === 'paused') {
      return {
        kicker: 'Run Paused',
        title: 'HOLD POSITION',
        score: `Score: ${pad(hud.score)}   Best: ${pad(hud.best)}`,
        sub: 'Simulation is stopped. Press P, Escape, or Resume to continue.',
        primary: 'Restart',
        showResume: true
      };
    }
    if (mode === 'gameover') {
      return {
        kicker: hud.score >= hud.best ? 'New Signal Logged' : 'Signal Lost',
        title: 'VEGA DOWN',
        score: `Score: ${pad(hud.score)}   Best: ${pad(hud.best)}`,
        sub: 'Your completed run has been saved to the local leaderboard.',
        primary: 'Run Again',
        showResume: false
      };
    }
    return {
      kicker: 'Laser Survival Protocol',
      title: 'VOIDRUNNER',
      score: hud.best ? `Best: ${pad(hud.best)}` : '',
      sub: 'Space or Up jumps. Down slides or fast-falls. F or Z fires the infinite laser. P pauses.',
      primary: 'Begin Run',
      showResume: false
    };
  }, [mode, hud]);

  const showOverlay = mode !== 'running' && mode !== 'dying';

  return (
    <div className={styles.voidRoot}>
      <div className={styles.siteShell}>
        <nav className={styles.topNav} aria-label="Primary navigation">
          <Link className={styles.brand} to="/" aria-label="Back to Driftline Arcade">
            <span className={styles.brandMark} aria-hidden="true" />
            <span>VOIDRUNNER</span>
          </Link>
          <ul className={styles.navLinks}>
            <li><a href="#game">Play</a></li>
            <li><a href="#leaderboard">Leaderboard</a></li>
            <li><a href="#systems">Systems</a></li>
          </ul>
        </nav>

        <header className={styles.hero} id="home">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>Procession at Speed</div>
            <h1>
              <span className={styles.toneA}>RUN THE</span>
              <span className={styles.toneB}>BLACK SHORELINE</span>
              <span className={styles.toneC}>NO CLEAR ENDING.</span>
            </h1>
            <p className={styles.heroDesc}>
              One figure, one unfailing beam of light, a corridor of salt-dark shapes that arrive
              without warning. Jump, slide, fire, pause cleanly, and let the run be logged either way.
            </p>
            <div className={styles.heroActions}>
              <a className={`${styles.btn} ${styles.btnPrimary}`} href="#game">Start Run</a>
              <a className={styles.btn} href="#leaderboard">View Scores</a>
            </div>
          </div>
          <aside className={styles.missionCard} aria-label="Mission status">
            <div className={styles.planetWindow}>
              <div className={styles.windowReadout}>
                <div className={styles.readout}><strong>{pad(bestScore)}</strong><span>Best</span></div>
                <div className={styles.readout}><strong>{runCount}</strong><span>Runs</span></div>
                <div className={styles.readout}><strong>LASER</strong><span>Loadout</span></div>
              </div>
            </div>
          </aside>
        </header>

        <main>
          <section className={styles.gameSection} id="game" aria-label="VOIDRUNNER game">
            <div className={styles.gameLayout}>
              <div className={styles.gamePanel}>
                <div className={styles.hud} aria-live="polite">
                  <div className={styles.hudCell}><span className={styles.hudLabel}>Score</span><span className={styles.hudValue}>{pad(hud.score)}</span></div>
                  <div className={styles.hudCell}><span className={styles.hudLabel}>Best</span><span className={styles.hudValue}>{pad(hud.best)}</span></div>
                  <div className={styles.hudCell}><span className={styles.hudLabel}>Lives</span><span className={styles.hudValue}>{hud.lives} / {hud.maxLives}</span></div>
                  <div className={styles.hudCell}><span className={styles.hudLabel}>Laser Ammo</span><span className={`${styles.hudValue} ${styles.laser}`}>INF</span></div>
                </div>

                <div className={styles.stageWrap}>
                  <canvas ref={canvasRef} aria-label="VOIDRUNNER playable canvas" />
                  {showOverlay && (
                    <div className={styles.overlay}>
                      <div className={styles.overlayBox} role="dialog" aria-modal="false" aria-labelledby="overlayTitle">
                        <div className={styles.overlayKicker}>{overlayCopy.kicker}</div>
                        <h2 className={styles.overlayTitle} id="overlayTitle">{overlayCopy.title}</h2>
                        <div className={styles.overlayScore}>{overlayCopy.score}</div>
                        <div className={styles.overlayActions}>
                          <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            type="button"
                            onClick={() => engineRef.current?.startRun()}
                          >
                            {overlayCopy.primary}
                          </button>
                          {overlayCopy.showResume && (
                            <button className={styles.btn} type="button" onClick={() => engineRef.current?.requestResume()}>
                              Resume
                            </button>
                          )}
                        </div>
                        <p className={styles.overlaySub}>{overlayCopy.sub}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.controlBar} aria-label="Touch controls">
                  <button className={styles.controlButton} type="button" {...bindHold(() => engineRef.current?.jump())}>Jump</button>
                  <button
                    className={styles.controlButton}
                    type="button"
                    {...bindHold(
                      () => engineRef.current?.slide(true),
                      () => engineRef.current?.slide(false)
                    )}
                  >
                    Slide
                  </button>
                  <button className={styles.controlButton} type="button" {...bindHold(() => engineRef.current?.fireLaser())}>Laser</button>
                  <button className={styles.controlButton} type="button" onClick={() => engineRef.current?.togglePause()}>
                    {mode === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                </div>
              </div>

              <aside className={styles.sidePanel} id="leaderboard">
                <div className={styles.sideHead}>
                  <h2>Leaderboard</h2>
                  <span className={styles.statusPill}>Saved</span>
                </div>
                <div className={styles.leaderboard} aria-live="polite">
                  {scores.length === 0 ? (
                    <div className={styles.emptyBoard}>Finish a run to save your first score on this device.</div>
                  ) : (
                    scores.map((entry, index) => (
                      <div className={styles.leaderRow} key={`${entry.date}-${index}`}>
                        <span className={styles.leaderRank}>#{index + 1}</span>
                        <span className={styles.leaderDate}>{formatDate(entry.date)}</span>
                        <span className={styles.leaderScore}>{pad(entry.score)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className={styles.sideActions}>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={() => {
                      leaderboard.clear();
                      setScores([]);
                      setRunCount(0);
                    }}
                  >
                    Clear Scores
                  </button>
                </div>
              </aside>
            </div>

            <div className={styles.featureStrip} id="systems">
              <article className={styles.feature}>
                <div className={styles.featureNum}>01</div>
                <h3>Laser-only loadout</h3>
                <p>No switching, no hidden ammo depletion, no obsolete secondary loadout paths. Every shot uses the same reliable projectile model.</p>
              </article>
              <article className={styles.feature}>
                <div className={styles.featureNum}>02</div>
                <h3>Pause-safe loop</h3>
                <p>The simulation stops while paused, resumes without double ticks, and keeps controls predictable on keyboard and touch screens.</p>
              </article>
              <article className={styles.feature}>
                <div className={styles.featureNum}>03</div>
                <h3>Persistent scores</h3>
                <p>Completed runs are ranked locally with dates, best score, and run count saved through browser storage.</p>
              </article>
            </div>
          </section>
        </main>

        <footer className={styles.siteFooter}>
          <span>VOIDRUNNER - No Clear Ending</span>
          <span>Laser survival build</span>
        </footer>
      </div>
    </div>
  );
}
