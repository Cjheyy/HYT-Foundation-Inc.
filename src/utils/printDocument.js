/**
 * Print a standalone HTML document (e.g. a certificate) from the browser.
 *
 * There is no PDF library in this project, so the honest way to hand a user a
 * PDF is the browser's own "Save as PDF" destination.  This renders the
 * document into an off-screen iframe and opens the print dialog on it, which
 * produces a real PDF with selectable text — unlike the previous behaviour of
 * downloading a `.html` file.
 *
 * The iframe is removed on `afterprint`, with a timeout fallback for browsers
 * that never fire it.  Returns false when the iframe could not be prepared.
 */
const CLEANUP_FALLBACK_MS = 30_000;

export function printHtmlDocument(html, { title = 'Document' } = {}) {
  if (typeof document === 'undefined' || !html) return false;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', title);
  // Rendered off-screen at a real size: a 0×0 or display:none iframe is not
  // guaranteed to lay out its contents for the print engine.
  frame.style.position = 'absolute';
  frame.style.top = '-10000px';
  frame.style.left = '-10000px';
  frame.style.width = '1024px';
  frame.style.height = '768px';
  frame.style.border = '0';

  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    return false;
  }

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    try {
      frame.remove();
    } catch {
      /* already detached */
    }
  };

  frameWindow.onafterprint = cleanup;
  window.setTimeout(cleanup, CLEANUP_FALLBACK_MS);

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  // Force a layout pass so the document is complete before the dialog opens.
  void frame.offsetHeight;

  try {
    frameWindow.focus();
    frameWindow.print();
  } catch {
    cleanup();
    return false;
  }

  return true;
}

export default printHtmlDocument;
