import React from 'react'
import DailyReading from './components/DailyReading'
import Reflection from './components/Reflection'
import './App.css' 

function App() {
  const passageReference = "John 1:1-14";
  const todayKey = new Date().toISOString().split('T')[0]; // e.g., "2025-11-13"

  return (
    <main>
      <header>
        <h1>Daily Reading</h1>
        <h2>{passageReference}</h2>
      </header>

      <DailyReading passage={passageReference} />
      
      <Reflection readingId={todayKey} />
    </main>
  )
}

export default App