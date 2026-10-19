# Сайт группы АА «Тушино»

Статический сайт без сборки: обычные HTML, CSS и JS. Живой адрес: https://tushinoaa.netlify.app/

## Что где лежит

| Файл | Что внутри |
|---|---|
| `index.html` | Разметка страницы: блоки «Что такое АА», ссылки, подвал |
| `styles.css` | Оформление (светлая и тёмная тема, мобильная версия) |
| `app.js` | Логика: бар недели, «ближайшее собрание», размышление дня |
| `data/schedule.js` | **Расписание, темы собраний, адрес, телефон, Telegram** |
| `data/reflections.js` | **Размышления на каждый день** |
| `netlify.toml` | Настройки Netlify (сборка не нужна) |

Чаще всего нужно править только два файла в `data/`.

## Как посмотреть локально

Откройте `index.html` двойным щелчком, сайт откроется в браузере.

## Как опубликовать на Netlify

### Вариант 1. Перетащить папку (проще всего)
1. Откройте https://app.netlify.com/projects/tushinoaa/deploys
2. Внизу страницы есть область *«Drag and drop your project folder here»*.
3. Перетащите туда **всю папку** `tushinoaa` (в которой лежит `index.html`).
4. Через несколько секунд обновится https://tushinoaa.netlify.app/

После каждой правки повторяйте шаг 3.

### Вариант 2. Через GitHub (обновление автоматически)
1. Создайте репозиторий на GitHub и загрузите туда эту папку (`git push`).
2. В Netlify: *Project configuration → Build & deploy → Link repository*, выберите репозиторий.
3. Build command оставьте пустым, Publish directory: `.`
4. Теперь каждый `git push` сам обновляет сайт. Править файлы можно прямо на сайте GitHub.

### Вариант 3. Из командной строки
```bash
npm install -g netlify-cli
netlify login
netlify link        # выбрать проект tushinoaa
netlify deploy --prod --dir .
```
