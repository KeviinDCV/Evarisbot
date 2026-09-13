import fs from 'fs';
import path from 'path';
const D = 'node_modules/lucide-react/dist/esm/icons';
const nombres = ['users','activity','shield-check','headphones','search','x','send','calendar','edit-3','trash-2','plus',
  'user-circle','message-square','messages-square','file-text','bar-chart-3','settings','panel-left-open','ellipsis',
  'check','chevron-right','mail','user-plus','sliders-horizontal','filter','key-round','log-out','circle-dot','clock','panel-left-close','chevron-down','list','layout-grid','user-round','info','lock','circle-alert','user-cog','calendar-days','shield','eye',
  'message-circle','phone','building-2','plug-zap','circle-check','webhook','audio-lines','spell-check','badge-check','loader-circle','hash','user-check','triangle-alert',
  'download','calendar-range','wallet','calendar-check-2','bot','trending-up','timer','arrow-right','award','file-spreadsheet','arrow-up-right',
  'upload','pause','play','square','arrow-up-down','arrow-up','arrow-down','chevron-left','calendar-x','arrow-left','circle-x','calendar-clock','refresh-cw',
  'paperclip','image','video','globe','megaphone','file-plus-2','columns-3','user','ban','message-square-text','type','square-check',
  'power','power-off','mouse-pointer-click','keyboard','workflow','chevron-up','save','list-checks','corner-down-right','flag','slash'];
const leer = (n, vistos = new Set()) => {
  if (vistos.has(n)) return null; vistos.add(n);
  const f = path.join(D, n + '.js');
  if (!fs.existsSync(f)) return null;
  const s = fs.readFileSync(f, 'utf8');
  const m = s.match(/const __iconNode = (\[[\s\S]*?\]);\n/);
  if (m) return m[1];
  const alias = s.match(/from '\.\/([a-z0-9-]+)\.js'/);
  return alias ? leer(alias[1], vistos) : null;
};
const out = {};
for (const n of nombres) {
  const src = leer(n);
  if (!src) { console.error('  NO ENCONTRADO: ' + n); continue; }
  const nodos = eval(src);
  out[n] = nodos.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}></${tag}>`;
  }).join('');
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(`  iconos extraidos: ${Object.keys(out).length}/${nombres.length}`);
