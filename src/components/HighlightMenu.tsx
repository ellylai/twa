import React from 'react';

type HighlightMenuProps = {
  top: number;
  left: number;
  onSelectColor: (color: string) => void;
};

function HighlightMenu({ top, left, onSelectColor }: HighlightMenuProps) {
  return (
    <div
      className="highlight-menu"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="btn-green" onClick={() => onSelectColor('green')}>
        Green
      </button>
      <button className="btn-pink" onClick={() => onSelectColor('pink')}>
        Pink
      </button>
      <button className="btn-blue" onClick={() => onSelectColor('blue')}>
        Blue
      </button>
    </div>
  );
}

export default HighlightMenu;