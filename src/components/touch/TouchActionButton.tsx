import styles from './TouchControls.module.css';

export interface TouchActionButtonProps {
  label: string;
  sublabel?: string;
  onPress: (active: boolean) => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

/**
 * Circular thumb-reachable action button (fire / bomb / jump / slide) styled
 * to sit alongside the TouchJoystick, mirroring the "movement stick + action
 * buttons" layout used by mobile shooters/runners.
 */
export function TouchActionButton({ label, sublabel, onPress, variant = 'primary', disabled }: TouchActionButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.actionButton} ${variant === 'secondary' ? styles.actionButtonSecondary : ''}`}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        onPress(true);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        onPress(false);
      }}
      onPointerCancel={() => onPress(false)}
      onPointerLeave={() => onPress(false)}
    >
      <span>{label}</span>
      {sublabel && <em>{sublabel}</em>}
    </button>
  );
}
