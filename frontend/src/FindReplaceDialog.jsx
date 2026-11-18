import React, { useEffect, useMemo, useState } from 'react';
import { DialogFrame } from './OverlaySystem';

function isWordCharacter(character) {
  return Boolean(character && /[\p{L}\p{N}_]/u.test(character));
}

function findTextMatches(doc, search, matchCase, wholeWords) {
  if (!search) return [];

  const needle = matchCase ? search : search.toLowerCase();
  const matches = [];

  doc.descendants((block, blockPosition) => {
    if (!block.isTextblock) return;

    let text = '';
    const positions = [];
    block.descendants((node, relativePosition) => {
      if (node.isText) {
        text += node.text;
        for (let offset = 0; offset < node.text.length; offset += 1) {
          positions.push(blockPosition + 1 + relativePosition + offset);
        }
      } else if (node.isInline) {
        text += '\u0000';
        positions.push(null);
      }
    });

    const searchableText = matchCase ? text : text.toLowerCase();
    let offset = 0;
    while (offset <= searchableText.length - needle.length) {
      const index = searchableText.indexOf(needle, offset);
      if (index < 0) break;

      const end = index + needle.length;
      const matchPositions = positions.slice(index, end);
      const contiguous = matchPositions.length === needle.length
        && matchPositions.every((position, matchOffset) => (
          position !== null && position === matchPositions[0] + matchOffset
        ));
      const wordBoundariesMatch = !wholeWords
        || (!isWordCharacter(text[index - 1]) && !isWordCharacter(text[end]));

      if (contiguous && wordBoundariesMatch) {
        matches.push({
          from: matchPositions[0],
          to: matchPositions[matchPositions.length - 1] + 1,
        });
      }
      offset = index + Math.max(needle.length, 1);
    }
  });

  return matches;
}

export default function FindReplaceDialog({ editor, onClose }) {
  const [search, setSearch] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refreshMatches = () => setRevision((value) => value + 1);
    editor.on('transaction', refreshMatches);
    return () => editor.off('transaction', refreshMatches);
  }, [editor]);

  const matches = useMemo(
    () => findTextMatches(editor.state.doc, search.trim(), matchCase, wholeWords),
    [editor, search, matchCase, wholeWords, revision],
  );

  function selectMatch(index) {
    const match = matches[index];
    if (!match) return;
    setActiveIndex(index);
    editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run();
  }

  function findNext() {
    if (!matches.length) return;
    selectMatch(activeIndex < 0 ? 0 : (activeIndex + 1) % matches.length);
  }

  function findPrevious() {
    if (!matches.length) return;
    selectMatch(activeIndex <= 0 ? matches.length - 1 : activeIndex - 1);
  }

  function replaceCurrent() {
    const match = matches[activeIndex < 0 ? 0 : activeIndex];
    if (!match) return;
    editor.chain().focus().insertContentAt(
      { from: match.from, to: match.to },
      replacement,
    ).run();
    setActiveIndex(-1);
  }

  function replaceAll() {
    if (!matches.length) return;
    const chain = editor.chain().focus();
    [...matches].reverse().forEach((match) => {
      chain.insertContentAt({ from: match.from, to: match.to }, replacement);
    });
    chain.run();
    setActiveIndex(-1);
  }

  return (
    <DialogFrame
      className="create-dialog managed-dialog find-replace-dialog"
      labelId="find-replace-title"
      onClose={onClose}
    >
      <div className="dialog-heading">
        <div>
          <span className="dialog-eyebrow">EDIT DOCUMENT</span>
          <h2 id="find-replace-title">Find and replace</h2>
          <p>Search this note and replace one or all matches.</p>
        </div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); findNext(); }}>
        <label className="dialog-label" htmlFor="find-replace-search">FIND</label>
        <input
          id="find-replace-search"
          className="dialog-input"
          value={search}
          autoFocus
          onChange={(event) => {
            setSearch(event.target.value);
            setActiveIndex(-1);
          }}
        />
        <label className="dialog-label" htmlFor="find-replace-replacement">REPLACE WITH</label>
        <input
          id="find-replace-replacement"
          className="dialog-input"
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
        />
        <div className="find-replace-options">
          <label>
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(event) => {
                setMatchCase(event.target.checked);
                setActiveIndex(-1);
              }}
            />
            Match case
          </label>
          <label>
            <input
              type="checkbox"
              checked={wholeWords}
              onChange={(event) => {
                setWholeWords(event.target.checked);
                setActiveIndex(-1);
              }}
            />
            Whole words
          </label>
        </div>
        <div className="find-replace-status" aria-live="polite">
          {matches.length
            ? `${activeIndex < 0 ? 0 : activeIndex + 1} of ${matches.length} matches`
            : search.trim() ? 'No matches found' : 'Enter text to search'}
        </div>
        <div className="find-replace-navigation">
          <button type="button" className="dialog-cancel" disabled={!matches.length} onClick={findPrevious}>
            Previous
          </button>
          <button type="button" className="dialog-cancel" disabled={!matches.length} onClick={findNext}>
            Next
          </button>
        </div>
        <div className="dialog-footer">
          <button type="button" className="dialog-cancel" onClick={onClose}>Close</button>
          <button type="button" className="dialog-submit" disabled={!matches.length} onClick={replaceCurrent}>
            Replace
          </button>
          <button type="button" className="dialog-submit" disabled={!matches.length} onClick={replaceAll}>
            Replace all
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
