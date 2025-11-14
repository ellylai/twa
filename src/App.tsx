import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import DailyReading from './components/DailyReading'
import AnnotationPanel from './components/AnnotationPanel'
import './index.css'

type ApiData = {
  dayKey: string;
  formattedDate: string;
  passageHtml: string;
};

export type Highlight = {
  id: number;
  day_key: string;
  color_tag: string;
  selected_text: string;
  note: string;
};

function App() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const fetchData = async (dayKey: string) => {
    // 1. Fetch highlights for this day
    const { data: highlightsData, error: highlightsError } = await supabase
      .from('highlights')
      .select('*')
      .eq('day_key', dayKey)
      .order('created_at');
    
    if (highlightsError) console.error("Error fetching highlights:", highlightsError);
    if (highlightsData) setHighlights(highlightsData);
  };

  useEffect(() => {
    async function fetchPassage() {
      try {
        const response = await fetch('/api/get-passage');
        if (!response.ok) throw new Error('Failed to fetch data from API');
        
        const result = (await response.json()) as ApiData;
        
        setData(result);
        
        // --- NEW: Once we have the dayKey, fetch its highlights ---
        await fetchData(result.dayKey);

      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    }
    fetchPassage();
  }, []);

  const handleSaveHighlight = async (highlight: Omit<Highlight, 'id' | 'created_at'>) => {
    const { data: newHighlight, error } = await supabase
      .from('highlights')
      .insert({
        day_key: highlight.day_key,
        color_tag: highlight.color_tag,
        selected_text: highlight.selected_text
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving highlight:", error);
    } else if (newHighlight) {
      // Add the new highlight (with its new ID) to our local state
      setHighlights(currentHighlights => [...currentHighlights, newHighlight]);
    }
  };

  const handleDeleteHighlight = async (highlightId: number) => {
    const { error } = await supabase
      .from('highlights')
      .delete()
      .eq('id', highlightId);

    if (error) {
      console.error("Error deleting highlight:", error);
    } else {
      setHighlights(currentHighlights => 
        currentHighlights.filter(h => h.id !== highlightId)
      );
    }
  };

  if (loading) {
    return <main><p>Loading daily reading...</p></main>;
  }
  
  if (error || !data) {
    return <main><p>Error: {error || 'Could not load data'}</p></main>;
  }

  return (
    <main>
      <header>
        <h1>Daily Reading</h1>
        <h2>{data.formattedDate}</h2>
      </header>

      {/* --- NEW: Two-Column Layout --- */}
      <div className="app-layout">
        <div className="reading-column">
          <DailyReading 
            passageHtml={data.passageHtml}
            highlights={highlights}
            onSaveHighlight={handleSaveHighlight}
            onDeleteHighlight={handleDeleteHighlight}
          />
        </div>

        <div className="panel-column">
          <AnnotationPanel 
            readingId={data.dayKey} 
            highlights={highlights}
          />
        </div>
      </div>
    </main>
  );
}

export default App;