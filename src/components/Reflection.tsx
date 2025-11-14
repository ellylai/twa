import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; 

// --- Types ---

// 1. Type for the props
type ReflectionProps = {
  readingId: string;
};

// 2. Type for a single reflection object coming from Supabase
type ReflectionItem = {
  id: number;       // The unique primary key for the reflection
  content: string;
  created_at: string;
};

// --- Component ---

function Reflection({ readingId }: ReflectionProps) {
  // 3. State for the LIST of reflections
  const [reflections, setReflections] = useState<ReflectionItem[]>([]);
  
  // 4. State for the NEW reflection being typed
  const [newReflection, setNewReflection] = useState<string>('');
  
  const [status, setStatus] = useState<string>('Ready'); 

  // 5. Load the LIST of reflections
  useEffect(() => {
    async function loadReflections() {
      setStatus('Loading...');
      
      // Select all reflections for this readingId, ordered by when they were created
      const { data, error } = await supabase
        .from('reflections')
        .select('id, content, created_at') // Get all needed fields
        .eq('reading_id', readingId)
        .order('created_at', { ascending: true }); // Show oldest first

      if (data) {
        setReflections(data);
      } else if (error) { 
        console.error('Error loading reflections:', error);
      }
      setStatus('Ready');
    }

    loadReflections();
  }, [readingId]); // Re-run if the readingId changes

  // 6. Save a NEW reflection
  async function handleSave() {
    if (newReflection.trim() === '') return; // Don't save empty reflections

    setStatus('Saving...');
    
    // We use .insert() to ALWAYS create a new row
    const { data, error } = await supabase
      .from('reflections')
      .insert({ 
        reading_id: readingId, 
        content: newReflection,
        // user_id: '...' // TODO: Add user_id
      })
      .select() // Ask Supabase to return the new row
      .single(); // We know we only inserted one

    if (error) {
      setStatus('Error!');
      console.error('Error saving reflection:', error);
    } else if (data) {
      // 7. Add the new reflection to our local list to update the UI
      setReflections(currentReflections => [...currentReflections, data]);
      setNewReflection(''); // Clear the text box
      setStatus('Saved!');
    }
  }

  // 8. Type the event 'e' from the textarea
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setNewReflection(e.target.value);
    setStatus('Ready'); // Clear status on edit
  }

  return (
    <div id="reflection-container">
      <h3>Overall Reflections</h3>
      
      {/* 9. Display the list of saved reflections */}
      <div id="reflections-list">
        {reflections.length === 0 && <p>No reflections yet.</p>}
        {reflections.map(item => (
          <div key={item.id} className="reflection-item">
            {/* We can format this date later */}
            <p>{item.content}</p>
            <small>{new Date(item.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>

      {/* 10. Show the box for adding a NEW reflection */}
      <div id="new-reflection-box">
        <h4>Add a new reflection</h4>
        <textarea
          id="reflection-text"
          placeholder="Write a new reflection..."
          value={newReflection}
          onChange={handleTextChange}
        />
        <button onClick={handleSave}>Save New Reflection</button>
        <span style={{ marginLeft: '10px' }}>{status}</span>
      </div>
    </div>
  );
}

export default Reflection;