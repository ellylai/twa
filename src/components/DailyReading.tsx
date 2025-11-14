import React, { useState, useEffect } from 'react';
import './DailyReading.css'; 

const API_URL = 'https://bible-api.com/';

// 1. Define a type for the props this component receives
type DailyReadingProps = {
  passage: string;
};

// 2. Define a type for the data we get from the API
type Verse = {
  verse: number;
  text: string;
};

function DailyReading({ passage }: DailyReadingProps) {
  // 3. Type the state
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchReading() {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}${passage}`);
        // We cast the JSON response to the type we expect
        const data = await response.json();
        setVerses(data.verses as Verse[]);
      } catch (error) {
        console.error("Failed to fetch reading:", error);
      }
      setLoading(false);
    }

    fetchReading();
  }, [passage]);

  if (loading) {
    return <p>Loading reading...</p>;
  }

  return (
    <div id="reading-text-container">
      {verses.map(verse => (
        <div className="verse" key={verse.verse}>
          <span className="verse-number">{verse.verse}</span>
          <span className="verse-text">{verse.text}</span>
        </div>
      ))}
    </div>
  );
}

export default DailyReading;