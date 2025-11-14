import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; 

// 1. Define a type for the props
type ReflectionProps = {
  readingId: string;
};

function Reflection({ readingId }: ReflectionProps) {
  // 2. Type the state variables
  const [reflection, setReflection] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready'); 

  useEffect(() => {
    async function loadReflection() {
      setStatus('Loading...');
      
      // Supabase's 'data' and 'error' are automatically typed
      const { data, error } = await supabase
        .from('reflections')
        .select('content')
        .eq('reading_id', readingId)
        .single(); 

      if (data) {
        setReflection(data.content);
      } else if (error && error.code !== 'PGRST116') { 
        console.error('Error loading reflection:', error);
      }
      setStatus('Ready');
    }

    loadReflection();
  }, [readingId]);

  async function handleSave() {
    setStatus('Saving...');
    
    const { error } = await supabase
      .from('reflections')
      .upsert({ 
        reading_id: readingId, 
        content: reflection,
      })
      .select();

    if (error) {
      setStatus('Error!');
      console.error('Error saving reflection:', error);
    } else {
      setStatus('Saved!');
    }
  }

  // 3. Type the event 'e' from the textarea
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReflection(e.target.value);
    setStatus('Ready'); 
  }

  return (
    <div id="reflection-container">
      <h3>Overall Reflection</h3>
      <textarea
        id="reflection-text"
        placeholder="Write your reflection..."
        value={reflection}
        onChange={handleTextChange} // Use the typed handler
      />
      <button onClick={handleSave}>Save Reflection</button>
      <span style={{ marginLeft: '10px' }}>{status}</span>
    </div>
  );
}

export default Reflection;