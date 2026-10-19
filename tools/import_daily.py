"""
Переводит текст ежедневника из простого .txt в data/daily.js.

Запуск (из папки проекта):
    python tools/import_daily.py ежедневник.txt

Формат файла — см. tools/daily-example.txt:
    # 1 января            <- дата (обязательно со знаком #)
    Заголовок             <- первая непустая строка
    > Цитата              <- строки, начинающиеся с ">", необязательно
    — Источник            <- строка с тире сразу после цитаты, необязательно
    Текст...              <- всё остальное; абзацы разделяются пустой строкой
"""
import io
import json
import re
import sys
from pathlib import Path

MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн",
          "июл", "август", "сентябр", "октябр", "ноябр", "декабр"]
HEADER = re.compile(r"^#\s*(\d{1,2})\s+([а-яё]+)", re.IGNORECASE)


def month_number(word):
    word = word.lower()
    # «ма» (май/мая) проверяем последним, чтобы не путать с «март»
    for i in sorted(range(12), key=lambda k: -len(MONTHS[k])):
        if word.startswith(MONTHS[i]):
            return i + 1
    raise ValueError("Не понял месяц: " + word)


def parse_entry(lines):
    lines = [l.rstrip() for l in lines]
    while lines and not lines[0].strip():
        lines.pop(0)
    if not lines:
        return None
    title = lines.pop(0).strip()
    quote, source = [], ""
    while lines and lines[0].lstrip().startswith(">"):
        quote.append(lines.pop(0).lstrip()[1:].strip())
    if lines and re.match(r"^\s*(—|–|--)", lines[0]):
        source = re.sub(r"^\s*(—|–|--)\s*", "", lines.pop(0))
    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    entry = {"title": title, "text": text}
    if quote:
        entry["quote"] = " ".join(quote)
    if source:
        entry["source"] = source
    return entry


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / "data" / "daily.js"

    entries, key, buf = {}, None, []
    for line in io.open(src, encoding="utf-8-sig"):
        m = HEADER.match(line.strip())
        if m:
            if key:
                entries[key] = parse_entry(buf)
            key = "%02d-%02d" % (month_number(m.group(2)), int(m.group(1)))
            buf = []
        elif key:
            buf.append(line)
    if key:
        entries[key] = parse_entry(buf)
    entries = {k: v for k, v in sorted(entries.items()) if v}

    body = json.dumps(entries, ensure_ascii=False, indent=2)
    out.write_text(
        "/* Создано автоматически: python tools/import_daily.py %s */\n"
        "window.AA_DAILY = %s;\n" % (src.name, body),
        encoding="utf-8")
    print("Готово: %d дней записано в %s" % (len(entries), out))
    missing = 366 - len(entries)
    if missing:
        print("Ещё нет текстов на %d дней — для них сайт покажет запасное размышление." % missing)


if __name__ == "__main__":
    main()
