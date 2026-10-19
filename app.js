(function () {
  'use strict';

  var schedule = window.AA_SCHEDULE || [];
  var group = window.AA_GROUP || {};

  var DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  var DAYS_IN = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
  var WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  // Время считаем по Москве, где бы ни находился посетитель
  function moscowNow() {
    var s = new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' });
    return new Date(s);
  }

  function toMinutes(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ── Ближайшее собрание ────────────────────────────── */
  function findNext(now) {
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var today = now.getDay();
    var best = null;
    schedule.forEach(function (m) {
      var start = toMinutes(m.time);
      var dur = m.duration || 90;
      var offsetDays = (m.day - today + 7) % 7;
      var delta = offsetDays * 1440 + start - nowMin; // минут до начала
      if (offsetDays === 0 && delta < 0) {
        if (nowMin < start + dur) {
          delta = 0; // идёт сейчас
          m = Object.assign({ live: true }, m);
        } else {
          delta += 7 * 1440;
        }
      }
      if (!best || delta < best.delta) best = { m: m, delta: delta, offsetDays: delta === 0 ? 0 : Math.floor((nowMin + delta) / 1440) };
    });
    return best;
  }

  function humanDelta(min) {
    if (min < 60) return 'через ' + min + ' мин';
    var h = Math.floor(min / 60), mm = min % 60;
    if (h < 24) return 'через ' + h + ' ч' + (mm ? ' ' + mm + ' мин' : '');
    return '';
  }

  function renderNext() {
    var box = document.getElementById('next-meeting');
    if (!box || !schedule.length) return;
    var now = moscowNow();
    var n = findNext(now);
    if (!n) return;

    var when;
    if (n.m.live) when = 'Сегодня';
    else if (n.offsetDays === 0) when = 'Сегодня';
    else if (n.offsetDays === 1) when = 'Завтра';
    else when = DAYS_IN[n.m.day].charAt(0).toUpperCase() + DAYS_IN[n.m.day].slice(1);

    box.innerHTML = '';
    box.appendChild(el('div', 'next-time', n.m.time));
    var info = el('div');
    var label = el('div', 'next-label', n.m.live ? 'Собрание идёт' : 'Ближайшее собрание');
    if (n.m.live) label.appendChild(el('span', 'live', 'сейчас'));
    info.appendChild(label);
    var rel = n.m.live ? '' : humanDelta(n.delta);
    info.appendChild(el('div', 'next-day', when + (rel ? ' · ' + rel : '')));
    info.appendChild(el('div', 'next-topic', n.m.topic));
    box.appendChild(info);
  }

  /* ── Неделя ───────────────────────────────────────── */
  function renderWeek() {
    var week = document.getElementById('week');
    if (!week) return;
    var now = moscowNow();
    var today = now.getDay();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    week.innerHTML = '';

    WEEK_ORDER.forEach(function (d) {
      var meetings = schedule.filter(function (m) { return m.day === d; })
        .sort(function (a, b) { return toMinutes(a.time) - toMinutes(b.time); });

      if (!meetings.length) {
        var off = el('div', 'day off' + (d === today ? ' today' : ''));
        off.setAttribute('role', 'listitem');
        var h = el('div', 'day-head');
        h.appendChild(el('div', 'day-name', DAYS_SHORT[d]));
        h.appendChild(el('div', 'day-full', DAYS_FULL[d]));
        off.appendChild(h);
        off.appendChild(el('div', 'day-off-text', 'собрания нет'));
        week.appendChild(off);
        return;
      }

      meetings.forEach(function (m) {
        var card = el('div', 'day' + (d === today ? ' today' : ''));
        card.setAttribute('role', 'listitem');

        var head = el('div', 'day-head');
        head.appendChild(el('div', 'day-name', DAYS_SHORT[d]));
        head.appendChild(el('div', 'day-full', DAYS_FULL[d]));
        card.appendChild(head);

        card.appendChild(el('div', 'day-time', m.time));

        var body = el('div', 'day-body');
        body.appendChild(el('div', 'day-topic', m.topic));
        if (m.note) body.appendChild(el('div', 'day-note', m.note));
        card.appendChild(body);

        var tags = el('div', 'day-tags');
        var start = toMinutes(m.time);
        if (d === today && nowMin >= start && nowMin < start + (m.duration || 90)) {
          tags.appendChild(el('span', 'tag tag-live', 'идёт сейчас'));
        } else if (d === today) {
          tags.appendChild(el('span', 'tag tag-today', 'сегодня'));
        }
        if (m.open) tags.appendChild(el('span', 'tag tag-open', 'открытое'));
        card.appendChild(tags);

        week.appendChild(card);
      });
    });
  }

  /* ── Размышление дня ──────────────────────────────── */
  var reflDate = moscowNow();
  var todayKey = dateKey(reflDate);

  function dateKey(d) {
    return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function renderReflection() {
    var byDate = window.AA_REFLECTIONS_BY_DATE || {};
    var list = window.AA_REFLECTIONS || [];
    var r = byDate[dateKey(reflDate)] || list[(reflDate.getDate() - 1) % list.length];
    if (!r) return;

    var dateStr = reflDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('refl-date').textContent = dateStr;
    document.getElementById('refl-slogan').textContent = r.slogan || '';
    document.getElementById('refl-title').textContent = r.title || '';
    document.getElementById('refl-text').textContent = r.text || '';
    document.getElementById('refl-today').hidden = dateKey(reflDate) === todayKey;
  }

  function shiftReflection(days) {
    reflDate = new Date(reflDate.getFullYear(), reflDate.getMonth(), reflDate.getDate() + days);
    renderReflection();
  }

  /* ── Контакты ─────────────────────────────────────── */
  function renderContacts() {
    function set(id, text) { var e = document.getElementById(id); if (e) e.textContent = text || ''; }
    set('c-address', group.address);
    set('c-address-hint', group.addressHint);
    set('c-phone', group.phonePretty);
    var tel = 'tel:' + (group.phone || '');
    document.getElementById('c-phone').href = tel;
    document.getElementById('c-call').href = tel;
    document.getElementById('c-map').href = group.mapUrl || '#';
    if (group.telegram) {
      var tg = document.getElementById('c-tg');
      tg.href = group.telegram;
      tg.hidden = false;
    }
  }

  /* ── Меню на телефоне ─────────────────────────────── */
  function initMenu() {
    var btn = document.querySelector('.menu-btn');
    var menu = document.getElementById('menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  renderNext();
  renderWeek();
  renderReflection();
  renderContacts();
  initMenu();

  document.getElementById('refl-prev').addEventListener('click', function () { shiftReflection(-1); });
  document.getElementById('refl-next').addEventListener('click', function () { shiftReflection(1); });
  document.getElementById('refl-today').addEventListener('click', function () { reflDate = moscowNow(); renderReflection(); });

  // Обновляем «ближайшее собрание» раз в минуту
  setInterval(function () { renderNext(); renderWeek(); }, 60000);
})();
