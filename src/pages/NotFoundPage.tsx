import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: '#07050a',
        color: '#f4effb',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        padding: '2rem'
      }}
    >
      <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', margin: 0 }}>404</h1>
      <p style={{ maxWidth: 420, color: '#a79ab9' }}>
        This layer of the arcade has not been built yet. Head back to the arcade entrance.
      </p>
      <Link
        to="/"
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: 999,
          background: '#22d3ee',
          color: '#07050a',
          fontWeight: 700,
          textDecoration: 'none'
        }}
      >
        Back to Driftline Arcade
      </Link>
    </div>
  );
}
