import React from 'react';
import type { Highlight } from '../App'; // Import the type from App.tsx

// --- Types ---
type HighlightListProps = {
  highlights: Highlight[]; // Accepts highlights as a prop
};

function HighlightList({ highlights }: HighlightListProps) {
  // Group highlights by color
  const grouped = {
    green: highlights.filter(h => h.color_tag === 'green'),
    pink: highlights.filter(h => h.color_tag === 'pink'),
    blue: highlights.filter(h => h.color_tag === 'blue'),
  };

  return (
    <div className="highlight-list">
      <h3>Highlights</h3>
      
      {highlights.length === 0 && <p>No highlights yet.</p>}

      {grouped.green.length > 0 && (
        <div className="highlight-group">
          <h4>Green</h4>
          {grouped.green.map(h => (
            <div key={h.id} className="highlight-item item-green">
              <p>"{h.selected_text}"</p>
            </div>
          ))}
        </div>
      )}
      
      {grouped.pink.length > 0 && (
        <div className="highlight-group">
          <h4>Pink</h4>
          {grouped.pink.map(h => (
            <div key={h.id} className="highlight-item item-pink">
              <p>"{h.selected_text}"</p>
            </div>
          ))}
        </div>
      )}
      
      {grouped.blue.length > 0 && (
        <div className="highlight-group">
          <h4>Blue</h4>
          {grouped.blue.map(h => (
            <div key={h.id} className="highlight-item item-blue">
              <p>"{h.selected_text}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HighlightList;