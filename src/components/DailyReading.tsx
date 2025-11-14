import React, { useState, useRef, useEffect } from 'react';
import HighlightMenu from './HighlightMenu';
import type { Highlight } from '../App';
import './DailyReading.css';

// --- Types ---
type DailyReadingProps = {
  passageHtml: string;
  highlights: Highlight[];
  onSaveHighlight: (highlight: Omit<Highlight, 'id' | 'created_at'>) => void;
  onDeleteHighlight: (id: number) => void;
};

type MenuState = {
  top: number;
  left: number;
} | null;

// --- Utility Function to wrap a DOM Range ---
function wrapRange(range: Range, colorClass: string, id: number) {
  const mark = document.createElement('mark');
  mark.className = `highlight-${colorClass}`;
  mark.dataset.highlightId = String(id); // Add ID for deletion
  try {
    // This fallback is more reliable
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  } catch (e) {
    console.error("Highlight wrap failed.", e);
  }
}

// --- Utility Function to apply highlights on load ---
// This is a complex but necessary function to find text
// across multiple HTML tags (like verse numbers).
function applyHighlights(container: HTMLElement, highlights: Highlight[]) {
  // We can't use simple string search. We must walk the text nodes.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes: Node[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.nextNode()!);
  }

  for (const h of highlights) {
    const textToFind = h.selected_text;
    let foundStart = false;
    let charCount = 0;
    const range = document.createRange();

    for (const node of textNodes) {
      const text = node.nodeValue || '';
      if (foundStart) {
        // We are in the middle of a highlight
        const remaining = textToFind.length - charCount;
        if (text.length >= remaining) {
          // This is the last node
          range.setEnd(node, remaining);
          wrapRange(range, h.color_tag, h.id);
          foundStart = false;
          break; // Move to the next highlight
        } else {
          // This node is part of the highlight, but not the end
          range.setEndAfter(node);
          charCount += text.length;
        }
      } else {
        // We are looking for the start
        const index = text.indexOf(textToFind);
        if (index > -1) {
          // --- Simple Case: Highlight is within one node ---
          range.setStart(node, index);
          range.setEnd(node, index + textToFind.length);
          wrapRange(range, h.color_tag, h.id);
          break; // Move to the next highlight
        }

        // --- Complex Case: Highlight might start in this node ---
        // Check if this node is the start of the highlight
        if (textToFind.startsWith(text.trim()) && text.trim().length > 0) {
          foundStart = true;
          range.setStart(node, text.indexOf(text.trim()));
          charCount = text.trim().length;
        }
      }
    }
  }
}

// --- Component ---
function DailyReading({ passageHtml, highlights, onSaveHighlight, onDeleteHighlight }: DailyReadingProps) {
  const [menuState, setMenuState] = useState<MenuState>(null);
  const savedRange = useRef<Range | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoaded = useRef(false); // Prevent re-running useEffect

  // --- This useEffect now *only* runs ONCE ---
  useEffect(() => {
    const container = containerRef.current;
    if (container && passageHtml && !isLoaded.current) {
      // 1. Set the clean HTML
      container.innerHTML = passageHtml;
      
      // 2. Apply all saved highlights from the database
      if (highlights.length > 0) {
        // We must delay this slightly to let React render the HTML
        setTimeout(() => {
          applyHighlights(container, highlights);
        }, 0);
      }
      isLoaded.current = true; // Mark as loaded
    }
  }, [passageHtml, highlights]); // We pass highlights here to get the initial load

  // --- This is the same as before ---
  const handleMouseUp = (e: React.MouseEvent) => {
    // Don't show menu if we clicked an existing highlight
    if ((e.target as HTMLElement).tagName === 'MARK') {
      return;
    }

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      const range = sel.getRangeAt(0);
      savedRange.current = range;
      const rect = range.getBoundingClientRect();
      setMenuState({
        top: window.scrollY + rect.top - 40,
        left: window.scrollX + rect.left + (rect.width / 2) - 60,
      });
    } else {
      setMenuState(null);
      savedRange.current = null;
    }
  };

  // --- This now wraps the highlight immediately ---
  const handleSelectColor = (color: string) => {
    if (savedRange.current) {
      const textToSave = savedRange.current.toString().trim();
      
      // 1. Save to database
      onSaveHighlight({
        day_key: 'will-be-set-in-app',
        color_tag: color,
        selected_text: textToSave,
        note: ""
      });
    }

    // 2. Hide menu
    setMenuState(null);
    savedRange.current = null;
    window.getSelection()?.removeAllRanges();
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if we clicked a <mark> tag
    if (target.tagName === 'MARK' && target.dataset.highlightId) {
      const id = target.dataset.highlightId;
      if (window.confirm("Delete this highlight?")) {
        // 1. Delete from database (which triggers re-render)
        onDeleteHighlight(Number(id));
      }
      
      // 2. Hide menu and clear selection
      setMenuState(null);
      savedRange.current = null;
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <>
      {menuState && (
        <HighlightMenu
          top={menuState.top}
          left={menuState.left}
          onSelectColor={handleSelectColor}
        />
      )}

      {/* We use the ref to manage the content */}
      <div
        id="reading-text-container"
        className="passage-content"
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onClick={handleClick} // Add the click handler
      />
    </>
  );
}

export default React.memo(DailyReading);