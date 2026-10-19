(function () {
  'use strict';

  var schedule = window.AA_SCHEDULE || [];
  var group = window.AA_GROUP || {};

  var DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  var DAYS_IN = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  // Время считаем по Москве, где бы ни находился посетитель.
  // Возвращаем Date, у которого «локальные» поля = московское время.
  function moscowNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  }

  function toMinutes(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Тема собрания на конкретную дату (учитывает «первая/последняя среда месяца»)
  function topicFor(m, date) {
    if (m.special) {
      var daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      if (m.special.first && date.getDate() <= 7) return { text: m.special.first, special: true };
      if (m.special.last && date.getDate() + 7 > daysInMonth) return { text: m.special.last, special: true };
    }
    return { text: m.topic, special: false };
  }

  // Все собрания на ближайшие 14 дней с их датами и статусом
  function upcoming(now) {
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var list = [];
    for (var i = 0; i < 14; i++) {
      var date = addDays(now, i);
      schedule.forEach(function (m) {
        if (m.day !== date.getDay()) return;
        var start = toMinutes(m.time);
        var end = start + (m.duration || 75);
        var status = 'future';
        if (i === 0 && nowMin >= end) status = 'past';
        else if (i === 0 && nowMin >= start) status = 'live';
        list.push({ m: m, date: date, offset: i, status: status,
          minutesTo: i * 1440 + start - nowMin, topic: topicFor(m, date) });
      });
    }
    return list.sort(function (a, b) { return a.minutesTo - b.minutesTo; });
  }

  /* ── Ближайшее собрание ────────────────────────────── */
  function humanDelta(min) {
    if (min < 60) return 'через ' + min + ' мин';
    var h = Math.floor(min / 60), mm = min % 60;
    if (h < 24) return 'через ' + h + ' ч' + (mm ? ' ' + mm + ' мин' : '');
    return '';
  }

  function renderNext() {
    var box = document.getElementById('next-meeting');
    if (!box) return;
    var n = upcoming(moscowNow()).filter(function (x) { return x.status !== 'past'; })[0];
    if (!n) return;

    var when = n.offset === 0 ? 'Сегодня' : n.offset === 1 ? 'Завтра'
      : DAYS_IN[n.date.getDay()].replace(/^./, function (c) { return c.toUpperCase(); });
    when += ', ' + n.date.getDate() + ' ' + MONTHS_GEN[n.date.getMonth()];

    box.innerHTML = '';
    box.appendChild(el('div', 'next-time', n.m.time));
    var info = el('div');
    var label = el('div', 'next-label', n.status === 'live' ? 'Собрание идёт' : 'Ближайшее собрание');
    if (n.status === 'live') label.appendChild(el('span', 'live', 'сейчас'));
    info.appendChild(label);
    var rel = n.status === 'live' ? '' : humanDelta(n.minutesTo);
    info.appendChild(el('div', 'next-day', when + (rel ? ' · ' + rel : '')));
    info.appendChild(el('div', 'next-topic', n.topic.text));
    box.appendChild(info);
  }

  /* ── Бар на 7 дней ─────────────────────────────────── */
  function renderWeek() {
    var week = document.getElementById('week');
    if (!week) return;
    var now = moscowNow();
    var items = upcoming(now);
    week.innerHTML = '';

    for (var i = 0; i < 7; i++) {
      var date = addDays(now, i);
      var d = date.getDay();
      var dayItems = items.filter(function (x) { return x.offset === i; });
      var isToday = i === 0;

      var head = el('div', 'day-head');
      head.appendChild(el('div', 'day-name', isToday ? 'Сегодня' : i === 1 ? 'Завтра' : DAYS_SHORT[d]));
      head.appendChild(el('div', 'day-full', DAYS_FULL[d]));
      head.appendChild(el('div', 'day-date', date.getDate() + ' ' + MONTHS_GEN[date.getMonth()]));

      if (!dayItems.length) {
        var off = el('div', 'day off' + (isToday ? ' today' : ''));
        off.setAttribute('role', 'listitem');
        off.appendChild(head);
        off.appendChild(el('div', 'day-off-text', 'собрания нет'));
        week.appendChild(off);
        continue;
      }

      dayItems.forEach(function (x) {
        var card = el('div', 'day' + (isToday ? ' today' : '') + (x.status === 'past' ? ' past' : '') + (x.topic.special ? ' special' : ''));
        card.setAttribute('role', 'listitem');
        card.appendChild(head.cloneNode(true));
        card.appendChild(el('div', 'day-time', x.m.time));

        var body = el('div', 'day-body');
        body.appendChild(el('div', 'day-topic', x.topic.text));
        if (x.m.note) body.appendChild(el('div', 'day-note', x.m.note));
        card.appendChild(body);

        var tags = el('div', 'day-tags');
        if (x.status === 'live') tags.appendChild(el('span', 'tag tag-live', 'идёт сейчас'));
        else if (x.status === 'past') tags.appendChild(el('span', 'tag tag-past', 'завершилось'));
        if (x.topic.special) tags.appendChild(el('span', 'tag tag-special', 'особое'));
        card.appendChild(tags);

        week.appendChild(card);
      });
    }
  }

  /* ── Ежедневник ───────────────────────────────────── */
  var reflDate = moscowNow();

  function dateKey(d) {
    return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function renderReflection() {
    var daily = window.AA_DAILY || {};
    var fallback = window.AA_REFLECTIONS || [];
    var official = daily[dateKey(reflDate)];
    var r = official || fallback[(reflDate.getDate() - 1) % fallback.length];
    if (!r) return;

    document.getElementById('refl-date').textContent =
      DAYS_FULL[reflDate.getDay()] + ', ' + reflDate.getDate() + ' ' + MONTHS_GEN[reflDate.getMonth()];
    document.getElementById('refl-title').textContent = r.title || '';

    var q = document.getElementById('refl-quote');
    q.hidden = !r.quote;
    document.getElementById('refl-quote-text').textContent = r.quote || '';
    document.getElementById('refl-source').textContent = r.source || '';

    var textBox = document.getElementById('refl-text');
    textBox.innerHTML = '';
    String(r.text || '').split(/\n\s*\n/).forEach(function (p) {
      if (p.trim()) textBox.appendChild(el('p', null, p.trim()));
    });

    document.getElementById('refl-slogan').textContent = official ? 'Ежедневник АА' : 'Мысль дня от группы · ' + (r.slogan || '');

    // Кнопка на официальный текст ежедневника за выбранную дату
    var isToday = dateKey(reflDate) === dateKey(moscowNow());
    document.getElementById('refl-read').hidden = !!official;
    document.getElementById('refl-link').href = 'https://aa-online.ru/ezhednevnik-aa-read/?aa_day=' +
      reflDate.getDate() + '&aa_month=' + (reflDate.getMonth() + 1);
    document.getElementById('refl-link-text').textContent = 'Читать Ежедневник АА ' +
      (isToday ? 'на сегодня' : 'на ' + reflDate.getDate() + ' ' + MONTHS_GEN[reflDate.getMonth()]);
    document.getElementById('refl-today').hidden = dateKey(reflDate) === dateKey(moscowNow());
  }

  function shiftReflection(days) {
    reflDate = addDays(reflDate, days);
    renderReflection();
  }

  /* ── Контакты и карта ─────────────────────────────── */
  function renderContacts() {
    function set(id, text) { var e = document.getElementById(id); if (e) e.textContent = text || ''; }
    set('c-address', group.address);
    set('c-address-hint', group.addressHint);
    set('c-phone', group.phonePretty);
    set('hero-phone', group.phonePretty);
    var tel = 'tel:' + (group.phone || '');
    ['c-phone', 'c-call', 'hero-phone'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.href = tel;
    });
    // Маршрут общественным транспортом до точки в Яндекс Картах
    document.getElementById('c-map').href =
      'https://yandex.ru/maps/?rtext=~' + group.lat + ',' + group.lon + '&rtt=mt';
    document.getElementById('map-link').href =
      'https://yandex.ru/maps/?pt=' + group.lon + ',' + group.lat + '&z=17&l=map';
    if (group.telegram) {
      var tg = document.getElementById('c-tg');
      tg.href = group.telegram;
      tg.hidden = false;
    }
  }

  function renderMap() {
    var box = document.getElementById('map');
    if (!box || !window.L || !group.lat) return;
    box.parentNode.classList.add('loaded');
    var map = L.map(box, { scrollWheelZoom: false }).setView([group.lat, group.lon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; участники <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var icon = L.divIcon({
      className: 'aa-marker',
      html: '<div class="aa-pin"><img src="favicon.svg" alt=""></div><span class="aa-pin-label">Волоколамское ш., 92</span>',
      iconSize: [64, 80],
      iconAnchor: [32, 78],
      popupAnchor: [0, -74]
    });
    L.marker([group.lat, group.lon], { icon: icon, title: 'Группа АА «Тушино»' })
      .addTo(map)
      .bindPopup('<b>Группа АА «Тушино»</b><br>' + group.address +
        '<br><a href="' + document.getElementById('c-map').href + '" target="_blank" rel="noopener">Построить маршрут →</a>');
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
  renderMap();
  initMenu();

  document.getElementById('refl-prev').addEventListener('click', function () { shiftReflection(-1); });
  document.getElementById('refl-next').addEventListener('click', function () { shiftReflection(1); });
  document.getElementById('refl-today').addEventListener('click', function () { reflDate = moscowNow(); renderReflection(); });

  // Раз в минуту обновляем «ближайшее собрание» и бар
  setInterval(function () { renderNext(); renderWeek(); }, 60000);
})();
