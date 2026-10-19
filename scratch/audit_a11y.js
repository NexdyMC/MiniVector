const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// 1. Global Page Checks
const langMatch = html.match(/<html\b[^>]*lang=["']([^"']+)["']/i);
const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
const viewportMatch = html.match(/<meta\b[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);

console.log('=== 1. GLOBAL PAGE CHECKS ===');
console.log('Language tag (html lang):', langMatch ? langMatch[1] : 'MISSING (WCAG 3.1.1)');
console.log('Page title:', titleMatch ? titleMatch[1] : 'MISSING (WCAG 2.4.2)');
console.log('Viewport meta:', viewportMatch ? viewportMatch[1] : 'MISSING');

// 2. Button checks (must have visible text, title, or aria-label)
console.log('\n=== 2. BUTTON ACCESSIBILITY CHECKS ===');
const buttonRegex = /<button\b([^>]*)>(.*?)<\/button>/gis;
let m;
const missingBtnA11y = [];
while ((m = buttonRegex.exec(html)) !== null) {
  const attrs = m[1];
  const inner = m[2].replace(/<[^>]+>/g, '').trim();
  const hasAria = /aria-label=/i.test(attrs) || /aria-labelledby=/i.test(attrs);
  const hasTitle = /title=/i.test(attrs);
  if (!inner && !hasAria && !hasTitle) {
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    missingBtnA11y.push({ id: idMatch ? idMatch[1] : 'no-id', snippet: m[0].substring(0, 100) });
  }
}
console.log('Buttons missing accessible name:', missingBtnA11y.length ? missingBtnA11y : 'NONE (All buttons have names!)');

// 3. Form input & select checks
console.log('\n=== 3. FORM INPUT & CONTROLS CHECKS ===');
const inputRegex = /<(input|select|textarea)\b([^>]*)>/gi;
const missingInputA11y = [];
while ((m = inputRegex.exec(html)) !== null) {
  const tag = m[1].toLowerCase();
  const attrs = m[2];
  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
  const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
  if (type === 'hidden') continue;
  const hasAria = /aria-label=/i.test(attrs) || /aria-labelledby=/i.test(attrs);
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : null;
  const hasLabelFor = id ? new RegExp('<label[^>]*for=["\']' + id + '["\']', 'i').test(html) : false;
  if (!hasAria && !hasLabelFor) {
    missingInputA11y.push({ tag, id, type, snippet: m[0] });
  }
}
console.log('Inputs missing label or aria-label:', missingInputA11y.length ? missingInputA11y : 'NONE (All inputs labeled!)');

// 4. Focusable elements tabindex check
console.log('\n=== 4. TABINDEX & KEYBOARD TRAPS ===');
const tabMatches = [...html.matchAll(/tabindex=["']([^"']+)["']/gi)].map(x => x[1]);
console.log('Positive tabindex found (should avoid tabindex > 0):', tabMatches.filter(t => parseInt(t, 10) > 0));

// 5. Image Alt check
console.log('\n=== 5. IMAGE ALT ATTRIBUTE CHECKS ===');
const imgRegex = /<img\b([^>]*)>/gi;
const missingImgAlt = [];
while ((m = imgRegex.exec(html)) !== null) {
  if (!/alt=/i.test(m[1])) {
    missingImgAlt.push(m[0]);
  }
}
console.log('Images missing alt attribute:', missingImgAlt.length ? missingImgAlt : 'NONE (All images have alt!)');
