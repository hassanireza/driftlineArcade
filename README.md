 # Driftline Arcade

![Driftline Arcade Banner](./assets/driftline-banner.png)

> Choose your path through the skies or the stars.

**Two Worlds. Two Playstyles. One Arcade.**

Driftline Arcade is a browser-based arcade collection featuring two original games built with modern web technologies. Each game delivers a distinct gameplay experience while sharing a unified visual identity, responsive design philosophy, and local progression systems.

Players can choose between the calm vertical progression of **Skyfold Aviary** or the fast-paced survival action of **Voidrunner** directly from a single landing page.

---

## Overview

Driftline Arcade explores two opposite approaches to arcade design.

### Skyfold Aviary

A floating world of layered terraces, drifting structures, and atmospheric skies.

Pilot a laser-equipped glider through increasingly complex aerial environments. Manage beam energy, navigate procedural obstacle patterns, and survive as the aviary expands around you.

**Core Features**

* Endless layer progression
* Charge-based laser system
* Dynamic obstacle generation
* Atmospheric visual design
* Desktop and mobile controls
* Local leaderboard support

### Voidrunner

A high-speed arcade runner set across the Martian frontier.

Control VEGA, a combat runner equipped with an infinite-energy laser. Jump, slide, dodge, and survive increasingly difficult obstacle sequences while chasing higher scores.

**Core Features**

* Endless score-based gameplay
* Infinite laser combat
* Jump and slide mechanics
* Progressive difficulty scaling
* Persistent local leaderboards
* Touch and keyboard support

---

## Project Goals

This project was created to explore:

* Distinct gameplay experiences within a shared ecosystem
* Responsive browser-based arcade games
* Lightweight performance-focused development
* Local-first progression systems
* Strong visual identity through custom artwork and UI design
* Modular JavaScript architecture

---

## Technology Stack

| Technology        | Purpose                        |
| ----------------- | ------------------------------ |
| HTML5             | Structure                      |
| CSS3              | Styling and responsive layouts |
| JavaScript (ES6+) | Game logic and systems         |
| Canvas API        | Real-time rendering            |
| Local Storage     | Save data and leaderboards     |
| SVG Assets        | Scalable interface graphics    |

---

## Project Structure

```text
/
├── index.html
├── styles.css
├── script.js
│
├── skyfold/
│   ├── index.html
│   ├── game.js
│   ├── entities.js
│   ├── renderer.js
│   ├── ui.js
│   ├── leaderboard.js
│   └── styles.css
│
├── voidrunner/
│   ├── index.html
│   ├── game.js
│   ├── entities.js
│   ├── renderer.js
│   ├── ui.js
│   ├── leaderboard.js
│   └── styles.css
│
└── assets/
```

---

## Design Philosophy

### Skyfold Aviary

Designed around:

* Exploration
* Vertical progression
* Environmental atmosphere
* Strategic pacing
* Visual calmness

### Voidrunner

Designed around:

* Readability
* Fast reactions
* Mechanical mastery
* High score competition
* Continuous action

Both games prioritize immediate accessibility while maintaining long-term replay value.

---

## Features

### Shared Systems

* Responsive desktop and mobile layouts
* Pause-safe gameplay loops
* Persistent local leaderboards
* Offline-compatible gameplay
* Lightweight architecture
* Fast loading performance

### User Experience

* Touch controls for mobile devices
* Keyboard support for desktop players
* Clear visual feedback
* High contrast interface design
* Consistent navigation between games

---

## Art Direction

### Skyfold Aviary

* Warm sunrise palette
* Floating architectural forms
* Atmospheric depth
* Soft geometric environments
* Minimalist sci-fi influences

### Voidrunner

* Pixel art presentation
* Neon sci-fi accents
* Martian landscapes
* High contrast silhouettes
* Retro arcade inspiration

---

## Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/driftline-arcade.git
```

Navigate to the project directory:

```bash
cd driftline-arcade
```

Open the landing page:

```bash
index.html
```

Or serve locally:

```bash
python -m http.server
```

Then visit:

```text
http://localhost:8000
```

---

## Browser Support

Tested on modern browsers including:

* Chrome
* Edge
* Firefox
* Safari

Mobile browsers are supported on both Android and iOS devices.

---

## Future Development

Planned improvements include:

* Achievement systems
* Additional game modes
* Expanded enemy variety
* Enhanced visual effects
* Global leaderboard integration
* Additional arcade titles

---

## Credits

**Design & Development**
Driftline Arcade
Co-authored-by: alternativeuniversal <295176832+alternativeuniversal@users.noreply.github.com>


**Games**

* Skyfold Aviary
* Voidrunner

Built for players who enjoy both atmospheric exploration and high-speed arcade action.
