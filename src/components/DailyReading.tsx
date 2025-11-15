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
// In src/components/DailyReading.tsx

// --- REPLACEMENT for applyHighlights ---
function applyHighlights(container: HTMLElement, highlights: Highlight[]) {
  
  // --- 1. Build maps using a recursive DOM traversal ---
  // This correctly includes text from child spans (like verse numbers).
  let virtualText = ""; // The original, "messy" text
  const indexMap: { node: Node, offset: number }[] = []; // Maps messy index -> DOM node
  
  let normalizedVirtualText = ""; // The "clean" text
  const normToOrigMap: number[] = []; // Maps clean index -> messy index

  // This recursive function mimics how selection.toString() builds its string.
  function buildMaps(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue || "";
      for (let i = 0; i < nodeText.length; i++) {
        const char = nodeText[i];
        const origIndex = virtualText.length; // Current end of the virtual string
        
        indexMap.push({ node: node, offset: i });
        virtualText += char; // Add to messy string

        // --- Normalization logic ---
        const isWhitespace = /[\s\n\u00A0]/.test(char);
        if (isWhitespace) {
          if (normalizedVirtualText.length > 0 && normalizedVirtualText[normalizedVirtualText.length - 1] !== ' ') {
            normalizedVirtualText += ' ';
            normToOrigMap.push(origIndex);
          }
        } else {
          normalizedVirtualText += char;
          normToOrigMap.push(origIndex);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // If it's an element, process its children
      const el = node as HTMLElement;
      
      // Filter out nodes we don't want to traverse
      if (el.tagName === 'MARK' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') {
        return;
      }

      for (let i = 0; i < node.childNodes.length; i++) {
        buildMaps(node.childNodes[i]);
      }

      // Add a space for block-level elements, just like selection.toString() does
      if (['P', 'H3', 'H4', 'DIV'].includes(el.tagName)) {
         if (normalizedVirtualText.length > 0 && normalizedVirtualText[normalizedVirtualText.length - 1] !== ' ') {
            normalizedVirtualText += ' ';
            normToOrigMap.push(virtualText.length); // Map to the *end* of the messy string
         }
      }
    }
  }

  // Start the traversal from the main container
  buildMaps(container);
  
  // This is our final, clean "haystack"
  const haystack = normalizedVirtualText.trim();
  // Find the trim offset
  const trimOffsetStart = normalizedVirtualText.indexOf(haystack);

  // --- 3. Find all ranges first ---
  const allRangesToWrap: { range: Range, highlight: Highlight }[] = [];

  for (const highlight of highlights) {
    // This is our clean "needle"
    const textToFind = highlight.selected_text.replace(/[\s\n\u00A0]+/g, " ").trim();
    if (!textToFind) continue;

    const normStartIndex = haystack.indexOf(textToFind);
    
    if (normStartIndex > -1) {
      const normEndIndex = normStartIndex + textToFind.length;

      // --- 4. Convert clean indexes back to original, messy indexes ---
      const origStartIndex = normToOrigMap[normStartIndex + trimOffsetStart]; 
      const origEndIndexInMap = normToOrigMap[normEndIndex - 1 + trimOffsetStart];

      if (origStartIndex === undefined || origEndIndexInMap === undefined) {
         console.error("Highlight mapping failed for:", textToFind);
         continue;
      }

      // Get all the DOM entries from the *original* map
      const affectedEntries = indexMap.slice(origStartIndex, origEndIndexInMap + 1);
      if (affectedEntries.length === 0) continue;

      // --- 5. Group by node (Same as before) ---
      const nodesToWrap = new Map<Node, { start: number, end: number }>();
      
      for (const { node, offset } of affectedEntries) {
        if (node.nodeType !== Node.TEXT_NODE || node.parentElement?.tagName === 'MARK') {
            continue; 
        }
        const existing = nodesToWrap.get(node);
        if (!existing) {
          nodesToWrap.set(node, { start: offset, end: offset });
        } else {
          existing.end = offset;
        }
      }
      
      // --- 6. Create sub-ranges (Same as before) ---
      for (const [node, { start, end }] of nodesToWrap.entries()) {
          try {
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end + 1);
            allRangesToWrap.push({ range, highlight });
          } catch (e) {
            console.error("Failed to create sub-range", e);
          }
      }
    }
  }

  // --- 7. Apply all ranges, backwards (Same as before) ---
  for (const item of allRangesToWrap.reverse()) {
    if (item.range.startContainer.parentElement?.tagName === 'MARK') {
      continue; 
    }
    try {
      const mark = document.createElement('mark');
      mark.className = `highlight-${item.highlight.color_tag}`;
      mark.dataset.highlightId = String(item.highlight.id);
      item.range.surroundContents(mark);
    } catch (e) {
      console.error("Failed to wrap final range for highlight:", item.highlight.id, e);
    }
  }
}

function getTopLevelBlock(node: Node, container: HTMLElement) {
  let parent = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
  while (parent && parent !== container) {
    // These are the tags that break up text nodes
    if (['H3', 'H4'].includes(parent.tagName)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return container; // Fallback to container
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

  useEffect(() => {
    const handleDocumentMouseUp = (e: MouseEvent) => {
      const container = containerRef.current;

      // 1. Do nothing if click is on the menu
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      
      // 2. Do nothing if click is on an existing highlight (let handleClick handle it)
      if ((e.target as HTMLElement).tagName === 'MARK') {
        return;
      }

      if (!container) return;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        
        // 3. Check if selection is fully inside the container
        if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) {
          // Selection is outside, so hide menu
          setMenuState(null);
          savedRange.current = null;
          return;
        }

        const range = sel.getRangeAt(0);
        const startBlock = getTopLevelBlock(range.startContainer, container);
        const endBlock = getTopLevelBlock(range.endContainer, container);

        // // If the start/end blocks are different, it's an invalid highlight
        if (startBlock !== endBlock) {
          // Selection is invalid (spans paragraphs, headers, etc.)
          // Hide menu and reset selection
          setMenuState(null);
          savedRange.current = null;
          window.getSelection()?.removeAllRanges();
          return; // Stop processing
        }

        // // --- 4. Valid selection: Show menu ---
        savedRange.current = range;
        const rect = range.getBoundingClientRect();
        setMenuState({
          top: window.scrollY + rect.top - 40,
          left: window.scrollX + rect.left + (rect.width / 2) - 60,
        });
      } else {
        // --- 5. No selection: Hide menu ---
        setMenuState(null);
        savedRange.current = null;
      }
    };

    // Add listener to the document
    document.addEventListener('mouseup', handleDocumentMouseUp);

    // Cleanup
    return () => {
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [containerRef, menuRef]);

  const handleSelectColor = (color: string) => {
    window.getSelection()?.removeAllRanges();

    if (savedRange.current) {
      const textToSave = savedRange.current.toString()
        .replace(/[\s\n\u00A0]+/g, " ")
        .trim();
      
      if (textToSave) {
        onSaveHighlight(color, textToSave);
      }
    }
    setMenuState(null);
    savedRange.current = null;
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
          ref={menuRef}
          top={menuState.top}
          left={menuState.left}
          onSelectColor={handleSelectColor}
        />
      )}

      <div
        id="reading-text-container"
        className="passage-content"
        ref={containerRef}
        onClick={handleClick} 
      />
    </>
  );
}
export default React.memo(DailyReading);