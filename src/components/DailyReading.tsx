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
  // We must process one highlight at a time, because each
  // one modifies the DOM, invalidating node references for the next one.
  for (const highlight of highlights) {
    // 1. Get all text nodes, IN ORDER. We must do this fresh
    //    for every highlight, as the previous one changed the DOM.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const allTextNodes: Node[] = [];
    
    // Filter out nodes that are already inside a <mark>
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement?.tagName !== 'MARK') {
        allTextNodes.push(walker.currentNode);
      }
    }

    // 2. Build the "virtual" string and index map
    let virtualText = "";
    const indexMap: { node: Node, offset: number }[] = [];
    
    for (const node of allTextNodes) {
      const nodeText = node.nodeValue || "";
      for (let i = 0; i < nodeText.length; i++) {
        indexMap.push({ node: node, offset: i });
      }
      virtualText += nodeText;
    }

    // 3. Normalize both the "haystack" (virtual text) and the "needle" (saved text)
    //    This is the key to finding a match.
    const normalizedVirtualText = virtualText.replace(/[\s\n\u00A0]+/g, " ").trim();
    const textToFind = highlight.selected_text.replace(/[\s\n\u00A0]+/g, " ").trim();

    if (!textToFind) continue; // Don't process empty highlights

    // 4. Find the highlight in the virtual text
    const startIndex = normalizedVirtualText.indexOf(textToFind);
    if (startIndex === -1) {
      // console.warn(`Highlight ${highlight.id} NOT FOUND:`, JSON.stringify(textToFind));
      continue; // This highlight isn't in the current text nodes, skip it
    }
    
    const endIndex = startIndex + textToFind.length;

    // 5. Get all the {node, offset} entries for this highlight
    const affectedEntries = indexMap.slice(startIndex, endIndex);

    // 6. Group the entries by node, so we know which *parts*
    //    of each text node to wrap.
    const nodesToWrap = new Map<Node, { start: number, end: number }>();
    
    for (const { node, offset } of affectedEntries) {
      const existing = nodesToWrap.get(node);
      if (!existing) {
        nodesToWrap.set(node, { start: offset, end: offset });
      } else {
        existing.end = offset; // Just update the end offset
      }
    }

    // 7. Iterate over the nodes we need to modify and wrap them.
    //    We MUST go in reverse order so we don't invalidate
    //    text nodes that are earlier in the document.
    const nodes = Array.from(nodesToWrap.keys()).reverse();
    
    for (const node of nodes) {
      const { start, end } = nodesToWrap.get(node)!;
      
      try {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end + 1); // +1 because setEnd is exclusive

        const mark = document.createElement('mark');
        mark.className = `highlight-${highlight.color_tag}`;
        mark.dataset.highlightId = String(highlight.id);
        
        // This will now work, because the range is "clean"
        // and only operates on a single text node.
        range.surroundContents(mark);

      } catch (e) {
        console.error("Failed to wrap node for highlight:", highlight.id, e);
      }
    }
  }
}

function getTopLevelBlock(node: Node, container: HTMLElement) {
  let parent = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
  while (parent && parent !== container) {
    // These are the tags that break up text nodes
    if (['P', 'H3', 'H4'].includes(parent.tagName)) {
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