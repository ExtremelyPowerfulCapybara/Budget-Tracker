// Standalone Node.js test — run with: node tests/escapeHtml.test.js
const assert = require('assert');

// Copy the function here to test it in isolation
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

assert.strictEqual(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'angle brackets');
assert.strictEqual(escapeHtml('"hello"'), '&quot;hello&quot;', 'double quotes');
assert.strictEqual(escapeHtml("it's"), 'it&#39;s', 'single quote');
assert.strictEqual(escapeHtml('a & b'), 'a &amp; b', 'ampersand');
assert.strictEqual(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;', 'img injection');
assert.strictEqual(escapeHtml('" onclick="alert(1)'), '&quot; onclick=&quot;alert(1)', 'attribute breakout');
assert.strictEqual(escapeHtml(null), '', 'null');
assert.strictEqual(escapeHtml(undefined), '', 'undefined');
assert.strictEqual(escapeHtml(0), '0', 'zero');
assert.strictEqual(escapeHtml('safe text'), 'safe text', 'passthrough');
assert.strictEqual(escapeHtml(''), '', 'empty string');

console.log('All escapeHtml tests passed ✓');
