import React, { forwardRef } from 'react';

type HighlightMenuProps = {
  top: number;
  left: number;
  onSelectColor: (color: string) => void;
};

const HighlightMenu = forwardRef<HTMLDivElement, HighlightMenuProps>(
  ({ top, left, onSelectColor }, ref) => {
    return (
      <div
        ref={ref}
        className="highlight-menu"
        style={{ top: `${top}px`, left: `${left}px` }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
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
);

export default HighlightMenu;