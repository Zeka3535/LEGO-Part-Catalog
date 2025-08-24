# Загрузчик CSV Rebrickable (Python)

Утилита скачивает публичные наборы CSV с Rebrickable (gzip), распаковывает их в папку с меткой времени и разбивает `inventory_parts.csv` на части примерно по 20 МБ, как в `Data/inventory_parts_split`. Также создаётся файл сводки `parts_info.txt`.

## Требования
- Python 3.9+
- Установить зависимости:
  ```powershell
  pip install -r rebrickable_downloader/requirements.txt
  ```

## Запуск (Windows PowerShell)
```powershell
# из корня проекта (каталог-lego)
python -m rebrickable_downloader.downloader .\DataDownloads
```
- Если путь не указан, файлы попадут в `./Downloads/rebrickable_YYYY-MM-DD_HH-MM-SS/`.
- В примере выше они попадут в `./DataDownloads/rebrickable_YYYY-MM-DD_HH-MM-SS/`.

В папке будут файлы:
- `themes.csv`, `colors.csv`, `part_categories.csv`, `parts.csv`, `part_relationships.csv`, `elements.csv`, `sets.csv`, `minifigs.csv`, `inventories.csv`, `inventory_sets.csv`, `inventory_minifigs.csv`, `inventory_parts.csv`
- Каталог `inventory_parts_split/` c файлами вида `inventory_parts_part_001.csv` ... и `parts_info.txt`

## Запуск собранного EXE
После сборки EXE (см. ниже) можно запускать так:
```powershell
# из корня проекта
.\dist\rebrickable_downloader.exe .\DataDownloads
```
- Без аргумента вывод пойдёт в `./Downloads/rebrickable_YYYY-MM-DD_HH-MM-SS/`.

## Примечания
- Разбиение ориентируется на приблизительный размер строки в UTF‑8 и целит ~20 МБ на часть.
- Ссылки взяты из вашего HTML-фрагмента; при необходимости обновите их в `rebrickable_downloader/urls.py`.

## (Опционально) Сборка EXE вручную
```powershell
pip install pyinstaller
pyinstaller --clean --noconfirm --onefile --name rebrickable_downloader rebrickable_downloader\downloader.py
```
Собранный файл появится в `dist/rebrickable_downloader.exe`.
