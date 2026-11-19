const FORMATTER_MARKS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'subscript',
  'superscript',
];

export function captureFormatSnapshot(state, selection) {
  let sourceMarks = null;
  state.doc.nodesBetween(selection.from, selection.to, (node, position) => {
    if (node.isText && position + node.nodeSize > selection.from) {
      sourceMarks = node.marks;
      return false;
    }
    return undefined;
  });
  sourceMarks ||= state.storedMarks || selection.$from.marks();

  const textStyleMark = sourceMarks.find((mark) => mark.type.name === 'textStyle');
  const highlightMark = sourceMarks.find((mark) => mark.type.name === 'highlight');
  return {
    from: selection.from,
    to: selection.to,
    doc: state.doc,
    marks: FORMATTER_MARKS.filter((name) => sourceMarks.some((mark) => mark.type.name === name)),
    textStyle: textStyleMark
      ? Object.fromEntries(Object.entries(textStyleMark.attrs)
        .filter(([, value]) => value !== null && value !== undefined && value !== ''))
      : {},
    highlight: highlightMark ? { ...highlightMark.attrs } : null,
  };
}

export function applyFormatSnapshot(editor, painter, selection) {
  const chain = editor.chain().focus().setTextSelection({
    from: selection.from,
    to: selection.to,
  });
  FORMATTER_MARKS.forEach((mark) => {
    if (painter.marks.includes(mark)) chain.setMark(mark);
    else chain.unsetMark(mark);
  });
  chain.unsetMark('textStyle');
  if (Object.keys(painter.textStyle).length) chain.setMark('textStyle', painter.textStyle);
  chain.unsetMark('highlight');
  if (painter.highlight) chain.setMark('highlight', painter.highlight);
  return chain.run();
}
