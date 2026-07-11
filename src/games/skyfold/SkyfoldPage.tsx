import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './SkyfoldPage.module.css';
import { SkyfoldEngine } from './SkyfoldEngine';
import { SkyfoldAmbientScene } from '../../components/ambient/SkyfoldAmbientScene';
import { AmbientCanvas } from '../../components/ambient/AmbientCanvas';
import { LeaderboardStore } from '../../engine/LeaderboardStore';
import { formatTime, sanitizeName } from '../../engine/MathUtils';
import { OrientationGate } from '../../components/touch/OrientationGate';
import { TouchJoystick } from '../../components/touch/TouchJoystick';
import { TouchActionButton } from '../../components/touch/TouchActionButton';
import touchStyles from '../../components/touch/TouchControls.module.css';
import type { SkyfoldHud, SkyfoldMode, SkyfoldRunResult, SkyfoldScoreEntry } from './types';

const leaderboard = new LeaderboardStore<SkyfoldScoreEntry>({
  storageKey: 'skyfold.leaderboard.v3',
  maxEntries: 10,
  compare: (a, b) => b.score - a.score,
  normalize: (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Partial<SkyfoldScoreEntry>;
    const score = Number(item.score);
    if (!Number.isFinite(score) || score <= 0) return null;
    return {
      name: sanitizeName(String(item.name ?? 'Pilot')),
      score: Math.floor(score),
      wave: Number(item.wave) || 1,
      time: Number(item.time) || 0,
      date: typeof item.date === 'string' ? item.date : new Date().toISOString()
    };
  }
});

function LeaderboardList({ entries }: { entries: SkyfoldScoreEntry[] }) {
  if (entries.length === 0) {
    return <p className={styles.emptyRow}>No runs saved on this device yet. Fly to set the first record.</p>;
  }
  return (
    <ol aria-label="Leaderboard">
      {entries.map((entry, index) => (
        <li key={`${entry.date}-${index}`} className={styles.scoreRow}>
          <span className={styles.scoreRank}>{index + 1}</span>
          <b>{entry.name} &middot; Layer {entry.wave}</b>
          <span>{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function SkyfoldPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SkyfoldEngine | null>(null);

  const [mode, setMode] = useState<SkyfoldMode>('menu');
  const [hud, setHud] = useState<SkyfoldHud>({
    score: 0,
    wave: 1,
    health: 100,
    laserReady: true,
    chargeFraction: 1,
    bombCharges: 3,
    maxBombs: 3
  });
  const [runResult, setRunResult] = useState<SkyfoldRunResult | null>(null);
  const [scores, setScores] = useState<SkyfoldScoreEntry[]>(() => leaderboard.load());
  const [pilotName, setPilotName] = useState('Pilot');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new SkyfoldEngine(canvas, {
      onHudChange: setHud,
      onModeChange: setMode,
      onRunEnd: (result) => {
        setRunResult(result);
        setSaved(false);
      }
    });
    engineRef.current = engine;
    engine.mount();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    let pointerPressed = false;
    const handlePointerMove = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || mode !== 'playing' || !pointerPressed) return;
      const rect = canvas.getBoundingClientRect();
      engineRef.current?.setPointer(event.clientX - rect.left, event.clientY - rect.top, true);
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerPressed = true;
      handlePointerMove(event);
    };
    const handlePointerUp = () => {
      pointerPressed = false;
      engineRef.current?.setPointer(0, 0, false);
    };
    const stage = canvasRef.current?.parentElement;
    stage?.addEventListener('pointermove', handlePointerMove);
    stage?.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      stage?.removeEventListener('pointermove', handlePointerMove);
      stage?.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [mode]);

  const healthLabel = `${Math.max(0, hud.health)}%`;
  const chargePercent = useMemo(() => `${Math.round(hud.chargeFraction * 100)}%`, [hud.chargeFraction]);

  const handleJoystick = useCallback((x: number, y: number, active: boolean) => {
    engineRef.current?.setJoystick(x, y, active);
  }, []);

  const handleSaveScore = (event: React.FormEvent) => {
    event.preventDefault();
    if (!runResult) return;
    const entry: SkyfoldScoreEntry = {
      name: sanitizeName(pilotName),
      score: runResult.score,
      wave: runResult.wave,
      time: runResult.time,
      date: new Date().toISOString()
    };
    setScores(leaderboard.add(entry));
    setSaved(true);
  };

  return (
    <div className={styles.skyRoot}>
      <main className={styles.gameShell} aria-label="Skyfold Aviary game">
        <section className={styles.hud} aria-label="Game status">
          <Link className={styles.brandLockup} to="/">
            <span className={styles.brandMark} aria-hidden="true" />
            <div>
              <strong>Skyfold Aviary</strong>
              <span>Laser glider run</span>
            </div>
          </Link>

          <div className={styles.hudMetrics}>
            <div className={styles.metric}><span>Score</span><strong>{hud.score}</strong></div>
            <div className={styles.metric}><span>Layer</span><strong>{hud.wave}</strong></div>
            <div className={styles.metric}><span>Hull</span><strong>{healthLabel}</strong></div>
            <div className={`${styles.metric} ${styles.laserMeter}`}>
              <span>Beam</span>
              <strong>{hud.laserReady ? 'Ready' : 'Charging'}</strong>
              <i className={styles.chargeTrack} aria-hidden="true">
                <b style={{ width: chargePercent }} />
              </i>
            </div>
            <div className={styles.metric}><span>Bombs</span><strong>{hud.bombCharges}/{hud.maxBombs}</strong></div>
          </div>

          <button
            className={styles.iconButton}
            type="button"
            aria-label={mode === 'paused' ? 'Resume game' : 'Pause game'}
            onClick={() => (mode === 'paused' ? engineRef.current?.requestResume() : engineRef.current?.requestPause())}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5v14M15 5v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </section>

        <section className={styles.stageWrap}>
          <canvas ref={canvasRef} aria-label="Game arena" />
        </section>

        <section className={styles.mobileControls} aria-label="Touch controls">
          <TouchJoystick label="Move" onChange={handleJoystick} />
          <div className={touchStyles.actionCluster}>
            <TouchActionButton label="Fire" onPress={(active) => engineRef.current?.setTouchControl('fire', active)} />
            <TouchActionButton
              label="Bomb"
              sublabel={`${hud.bombCharges}/${hud.maxBombs}`}
              variant="secondary"
              disabled={hud.bombCharges <= 0}
              onPress={(active) => engineRef.current?.setTouchControl('bomb', active)}
            />
          </div>
        </section>
      </main>
      <OrientationGate gameName="Skyfold Aviary" />

      {mode === 'menu' && (
        <section className={styles.overlay}>
          <div className={styles.dialog + ' ' + styles.startDialog} role="dialog" aria-modal="true" aria-labelledby="startTitle">
            <div className={styles.coverCol} aria-hidden="true">
              <AmbientCanvas className={styles.coverCanvas} factory={(canvas) => new SkyfoldAmbientScene(canvas)} />
            </div>
            <div className={styles.contentCol}>
              <div className={styles.copyBlock}>
                <p className={styles.eyebrow}>A ritual in stillness</p>
                <h1 id="startTitle">Skyfold<br />Aviary</h1>
                <p className={styles.tagline}>
                  A glider descends through submerged terraces that may be architecture or may be
                  something that used to breathe. Trace what moves with a single unfailing beam.
                </p>
              </div>
              <div className={styles.bodyBlock}>
                <div className={styles.actions}>
                  <button className={styles.btnPrimary} type="button" onClick={() => engineRef.current?.startRun()}>
                    Start Run
                  </button>
                  <button
                    className={styles.btnSecondary}
                    type="button"
                    onClick={() => {
                      leaderboard.clear();
                      setScores([]);
                    }}
                  >
                    Clear Scores
                  </button>
                </div>
                <p className={styles.hint}>Arrow keys &middot; WASD &middot; touch joystick to move &nbsp;&middot;&nbsp; Space or Fire to shoot &nbsp;&middot;&nbsp; B or Bomb to clear the screen &nbsp;&middot;&nbsp; P / Esc to pause</p>
                <div className={styles.leaderboardPanel}>
                  <div className={styles.lbHeader}><span>Local Leaderboard</span><span>Top 10</span></div>
                  <LeaderboardList entries={scores} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {mode === 'paused' && (
        <section className={styles.overlay}>
          <div className={styles.dialog + ' ' + styles.compactDialog} role="dialog" aria-modal="true" aria-labelledby="pauseTitle">
            <div className={styles.copyBlock + ' ' + styles.padded}>
              <p className={styles.eyebrow}>Run suspended</p>
              <h2 id="pauseTitle">Paused</h2>
              <p className={styles.tagline}>The glider is held between layers until you return.</p>
            </div>
            <div className={styles.bodyBlock + ' ' + styles.padded}>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} type="button" onClick={() => engineRef.current?.requestResume()}>
                  Resume
                </button>
                <button className={styles.btnSecondary} type="button" onClick={() => engineRef.current?.startRun()}>
                  Restart
                </button>
                <button className={styles.btnSecondary} type="button" onClick={() => engineRef.current?.quitRun()}>
                  End Run
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {mode === 'gameover' && runResult && (
        <section className={styles.overlay}>
          <div className={styles.dialog + ' ' + styles.compactDialog + ' ' + styles.noScroll} role="dialog" aria-modal="true" aria-labelledby="gameOverTitle">
            <div className={styles.copyBlock + ' ' + styles.padded}>
              <p className={styles.eyebrow}>{runResult.reason === 'crash' ? 'Glider down' : 'Run ended'}</p>
              <h2 id="gameOverTitle">{runResult.reason === 'crash' ? 'Nice Flight' : 'Run Complete'}</h2>
              <p className={styles.tagline}>Your score is ready to save locally.</p>
            </div>
            <div className={styles.bodyBlock + ' ' + styles.gapSm + ' ' + styles.noScroll}>
              <div className={styles.statRow}>
                <div className={styles.statCard}><span>Score</span><strong>{runResult.score}</strong></div>
                <div className={styles.statCard}><span>Layer</span><strong>{runResult.wave}</strong></div>
                <div className={styles.statCard}><span>Time</span><strong>{formatTime(runResult.time)}</strong></div>
              </div>

              {saved ? (
                <p className={styles.hint}>Score saved to this device.</p>
              ) : (
                <form className={styles.nameForm} onSubmit={handleSaveScore}>
                  <label className={styles.srOnly} htmlFor="pilotName">Pilot name</label>
                  <input
                    id="pilotName"
                    name="pilotName"
                    maxLength={18}
                    autoComplete="nickname"
                    placeholder="Pilot name"
                    value={pilotName}
                    onChange={(event) => setPilotName(event.target.value)}
                  />
                  <button className={styles.btnPrimary} type="submit">Save Score</button>
                </form>
              )}

              <div className={styles.leaderboardPanel}>
                <div className={styles.lbHeader}><span>Local Leaderboard</span><span>Top 10</span></div>
                <LeaderboardList entries={scores} />
              </div>

              <div className={styles.actions}>
                <button className={styles.btnPrimary} type="button" onClick={() => engineRef.current?.startRun()}>
                  Fly Again
                </button>
                <button className={styles.btnSecondary} type="button" onClick={() => engineRef.current?.showMenu()}>
                  Menu
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
