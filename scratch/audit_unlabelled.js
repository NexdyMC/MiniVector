const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Gunakan regex yang mencari tag <label>...</label> secara lengkap
const labels = [];
const labelRegex = /<label\b[^>]*>(.*?)<\/label>/gis;
let lm;
while ((lm = labelRegex.exec(html)) !== null) {
  labels.push({ start: lm.index, end: lm.index + lm[0].length, content: lm[0] });
}

// Periksa setiap interactive input / select / textarea
const controlRegex = /<(input|select|textarea)\b([^>]*)>/gi;
let cm;
const unlabelled = [];

while ((cm = controlRegex.exec(html)) !== null) {
  const tag = cm[1].toLowerCase();
  const attrs = cm[2];
  const idx = cm.index;

  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
  const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
  if (type === 'hidden') continue;

  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : null;

  const hasAria = /aria-label=/i.test(attrs) || /aria-labelledby=/i.test(attrs);
  const hasLabelFor = id ? new RegExp('<label[^>]*for=["\']' + id + '["\']', 'i').test(html) : false;
  const isInsideLabel = labels.some(l => idx > l.start && idx < l.end);

  if (!hasAria && !hasLabelFor && !isInsideLabel) {
    unlabelled.push({ id, tag, type, snippet: cm[0] });
  }
}

console.log('UNLABELLED CONTROLS COUNT:', unlabelled.length);
unlabelled.forEach(u => console.log(`- [${u.tag}#${u.id || 'no-id'}] (${u.type}): ${u.snippet}`));
