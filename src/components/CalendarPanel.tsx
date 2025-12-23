import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

type CalendarPanelProps = {
  onSelectDate: (dayKey: string) => void;
  currentDayKey: string;
};

function CalendarPanel({ onSelectDate, currentDayKey }: CalendarPanelProps) {
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    async function fetchAllAvailableDays() {
      const { data } = await supabase.from('daily_passages').select('day_key');
      if (data) setAvailableDays(new Set(data.map(d => d.day_key)));
    }
    fetchAllAvailableDays();
  }, []);

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const jumpToToday = () => {
    const today = new Date();
    setViewDate(today);
    const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (availableDays.has(todayKey)) {
      onSelectDate(todayKey);
    }
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="calendar-container">
      <div className="calendar-nav">
        <button onClick={() => changeMonth(-1)}>&lt;</button>
        <div className="calendar-title">
          <h4>{viewDate.toLocaleString('default', { month: 'long' })}</h4>
          <button className="btn-today" onClick={jumpToToday}>Today</button>
        </div>
        <button onClick={() => changeMonth(1)}>&gt;</button>
      </div>
      
      <div className="calendar-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="weekday">{d}</div>)}
        {Array(firstDayOfMonth).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const dayKey = `${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isAvailable = availableDays.has(dayKey);
          const isActive = dayKey === currentDayKey;

          return (
            <button
              key={day}
              disabled={!isAvailable}
              className={`calendar-day ${isAvailable ? 'available' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => onSelectDate(dayKey)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarPanel;