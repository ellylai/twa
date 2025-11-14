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

  const handleSaveHighlight = async (color: string, selectedText: string) => {
    if (!data) return; 

    const trimmedText = selectedText.trim();
    if (!trimmedText) return;

    // --- DEBUG 1: Show what we are trying to save ---
    console.log("--- handleSaveHighlight ---");
    console.log("[DEBUG] Attempting to save highlight:", selectedText, "with color:", color);

    const { data: newHighlight, error } = await supabase
      .from('highlights')
      .insert({
        day_key: data.dayKey,
        color_tag: color,
        selected_text: selectedText,
        note: ""
      })
      .select()
      .single();

    // --- DEBUG 2: Log the raw response from Supabase ---
    console.log("[DEBUG] Supabase response:", { newHighlight, error });

    if (error) {
      console.error("Highlight save error:", error);
    } else if (newHighlight) {
      // --- DEBUG 3: This is what *should* happen ---
      console.log("Successfully added new highlight to state.");
      setHighlights(currentHighlights => [...currentHighlights, newHighlight]);
    } else {
      // --- DEBUG 4: This is the *likely* problem ---
      console.warn("Highlight saved, but newHighlight is null/undefined! setHighlights was NOT called.");
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
    return <main><p>Loading today's TWA...</p></main>;
  }
  
  if (error || !data) {
    return <main><p>Error: {error || 'Could not load data'}</p></main>;
  }

  return (
    <main>
      <header>
        <h1>Today's Time with Abba</h1>
        <h2>{data.formattedDate}</h2>
      </header>

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