#!/usr/bin/env python3
import csv
import os

def reconstruct_from_parts():
    """Воссоздаем исходный inventory_parts.csv из частей"""
    
    output_file = "Data/inventory_parts_reconstructed.csv"
    parts_dir = "Data/inventory_parts_split"
    
    print("Воссоздание inventory_parts.csv из частей...")
    
    with open(output_file, 'w', encoding='utf-8', newline='') as out_f:
        writer = csv.writer(out_f)
        header_written = False
        total_rows = 0
        
        for part_num in range(1, 8):
            part_file = os.path.join(parts_dir, f"inventory_parts_part_{part_num:03d}.csv")
            
            if not os.path.exists(part_file):
                print(f"Файл {part_file} не найден")
                continue
                
            print(f"Обрабатываем {part_file}...")
            
            with open(part_file, 'r', encoding='utf-8') as in_f:
                reader = csv.reader(in_f)
                
                # Читаем заголовок
                header = next(reader)
                
                if not header_written:
                    writer.writerow(header)
                    header_written = True
                    print(f"Заголовок: {header}")
                
                # Читаем данные
                rows_in_part = 0
                for row in reader:
                    if row and len(row) >= 6:  # Проверяем, что строка не пустая и имеет достаточно полей
                        writer.writerow(row)
                        total_rows += 1
                        rows_in_part += 1
                        
                        # Показываем первые несколько строк для диагностики
                        if total_rows <= 5:
                            print(f"  Строка {total_rows}: {row}")
                            if len(row) > 5:
                                img_url = row[5]
                                if img_url and img_url.startswith('http'):
                                    print(f"    ✓ Изображение: {img_url}")
                                else:
                                    print(f"    ✗ Нет изображения: '{img_url}'")
                
                print(f"  Добавлено строк из части {part_num}: {rows_in_part}")
    
    print(f"\nВоссоздание завершено!")
    print(f"Файл: {output_file}")
    print(f"Всего строк: {total_rows}")
    
    # Проверяем размер файла
    if os.path.exists(output_file):
        size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"Размер файла: {size_mb:.2f} MB")

if __name__ == "__main__":
    reconstruct_from_parts()
