/* Oudere Samsung-TV's (Tizen 3.0–6.0, Chromium 47–76): ontbrekende CSS-mogelijkheden opvangen. Wordt in <head> geladen,
   vóór de stylesheets. Nieuwere TV's krijgen precies dezelfde app.css als altijd; er gaat daar niets anders werken.
   - Geen CSS-variabelen (Chromium < 49): css/app.legacy.css (app.css met ingevulde waarden) in plaats van css/app.css
   - Geen gap in flexbox (Chromium < 84): klasse no-flexgap op <html>, marges uit css/compat.css
   - Geen CSS-grid (Chromium < 57): klasse no-grid op <html>, zoektoetsenbord als flexbox (css/compat.css)
   Beide stylesheets worden gemaakt door scripts/compat-css.mjs. */
(function () {
    var d = document.documentElement, sup = window.CSS && CSS.supports, cls = [];
    var vars = !!(sup && CSS.supports('--x', '0'));
    if (!(sup && CSS.supports('display', 'grid'))) cls.push('no-grid');
    // Flexbox-gap is niet met CSS.supports te zien: meten (twee kinderen onder elkaar met 1px gap = 1px hoog)
    var f = document.createElement('div');
    f.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
    f.appendChild(document.createElement('div'));
    f.appendChild(document.createElement('div'));
    d.appendChild(f);
    if (f.scrollHeight !== 1) cls.push('no-flexgap');
    d.removeChild(f);
    if (!vars) cls.push('no-cssvars');
    if (cls.length) d.className += (d.className ? ' ' : '') + cls.join(' ');
    document.write('<link rel="stylesheet" href="css/' + (vars ? 'app.css' : 'app.legacy.css') + '">');
})();
