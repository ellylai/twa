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
function applyHighlights(container: HTMLElement, highlights: Highlight[]) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes: Node[] = [];
  
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue?.trim() !== "") {
      textNodes.push(walker.currentNode);
    }
  }
  console.log("applyHighlights");
  // Iterate over each text node *backwards*
  for (const node of textNodes.reverse()) {
    const text = node.nodeValue || '';
    
    // Check this node against all highlights
    for (const highlight of highlights) {
      const textToFind = highlight.selected_text;
      
      const index = text.indexOf(textToFind); 
      
      if (index > -1) {
        // --- Match Found ---
        const parent = node.parentNode;
        if (!parent) continue;

        // 1. Text before
        const before = document.createTextNode(text.substring(0, index));
        
        // 2. The <mark> tag
        const mark = document.createElement('mark');
        mark.className = `highlight-${highlight.color_tag}`;
        mark.textContent = textToFind;
        mark.dataset.highlightId = String(highlight.id); 
        
        // 3. Text after
        const after = document.createTextNode(text.substring(index + textToFind.length));

        // 4. Replace the old text node
        parent.insertBefore(before, node);
        parent.insertBefore(mark, node);
        parent.insertBefore(after, node);
        parent.removeChild(node);
      }
    }
  }
}

// --- Component ---
function DailyReading({ passageHtml, highlights, onSaveHighlight, onDeleteHighlight }: DailyReadingProps) {
  const [menuState, setMenuState] = useState<MenuState>(null);
  const savedRange = useRef<Range | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);

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
  }, [passageHtml, highlights]); 

  const handleMouseUp = (e: React.MouseEvent) => {
    // We moved the check for MARK from handleClick to here
    if ((e.target as HTMLElement).tagName === 'MARK') return;

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      // --- Selection was made ---
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

  const handleSelectColor = (color: string) => {
    if (savedRange.current) {
      const textToSave = savedRange.current.toString().trim();
      onSaveHighlight(color, textToSave);
    }

    setMenuState(null);
    savedRange.current = null;
    window.getSelection()?.removeAllRanges();
  };

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