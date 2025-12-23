import React, { useState } from 'react'; // Added useState
import Reflection from './Reflection';
import HighlightList from './HighlightList';
import CalendarPanel from './CalendarPanel'; // Added import
import type { Highlight } from '../App';

type AnnotationPanelProps = {
  readingId: string;
  highlights: Highlight[];
  onSelectDate: (dayKey: string) => void; // Added prop
};

function AnnotationPanel({ readingId, highlights, onSelectDate }: AnnotationPanelProps) {
  const [view, setView] = useState<'annotations' | 'calendar'>('annotations');

  return (
    <div>
      <div className="panel-tabs">
        <button 
          className={view === 'annotations' ? 'active-tab' : ''} 
          onClick={() => setView('annotations')}
        >
          Reflections
        </button>
        <button 
          className={view === 'calendar' ? 'active-tab' : ''} 
          onClick={() => setView('calendar')}
        >
          Calendar
        </button>
      </div>

      {view === 'annotations' ? (
        <>
          <Reflection readingId={readingId} />
          <HighlightList highlights={highlights} />
        </>
      ) : (
        <CalendarPanel 
          currentDayKey={readingId} 
          onSelectDate={(date) => {
            onSelectDate(date);
            setView('annotations'); 
          }} 
        />
      )}
    </div>
  );
}

export default AnnotationPanel;