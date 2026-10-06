/* Virtuele lijst/grid met focusbeheer: rendert alleen zichtbare items (snel bij duizenden zenders) */
function VList(box, opts) {
    this.box = box;
    this.opts = opts;
    this.horizontal = !!opts.horizontal;
    this.cols = this.horizontal ? 1 : (opts.cols || 1);
    this.itemW = opts.itemW || 0;
    this.itemH = opts.itemH || 0;
    this.pad = opts.pad || 0;
    this.render = opts.render;
    this.items = [];
    this.index = 0;
    this.offset = 0;
    this.nodes = {};
    this.active = false;
    box.classList.add('vlist');
    this.inner = document.createElement('div');
    this.inner.className = 'vlist-inner';
    this.inner.style.left = this.pad + 'px';
    this.inner.style.top = this.pad + 'px';
    if (!this.horizontal && this.cols === 1) this.inner.style.right = this.pad + 'px';
    box.appendChild(this.inner);
    this.emptyEl = document.createElement('div');
    this.emptyEl.className = 'vlist-empty';
    box.appendChild(this.emptyEl);
}

VList.prototype.setItems = function (items, index) {
    var self = this;
    this.items = items || [];
    this.index = U.clamp(index || 0, 0, Math.max(0, this.items.length - 1));
    this.offset = 0;
    this.inner.innerHTML = '';
    this.nodes = {};
    this.inner.classList.add('no-anim');
    this.update();
    requestAnimationFrame(function () { self.inner.classList.remove('no-anim'); });
    this.emptyEl.style.display = this.items.length ? 'none' : '';
};

VList.prototype.setEmpty = function (text) { this.emptyEl.textContent = text || ''; };

// Aantal volledig zichtbare regels (rijen, of kolommen bij horizontaal)
VList.prototype.visible = function () {
    if (this.opts.visible) return this.opts.visible;
    var size = this.horizontal ? this.box.clientWidth - this.pad : this.box.clientHeight - this.pad;
    var unit = this.horizontal ? this.itemW : this.itemH;
    return Math.max(1, Math.floor(size / unit));
};

VList.prototype.update = function () {
    var n = this.items.length;
    if (!n) return;
    var unit = this.horizontal ? this.itemW : this.itemH;
    var lines = this.horizontal ? n : Math.ceil(n / this.cols);
    var line = this.horizontal ? this.index : Math.floor(this.index / this.cols);
    var vis = this.visible();
    var margin = vis >= 5 ? 1 : 0;
    if (line < this.offset + margin) this.offset = line - margin;
    if (line > this.offset + vis - 1 - margin) this.offset = line - vis + 1 + margin;
    this.offset = U.clamp(this.offset, 0, Math.max(0, lines - vis));
    var px = -this.offset * unit;
    this.inner.style.transform = this.horizontal ? 'translateX(' + px + 'px)' : 'translateY(' + px + 'px)';

    var from = Math.max(0, this.offset - 2), to = Math.min(lines - 1, this.offset + vis + 1);
    var first = from * this.cols, last = Math.min(n - 1, (to + 1) * this.cols - 1);
    var k, i;
    for (k in this.nodes) {
        i = +k;
        if (i < first || i > last) { this.inner.removeChild(this.nodes[k]); delete this.nodes[k]; }
    }
    for (i = first; i <= last; i++) {
        if (!this.nodes[i]) {
            var el = this.render(this.items[i], i);
            this.position(el, i);
            this.inner.appendChild(el);
            this.nodes[i] = el;
        }
    }
    for (k in this.nodes) this.mark(this.nodes[k], +k);
};

VList.prototype.position = function (el, i) {
    el.classList.add('vitem');
    var s = el.style;
    if (this.horizontal) { s.left = (i * this.itemW) + 'px'; s.top = '0px'; }
    else {
        s.left = ((i % this.cols) * this.itemW) + 'px';
        s.top = (Math.floor(i / this.cols) * this.itemH) + 'px';
        if (this.cols === 1) s.width = '100%';
    }
};

VList.prototype.mark = function (el, i) {
    var sel = i === this.index;
    el.classList.toggle('sel', sel);
    el.classList.toggle('focus', sel && this.active);
};

VList.prototype.refreshItem = function (i) {
    var old = this.nodes[i];
    if (!old) return;
    var el = this.render(this.items[i], i);
    this.position(el, i);
    this.mark(el, i);
    this.inner.replaceChild(el, old);
    this.nodes[i] = el;
};

VList.prototype.refresh = function () { for (var k in this.nodes) this.refreshItem(+k); };

VList.prototype.focus = function (i) {
    if (!this.items.length) return;
    this.index = U.clamp(i, 0, this.items.length - 1);
    this.update();
};

// Beweegt de focus; geeft false terug aan de rand (zodat het scherm naar een andere zone kan)
VList.prototype.move = function (dir) {
    var n = this.items.length, i = this.index, c = this.cols;
    if (!n) return false;
    if (this.horizontal) {
        if (dir === 'left') i--; else if (dir === 'right') i++; else return false;
    } else if (c === 1) {
        if (dir === 'up') i--; else if (dir === 'down') i++; else return false;
    } else {
        if (dir === 'left') { if (i % c === 0) return false; i--; }
        else if (dir === 'right') { if (i % c === c - 1 || i === n - 1) return false; i++; }
        else if (dir === 'up') { if (i < c) return false; i -= c; }
        else if (dir === 'down') { if (Math.floor(i / c) === Math.floor((n - 1) / c)) return false; i = Math.min(n - 1, i + c); }
        else return false;
    }
    if (i < 0 || i >= n) return false;
    this.focus(i);
    return true;
};

// Een pagina omhoog (-1) of omlaag (+1)
VList.prototype.page = function (d) {
    if (!this.items.length) return;
    this.focus(this.index + d * this.visible() * this.cols);
};

VList.prototype.setActive = function (b) {
    this.active = !!b;
    this.box.classList.toggle('active', this.active);
    this.update();
};

VList.prototype.current = function () { return this.items[this.index]; };

// Indexbereik van de items die nu in beeld zijn
VList.prototype.range = function () {
    var a = this.offset * this.cols;
    return [a, Math.min(this.items.length - 1, a + (this.visible() + 1) * this.cols - 1)];
};
