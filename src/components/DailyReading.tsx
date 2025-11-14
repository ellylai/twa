import React, { useState, useRef, useEffect } from 'react';
import HighlightMenu from './HighlightMenu';
import type { Highlight } from '../App'; // Import the type
import './DailyReading.css';

// --- Types ---
type DailyReadingProps = {
  passageHtml: string;
  highlights: Highlight[];
  // --- UPDATED Prop Signature ---
  onSaveHighlight: (color: string, text: string) => void;
  onDeleteHighlight: (id: number) => void;
};

type MenuState = {
  top: number;
  left: number;
} | null;

// --- Utility Function to apply highlights on load ---
// This complex function is necessary to find and wrap text
// that might span across multiple HTML elements.
function applyHighlights(container: HTMLElement, highlights: Highlight[]) {
  // We need to operate on a fresh copy of the text nodes
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes: Node[] = [];
  while (walker.nextNode()) {
    // We only care about nodes with actual text content
    if (walker.currentNode.nodeValue?.trim() !== "") {
      textNodes.push(walker.currentNode);
    }
  }

  // Iterate over each text node *backwards* to avoid node splitting issues
  for (const node of textNodes.reverse()) {
    let text = node.nodeValue || '';
    
    // Check this node against all highlights
    for (const highlight of highlights) {
      const textToFind = highlight.selected_text;
      let index = text.indexOf(textToFind);
      
      while (index > -1) {
        // --- Match Found ---
        const parent = node.parentNode;
        if (!parent) continue;

        // Split the text node into three parts:
        // 1. Text before the highlight
        const before = document.createTextNode(text.substring(0, index));
        
        // 2. The <mark> tag
        const mark = document.createElement('mark');
        mark.className = `highlight-${highlight.color_tag}`;
        mark.textContent = textToFind;
        mark.dataset.highlightId = String(highlight.id); // Add ID for deletion
        
        // 3. Text after the highlight
        const after = document.createTextNode(text.substring(index + textToFind.length));

        // 4. Replace the old text node with the new parts
        parent.insertBefore(before, node);
        parent.insertBefore(mark, node);
        parent.insertBefore(after, node);
        parent.removeChild(node);

        // Continue searching in the 'after' node for more matches
        text = after.nodeValue || '';
        index = text.indexOf(textToFind);
      }
    }
  };
}

// --- Component ---
function DailyReading({ passageHtml, highlights, onSaveHighlight, onDeleteHighlight }: DailyReadingProps) {
  const [menuState, setMenuState] = useState<MenuState>(null);
  const savedRange = useRef<Range | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- UPDATED useEffect ---
  // This "wipe and redraw" logic is the most robust way
  // to keep the view in sync with the database.
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // 1. Set the clean HTML. This clears all old highlights.
      container.innerHTML = passageHtml;
      
      // 2. Apply all saved highlights from the database
      if (highlights.length > 0) {
        applyHighlights(container, highlights);
      }
    }
    // The '!isLoaded.current' check was a bug and has been removed.
    // This now runs *every time* the highlights prop changes.
  }, [passageHtml, highlights]); 

  // --- This is the same ---
  const handleMouseUp = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'MARK') return;

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

  // --- UPDATED handleSelectColor ---
  const handleSelectColor = (color: string) => {
    if (savedRange.current) {
      const textToSave = savedRange.current.toString().trim();
      
      // 1. Save to database (using the new signature)
      // App.tsx will handle the state update,
      // which triggers our useEffect to redraw.
      onSaveHighlight(color, textToSave);
    }

    // 2. Hide menu
    setMenuState(null);
    savedRange.current = null;
    window.getSelection()?.removeAllRanges();
  };

  // --- This is the same ---
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    if (target.tagName === 'MARK' && target.dataset.highlightId) {
      const id = target.dataset.highlightId;
      if (window.confirm("Delete this highlight?")) {
        onDeleteHighlight(Number(id));
      }
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

      <div
        id="reading-text-container"
        className="passage-content"
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onClick={handleClick} 
      />
    </>
  );
}
export default React.memo(DailyReading);