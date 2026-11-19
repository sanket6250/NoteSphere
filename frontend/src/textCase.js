import { TextSelection } from '@tiptap/pm/state';

export function transformTextCase(text, mode) {
  if (mode === 'uppercase') return text.toUpperCase();
  if (mode === 'lowercase') return text.toLowerCase();
  if (mode === 'capitalize') {
    return text.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, boundary, letter) => (
      `${boundary}${letter.toUpperCase()}`
    ));
  }
  if (mode === 'sentence') {
    return text.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_, boundary, letter) => (
      `${boundary}${letter.toUpperCase()}`
    ));
  }
  throw new Error(`Unsupported text case mode: ${mode}`);
}

export function changeSelectionCase(editor, mode) {
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return false;

  const replacements = [];
  state.doc.nodesBetween(from, to, (node, position) => {
    if (!node.isText) return;
    const start = Math.max(from, position) - position;
    const end = Math.min(to, position + node.nodeSize) - position;
    const text = node.text;
    const transformed = transformTextCase(text.slice(start, end), mode);
    if (transformed !== text.slice(start, end)) {
      replacements.push({
        from: position,
        to: position + node.nodeSize,
        text: `${text.slice(0, start)}${transformed}${text.slice(end)}`,
        marks: node.marks,
      });
    }
  });
  if (!replacements.length) return false;

  const transaction = state.tr;
  replacements.sort((left, right) => right.from - left.from).forEach((replacement) => {
    transaction.replaceWith(
      replacement.from,
      replacement.to,
      state.schema.text(replacement.text, replacement.marks),
    );
  });
  transaction.setSelection(TextSelection.create(
    transaction.doc,
    transaction.mapping.map(from, -1),
    transaction.mapping.map(to, 1),
  ));
  view.dispatch(transaction);
  view.focus();
  return true;
}
