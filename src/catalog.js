/* ablx.live — catalog filter. Progressive enhancement over fully-rendered HTML:
   with JS disabled the complete catalog is still there and crawlable. */
const q = document.getElementById('q');
const rack = document.getElementById('rack');
if (q && rack) {
  const modules = [...rack.querySelectorAll('.module[data-text]')];
  const chips = [...document.querySelectorAll('.chip[data-cat]')];
  const count = document.getElementById('count');
  const empty = document.getElementById('empty');
  const active = new Set();

  const apply = () => {
    const needle = q.value.trim().toLowerCase();
    let shown = 0;
    for (const m of modules) {
      const cats = m.dataset.cats.split(' ');
      const hit = (!needle || m.dataset.text.includes(needle)) &&
                  (!active.size || cats.some(c => active.has(c)));
      m.hidden = !hit;
      if (hit) shown++;
    }
    if (count) count.textContent = `${shown} shown`;
    if (empty) empty.hidden = shown > 0;
  };

  q.addEventListener('input', apply);
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      const on = active.has(cat);
      on ? active.delete(cat) : active.add(cat);
      chip.setAttribute('aria-pressed', String(!on));
      apply();
    });
  }
}
