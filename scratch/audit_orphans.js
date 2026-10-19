const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Temukan input/select yang benar-benar tidak berada di dalam <label> dan tidak punya aria-label atau label[for]
const inputRegex = /<(input|select|textarea)\b([^>]*)>/gi;
let m;
const orphanControls = [];

while ((m = inputRegex.exec(html)) !== null) {
  const tag = m[1].toLowerCase();
  const attrs = m[2];
  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
  const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
  if (type === 'hidden') continue;

  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : null;

  const hasAria = /aria-label=/i.test(attrs) || /aria-labelledby=/i.test(attrs);
  const hasLabelFor = id ? new RegExp('<label[^>]*for=["\']' + id + '["\']', 'i').test(html) : false;

  // Cek apakah elemen ini terbungkus di dalam <label> ... </label>
  const index = m.index;
  const before = html.substring(Math.max(0, index - 300), index);
  const after = html.substring(index, Math.min(html.length, index + 300));
  
  const lastOpenLabel = before.lastIndexOf('<label');
  const lastCloseLabel = before.lastIndexOf('</label>');
  const isInsideLabel = (lastOpenLabel > lastCloseLabel) && after.indexOf('</label>') !== -1;

  if (!hasAria && !hasLabelFor && !isInsideLabel) {
    orphanControls.push({ id, tag, type, snippet: m[0] });
  }
}

console.log('Truly orphan controls (need aria-label or label for WCAG AA):', orphanControls);
