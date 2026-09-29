import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('v2/index.html','utf8');
const css=fs.readFileSync('v2/shell.css','utf8');
const js=fs.readFileSync('v2/shell.js','utf8');

const routes=['today','food','progress','strategy','more'];

for(const route of routes){
  const matches=html.match(new RegExp(`data-route="${route}"`,'g'))??[];
  assert.equal(matches.length,2,`${route} must exist once in desktop nav and once in mobile nav`);
  assert.match(html,new RegExp(`data-view="${route}"`),`Missing ${route} view`);
}

assert.equal((html.match(/data-primary-nav/g)??[]).length,2,'Shell must expose exactly desktop + mobile primary navigation.');
assert.doesNotMatch(html,/data-route="history"/,'Legacy History must not remain a primary 2.0 destination.');
assert.doesNotMatch(html,/data-route="trends"/,'Legacy Trends must not remain a primary 2.0 destination.');
assert.doesNotMatch(html,/data-route="insights"/,'Legacy Insights must not remain a primary 2.0 destination.');

assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,'Mobile nav must remain a single five-column row.');
assert.match(css,/height:calc\(var\(--bottom-nav\) \+ env\(safe-area-inset-bottom\)\)/,'Mobile nav must reserve one compact row plus safe area only.');
assert.match(css,/\.dc-bottom-nav small\{[^}]*white-space:nowrap/,'Mobile labels must stay on one line.');
assert.match(css,/@media \(max-width:760px\)/,'Mobile layout breakpoint is missing.');
assert.match(css,/@media \(prefers-reduced-motion:reduce\)/,'Reduced-motion support is required.');
assert.match(css,/@media \(prefers-color-scheme:dark\)/,'System dark mode support is required.');
assert.match(css,/:focus-visible/,'Visible keyboard focus is required.');
assert.match(css,/overflow-x:hidden/,'Horizontal overflow guard is required.');

assert.match(html,/class="skip-link"/,'Skip link is required.');
assert.match(html,/id="mainContent" tabindex="-1"/,'Main content must be programmatically focusable.');
assert.match(html,/aria-live="polite"/,'Shell feedback must be announced.');
assert.match(html,/No 2\.0 meal data connected yet/,'P2 must not fabricate meal data.');
assert.match(html,/Not connected/,'Disconnected placeholders must be explicit.');

assert.match(js,/const ROUTES = Object\.freeze/,'Route registry is required.');
for(const route of routes) assert.match(js,new RegExp(`\\b${route}:`),`JS route registry missing ${route}`);
assert.match(js,/sessionStorage\.setItem\('diet-v2-route'/,'Last route should be restored within the session.');
assert.match(js,/window\.DietV2Shell=Object\.freeze/,'Debug/certification surface is required.');
assert.match(js,/event\.key==='\/'/,'Food search shortcut is required.');
assert.doesNotMatch(js,/supabase|service_role|fetch\(/i,'P2 shell must not perform backend/network writes.');

console.log('Diet Copilot 2.0 P2 application shell tests passed.');
