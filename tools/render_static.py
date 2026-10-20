"""
Подставляет расписание из data/schedule.js в статичный блок index.html
(между <!-- static-schedule:start --> и <!-- static-schedule:end -->).

Нужно для поисковиков, которые не выполняют JavaScript. Запускается при деплое;
можно и вручную: python tools/render_static.py
"""
import io
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
ORDER = [1, 2, 3, 4, 5, 6, 0]
WEEK_ORD = {"first": "1-я", "last": "последняя"}


def parse_schedule(js):
    consts = dict(re.findall(r'var\s+(\w+)\s*=\s*"([^"]*)"', js))
    body = js[js.index("window.AA_SCHEDULE"):js.index("];") + 1]
    meetings = []
    for item in re.findall(r"\{[^{}]*?(?:\{[^{}]*\}[^{}]*?)*\}", body):
        def val(key):
            m = re.search(key + r':\s*("([^"]*)"|(\w+))', item)
            if not m:
                return None
            return m.group(2) if m.group(2) is not None else consts.get(m.group(3), m.group(3))
        day = re.search(r"day:\s*(\d)", item)
        if not day:
            continue
        special = {}
        sm = re.search(r"special:\s*\{([^}]*)\}", item)
        if sm:
            special = dict(re.findall(r'(\w+):\s*"([^"]*)"', sm.group(1)))
        meetings.append({"day": int(day.group(1)), "time": val("time"), "topic": val("topic"), "special": special})
    return meetings


def render(meetings):
    lines, off = [], []
    for d in ORDER:
        today = sorted((m for m in meetings if m["day"] == d), key=lambda m: m["time"])
        if not today:
            off.append(DAYS[d].lower())
            continue
        for m in today:
            extra = "; ".join(f"{WEEK_ORD.get(k, k)} {DAYS[d].lower()} месяца — {v.lower()}" for k, v in m["special"].items())
            text = f"<b>{DAYS[d]}, {m['time']}</b> — {m['topic']}" + (f"; {extra}" if extra else "")
            lines.append(f"          <li>{text}</li>")
    if off:
        lines.append(f"          <li><b>{', '.join(off).capitalize()}</b> — собраний нет</li>")
    return '        <ul class="week-static">\n' + "\n".join(lines) + "\n        </ul>"


def main():
    js = io.open(ROOT / "data" / "schedule.js", encoding="utf-8").read()
    page = ROOT / "index.html"
    html = io.open(page, encoding="utf-8").read()
    block = render(parse_schedule(js))
    new = re.sub(r"(<!-- static-schedule:start -->\n).*?(\n\s*<!-- static-schedule:end -->)",
                 lambda m: m.group(1) + block + m.group(2), html, flags=re.S)
    if new == html:
        print("Статичное расписание уже актуально")
    else:
        io.open(page, "w", encoding="utf-8", newline="\n").write(new)
        print("Статичное расписание обновлено")


if __name__ == "__main__":
    main()
