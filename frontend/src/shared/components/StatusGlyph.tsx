type StatusGlyphProps = {
  kind: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
};

export function StatusGlyph({ kind, tone = 'neutral' }: StatusGlyphProps) {
  return (
    <span className={`status-glyph status-glyph--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {renderGlyph(kind)}
      </svg>
    </span>
  );
}

function renderGlyph(kind: string) {
  switch (kind) {
    case 'CAM':
      return (
        <>
          <rect x="4" y="7" width="12" height="10" rx="2" />
          <path d="M16 10l4-2v8l-4-2z" />
          <circle cx="10" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </>
      );
    case 'ASK':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M10.4 10.2a1.8 1.8 0 113.2 1.1c0 1.1-1.4 1.5-1.6 2.7" />
          <circle cx="12" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case 'DENY':
    case 'ERR':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </>
      );
    case 'MISS':
      return (
        <>
          <rect x="5" y="7" width="10" height="8" rx="2" />
          <path d="M15 10l3-1.5v6L15 13M6 18l12-12" />
        </>
      );
    case 'LOCK':
      return (
        <>
          <rect x="6" y="11" width="12" height="8" rx="2" />
          <path d="M8.5 11V8.8A3.5 3.5 0 0112 5.5a3.5 3.5 0 013.5 3.3V11" />
        </>
      );
    case 'WEB':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M4.5 12h15M12 4.5a13 13 0 010 15M12 4.5a13 13 0 000 15" />
        </>
      );
    case '3-2':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 9.2c.8-.7 3.2-.8 3.8.5.4.8-.4 1.7-1.4 2.1 1.3.2 2 .9 2 1.8 0 1.5-2 2.4-4.4 1.7" />
        </>
      );
    case 'REC':
      return (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </>
      );
    case 'PAUSE':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.5 8.5v7M14.5 8.5v7" />
        </>
      );
    case 'HOLD':
      return (
        <>
          <path d="M6 9h12M8 9V7h8v2M8 9v8h8V9" />
          <path d="M10 12h4M10 14.5h4" />
        </>
      );
    case 'HUD':
      return (
        <>
          <rect x="5" y="6" width="14" height="12" rx="2" />
          <path d="M8 10h8M8 13h4M14 13h2" />
        </>
      );
    case 'ALT':
      return (
        <>
          <path d="M6 7h12v10H6z" />
          <path d="M8.5 10.5l2.2 2.2L15.5 8.5" />
        </>
      );
    case 'LIVE':
      return (
        <>
          <path d="M7 8.5A6 6 0 0112 6a6 6 0 015 2.5" />
          <path d="M5.5 11A8 8 0 0112 8a8 8 0 016.5 3" />
          <circle cx="12" cy="15.5" r="2.2" fill="currentColor" stroke="none" />
        </>
      );
    case 'USR':
      return (
        <>
          <circle cx="12" cy="9" r="3" />
          <path d="M6.5 18c1.4-2.7 3.3-4 5.5-4s4.1 1.3 5.5 4" />
        </>
      );
    case 'SAMP':
    case 'SAVE':
      return (
        <>
          <path d="M7 5.5h8l2 2V18H7z" />
          <path d="M9 5.5v4h6v-2" />
          <path d="M9 13h6" />
        </>
      );
    case 'RDY':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 12.2l2.2 2.2 4.8-5.1" />
        </>
      );
    case 'CLR':
      return (
        <>
          <path d="M12 4.8l2.3 4.7 5.2.8-3.7 3.7.9 5.2-4.7-2.5-4.7 2.5.9-5.2-3.7-3.7 5.2-.8z" />
        </>
      );
    case 'PTS':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 15.5V8.5h3.1a2.3 2.3 0 110 4.6H9" />
        </>
      );
    case 'WAIT':
    default:
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </>
      );
  }
}
