import React from 'react';
import Reflection from './Reflection';
import HighlightList from './HighlightList';
import type { Highlight } from '../App'; // Import the type from App.tsx

type AnnotationPanelProps = {
  readingId: string;
  highlights: Highlight[]; // Accepts highlights as a prop
};

function AnnotationPanel({ readingId, highlights }: AnnotationPanelProps) {
  return (
    <div>
      <Reflection readingId={readingId} />

      {/* Pass the highlights prop down */}
      <HighlightList highlights={highlights} />
    </div>
  );
}

export default AnnotationPanel;