import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AmbientCanvas } from './ambient/AmbientCanvas';
import type { GameEngine } from '../engine/GameEngine';

export interface GamePanelProps {
  id: string;
  variant: 'sky' | 'void';
  number: string;
  eyebrow: string;
  titleLines: [string, string];
  tagline: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  sceneFactory: (canvas: HTMLCanvasElement) => GameEngine;
  icon: ReactNode;
  touchExpanded: boolean;
  onTouchActivate: () => void;
}

export function GamePanel({
  id,
  variant,
  number,
  eyebrow,
  titleLines,
  tagline,
  description,
  features,
  ctaLabel,
  ctaHref,
  sceneFactory,
  icon,
  touchExpanded,
  onTouchActivate
}: GamePanelProps) {
  const [keyboardExpanded, setKeyboardExpanded] = useState(false);

  return (
    <section
      className={`panel panel-${variant}${touchExpanded ? ' panel--active' : ''}`}
      id={id}
      tabIndex={0}
      role="region"
      aria-labelledby={`${id}-title`}
      aria-expanded={keyboardExpanded || touchExpanded}
      onFocus={() => setKeyboardExpanded(true)}
      onBlur={() => setKeyboardExpanded(false)}
      onClick={onTouchActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setKeyboardExpanded((prev) => !prev);
        }
      }}
    >
      <AmbientCanvas className="panel-art-canvas" factory={sceneFactory} />
      <div className="ghost-num" aria-hidden="true">
        {number}
      </div>

      <div className="panel-content">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="panel-title" id={`${id}-title`}>
          {titleLines[0]}
          <br />
          {titleLines[1]}
        </h1>
        <p className="tagline">{tagline}</p>

        <div className="reveal">
          <p className="description">{description}</p>
          <ul className="feature-list">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <div className="cta-row">
            <Link className={`btn btn-${variant}`} to={ctaHref}>
              {icon}
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
