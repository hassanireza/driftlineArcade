import { useEffect, useState } from 'react';
import { GamePanel } from '../components/GamePanel';
import { SplitPanelController } from '../components/SplitPanelController';
import { SkyfoldAmbientScene } from '../components/ambient/SkyfoldAmbientScene';
import { VoidrunnerAmbientScene } from '../components/ambient/VoidrunnerAmbientScene';

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function HomePage() {
  const [touchOnly, setTouchOnly] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  useEffect(() => {
    const controller = new SplitPanelController(setTouchOnly);
    return () => controller.dispose();
  }, []);

  const handleTouchActivate = (id: string) => {
    if (!touchOnly) return;
    setActivePanel((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <header className="masthead">
        <span className="masthead-logo">Driftline Arcade</span>
      </header>

      <main className="split" id="split">
        <GamePanel
          id="skyfold"
          variant="sky"
          number="01"
          eyebrow="I - Rite One"
          titleLines={['Skyfold', 'Aviary']}
          tagline="A single glider surfaces from absolute dark and finds only water below it."
          description="Skyfold opens in near-black stillness. A glider drifts between submerged terraces that may be architecture or may be something that used to be alive. Nothing moves quickly here, until a shape breaks formation and asks for an answer."
          features={[
            'Charge-based beam with visible cooldown rhythm',
            'Procedural terrace layers that escalate in density',
            'Touch-friendly directional controls for handheld play'
          ]}
          ctaLabel="Play Skyfold"
          ctaHref="/skyfold"
          sceneFactory={(canvas) => new SkyfoldAmbientScene(canvas)}
          icon={<ArrowIcon />}
          touchExpanded={activePanel === 'skyfold'}
          onTouchActivate={() => handleTouchActivate('skyfold')}
        />

        <div className="divider" aria-hidden="true">
          <span className="divider-line" />
          <span className="divider-badge">VS</span>
          <span className="divider-line" />
        </div>

        <GamePanel
          id="voidrunner"
          variant="void"
          number="02"
          eyebrow="II - Rite Two"
          titleLines={['Void', 'runner']}
          tagline="A lone figure runs the black shoreline with one instrument of light."
          description="Voidrunner is a procession at speed. One figure carries a single unfailing beam through a corridor of salt-dark obstacles that arrive without warning. Nothing here explains itself. Every run ends the same way, and is logged anyway."
          features={[
            'Infinite ammo laser for constant offensive pressure',
            'Run, jump, and slide layered into tight sequences',
            'High-contrast sci-fi HUD with live score and lives'
          ]}
          ctaLabel="Play Voidrunner"
          ctaHref="/voidrunner"
          sceneFactory={(canvas) => new VoidrunnerAmbientScene(canvas)}
          icon={<ArrowIcon />}
          touchExpanded={activePanel === 'voidrunner'}
          onTouchActivate={() => handleTouchActivate('voidrunner')}
        />
      </main>
    </>
  );
}
