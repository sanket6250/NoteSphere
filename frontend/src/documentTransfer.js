const ALLOWED_HTML_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'EM', 'H1', 'H2', 'H3', 'H4',
  'HR', 'I', 'LI', 'OL', 'P', 'PRE', 'S', 'STRONG', 'SUB', 'SUP', 'TABLE',
  'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL',
]);

const REMOVE_WITH_CONTENT_TAGS = new Set([
  'EMBED', 'IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'SVG',
]);

export function plainTextToHtml(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
    .join('');
}

export function sanitizeImportedHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html), 'text/html');
  const elements = [...parsed.body.querySelectorAll('*')].reverse();
  elements.forEach((element) => {
    const tag = element.tagName;
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      if (tag === 'IMG') {
        element.replaceWith(parsed.createTextNode(element.getAttribute('alt') || ''));
      } else if (REMOVE_WITH_CONTENT_TAGS.has(tag)) {
        element.remove();
      } else {
        element.replaceWith(...element.childNodes);
      }
      return;
    }

    const originalHref = tag === 'A' ? element.getAttribute('href') : null;
    const spans = tag === 'TD' || tag === 'TH'
      ? {
        colspan: element.getAttribute('colspan'),
        rowspan: element.getAttribute('rowspan'),
      }
      : null;
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (tag === 'A') {
      if (originalHref) {
        const href = originalHref.trim();
        try {
          const parsedUrl = new URL(href, window.location.origin);
          if (['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
            element.setAttribute('href', href);
            element.setAttribute('rel', 'noopener noreferrer');
          }
        } catch {
          element.removeAttribute('href');
        }
      }
    }
    if (tag === 'TD' || tag === 'TH') {
      ['colspan', 'rowspan'].forEach((name) => {
        const value = Number(spans[name]);
        if (Number.isInteger(value) && value > 0 && value <= 100) {
          element.setAttribute(name, String(value));
        }
      });
    }
  });

  return parsed.body.innerHTML || '<p></p>';
}

export async function importDocumentFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const mammothModule = await import('mammoth/mammoth.browser.js');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const content = sanitizeImportedHtml(result.value);
    if (!content.replace(/<[^>]*>/g, '').trim()) {
      throw new Error('The Word document contains no readable text.');
    }
    return content;
  }

  if (name.endsWith('.pdf')) {
    const [pdfjsModule, workerModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjsModule.GlobalWorkerOptions.workerSrc = workerModule.default;
    const pdf = await pdfjsModule.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`)
        .join('')
        .trim();
      if (pageText) pages.push(pageText);
    }
    const text = pages.join('\n\n');
    if (!text) {
      throw new Error('No selectable text was found. Scanned PDFs require OCR before import.');
    }
    return plainTextToHtml(text);
  }

  throw new Error('Choose a PDF or Word (.docx) document.');
}

export async function exportWordDocument(title, html) {
  const {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
  } = await import('docx');
  const parsed = new DOMParser().parseFromString(String(html), 'text/html');
  const paragraphs = [
    new Paragraph({ text: title || 'Untitled note', heading: HeadingLevel.HEADING_1 }),
  ];

  function inlineRuns(node, inheritedStyle = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue ? [new TextRun({ text: node.nodeValue, ...inheritedStyle })] : [];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const style = { ...inheritedStyle };
    if (['B', 'STRONG'].includes(node.tagName)) style.bold = true;
    if (['I', 'EM'].includes(node.tagName)) style.italics = true;
    if (node.tagName === 'U') style.underline = {};
    if (['S', 'DEL'].includes(node.tagName)) style.strike = true;
    if (node.tagName === 'SUB') style.subScript = true;
    if (node.tagName === 'SUP') style.superScript = true;
    return [...node.childNodes].flatMap((child) => inlineRuns(child, style));
  }

  function addParagraph(node, heading, prefix = '') {
    const children = prefix ? [new TextRun(prefix)] : [];
    children.push(...inlineRuns(node));
    paragraphs.push(new Paragraph({
      ...(heading ? { heading } : {}),
      children,
    }));
  }

  function visit(parent) {
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) addParagraph(node);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName;
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      const heading = {
        H1: HeadingLevel.HEADING_1,
        H2: HeadingLevel.HEADING_2,
        H3: HeadingLevel.HEADING_3,
        H4: HeadingLevel.HEADING_4,
      }[tag];
      if (heading) addParagraph(node, heading);
      else if (tag === 'P' || tag === 'BLOCKQUOTE' || tag === 'PRE') addParagraph(node);
      else if (tag === 'LI') addParagraph(node, undefined, '• ');
      else if (tag === 'TR') {
        const cells = [...node.querySelectorAll(':scope > th, :scope > td')]
          .map((cell) => cell.textContent.trim());
        addParagraph(parsed.createTextNode(cells.join('  |  ')));
      } else if (tag === 'IMG') {
        const alt = node.getAttribute('alt');
        if (alt) addParagraph(parsed.createTextNode(`[Image: ${alt}]`));
      } else visit(node);
    });
  }

  visit(parsed.body);
  const document = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(document);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
