import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './VoidrunnerPage.module.css';
import { VoidrunnerEngine } from './VoidrunnerEngine';
import { LeaderboardStore } from '../../engine/LeaderboardStore';
import { OrientationGate } from '../../components/touch/OrientationGate';
import { TouchJoystick } from '../../components/touch/TouchJoystick';
import { TouchActionButton } from '../../components/touch/TouchActionButton';
import touchStyles from '../../components/touch/TouchControls.module.css';
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

function LeaderboardList({ entries }: { entries: VoidrunnerScoreEntry[] }) {
  if (entries.length === 0) {
    return <div className={styles.emptyBoard}>Finish a run to save your first score on this device.</div>;
  }
  return (
    <ol className={styles.leaderboard} aria-label="Leaderboard">
      {entries.map((entry, index) => (
        <li className={styles.leaderRow} key={`${entry.date}-${index}`}>
          <span className={styles.leaderRank}>#{index + 1}</span>
          <span className={styles.leaderDate}>{formatDate(entry.date)}</span>
          <span className={styles.leaderScore}>{pad(entry.score)}</span>
        </li>
      ))}
    </ol>
  );
}

export function VoidrunnerPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<VoidrunnerEngine | null>(null);

  const [scores, setScores] = useState<VoidrunnerScoreEntry[]>(() => leaderboard.load());
  const [mode, setMode] = useState<VoidrunnerMode>('ready');
  const [hud, setHud] = useState<VoidrunnerHud>({
    score: 0,
    best: leaderboard.best(),
    lives: 3,
    maxLives: 5,
    speed: 3.4,
    bombCharges: 2,
    maxBombs: 2,
    slideStamina: 100,
    gunActive: false
  });

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
            setScores(leaderboard.add({ score: result.score, date: new Date().toISOString() }));
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

  const handleJoystick = useCallback((x: number, y: number, active: boolean) => {
    engineRef.current?.setJoystick(x, y, active);
  }, []);

  const overlayCopy = useMemo(() => {
    if (mode === 'paused') {
      return {
        eyebrow: 'Run suspended',
        title: 'Hold Position',
        tagline: 'The signal is held mid-corridor until you return.',
        showResume: true
      };
    }
    if (mode === 'gameover') {
      return {
        eyebrow: hud.score >= hud.best ? 'New signal logged' : 'Signal lost',
        title: 'Vega Down',
        tagline: 'Your completed run has been saved to the local leaderboard.',
        showResume: false
      };
    }
    return {
      eyebrow: 'Laser survival protocol',
      title: 'Voidrunner',
      tagline: 'A lone figure runs the black shoreline with one instrument of light.',
      showResume: false
    };
  }, [mode, hud]);

  const showOverlay = mode !== 'running' && mode !== 'dying';

  return (
    <div className={styles.voidRoot}>
      <main className={styles.gameShell} aria-label="Voidrunner game">
        <section className={styles.hud} aria-label="Game status">
          <Link className={styles.brandLockup} to="/">
            <span className={styles.brandMark} aria-hidden="true" />
            <div>
              <strong>Voidrunner</strong>
              <span>Laser survival run</span>
            </div>
          </Link>

          <div className={styles.hudMetrics}>
            <div className={styles.metric}><span>Score</span><strong>{pad(hud.score)}</strong></div>
            <div className={styles.metric}><span>Best</span><strong>{pad(hud.best)}</strong></div>
            <div className={styles.metric}><span>Lives</span><strong>{hud.lives} / {hud.maxLives}</strong></div>
            <div className={`${styles.metric} ${styles.laserMeter}`}>
              <span>Laser</span>
              <strong>{hud.gunActive ? 'Rapid' : 'INF'}</strong>
            </div>
            <div className={styles.metric}><span>Bombs</span><strong>{hud.bombCharges}/{hud.maxBombs}</strong></div>
            <div className={styles.metric}><span>Slide</span><strong>{Math.round(hud.slideStamina)}%</strong></div>
          </div>

          <button
            className={styles.iconButton}
            type="button"
            aria-label={mode === 'paused' ? 'Resume game' : 'Pause game'}
            onClick={() => engineRef.current?.togglePause()}
            disabled={mode !== 'running' && mode !== 'paused'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5v14M15 5v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </section>

        <section className={styles.stageWrap}>
          <canvas ref={canvasRef} aria-label="Game arena" />

          <section className={styles.mobileControls} aria-label="Touch controls">
            <TouchJoystick label="Move" onChange={handleJoystick} />
            <div className={touchStyles.actionCluster}>
              <TouchActionButton label="Jump" onPress={(active) => active && engineRef.current?.jump()} />
              <TouchActionButton
                label="Slide"
                variant="secondary"
                onPress={(active) => engineRef.current?.slide(active)}
              />
              <TouchActionButton label="Fire" onPress={(active) => active && engineRef.current?.fireLaser()} />
              <TouchActionButton
                label="Bomb"
                sublabel={`${hud.bombCharges}/${hud.maxBombs}`}
                variant="secondary"
                disabled={hud.bombCharges <= 0}
                onPress={(active) => active && engineRef.current?.useBomb()}
              />
            </div>
          </section>
        </section>
      </main>
      <OrientationGate gameName="Voidrunner" />

      {showOverlay && (
        <section className={styles.overlay}>
          <div className={`${styles.dialog} ${mode === 'ready' ? styles.startDialog : styles.compactDialog}`} role="dialog" aria-modal="true" aria-labelledby="overlayTitle">
            <div className={styles.copyBlock}>
              <p className={styles.eyebrowText}>{overlayCopy.eyebrow}</p>
              <h1 id="overlayTitle">{overlayCopy.title}</h1>
              <p className={styles.tagline}>{overlayCopy.tagline}</p>
            </div>
            <div className={styles.bodyBlock}>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} type="button" onClick={() => engineRef.current?.startRun()}>
                  {mode === 'gameover' ? 'Run Again' : mode === 'paused' ? 'Restart' : 'Begin Run'}
                </button>
                {overlayCopy.showResume && (
                  <button className={styles.btnSecondary} type="button" onClick={() => engineRef.current?.requestResume()}>
                    Resume
                  </button>
                )}
              </div>
              <p className={styles.hint}>Space / Up jumps &middot; Down slides (stamina limited) &middot; F / Z fires &middot; B or Bomb clears the screen &middot; touch joystick + buttons on mobile &middot; P / Esc pauses</p>

              {mode === 'ready' && (
                <div className={styles.leaderboardPanel}>
                  <div className={styles.lbHeader}>
                    <span>Local Leaderboard</span>
                    <span>Top 10</span>
                  </div>
                  <LeaderboardList entries={scores} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
