// Обработчик виджетов для LEGO Catalog PWA
class WidgetHandler {
    constructor() {
        this.statsData = null;
        this.init();
        
        // Слушаем сообщения от виджетов
        window.addEventListener('message', (event) => {
            this.handleWidgetMessage(event);
        });
    }
    
    async init() {
        // Загружаем данные при инициализации
        await this.loadStatsData();
        
        // Обновляем данные каждые 2 минуты
        setInterval(() => {
            this.updateAllWidgets();
        }, 2 * 60 * 1000);
        
        // Уведомляем виджеты об обновлении данных
        this.notifyWidgets();
    }
    
    // Уведомляем виджеты об обновлении данных
    notifyWidgets() {
        // Отправляем событие об обновлении данных
        window.dispatchEvent(new CustomEvent('widgetDataUpdated', {
            detail: {
                statsData: this.statsData
            }
        }));
        
        // Отправляем сообщение всем iframe виджетам
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'widgetData',
                    statsData: this.statsData
                }, '*');
            } catch (error) {
                // Игнорируем ошибки, если iframe недоступен
            }
        });
    }
    
    // Обработчик сообщений от виджетов
    handleWidgetMessage(event) {
        if (event.data && event.data.type === 'getWidgetData') {
            // Отправляем данные обратно виджету
            event.source.postMessage({
                type: 'widgetData',
                statsData: this.statsData
            }, event.origin);
        }
    }
    
    // Обновляем все виджеты
    async updateAllWidgets() {
        await this.loadStatsData();
        this.notifyWidgets();
    }
    
    // Загружаем данные статистики
    async loadStatsData() {
        try {
            const partsCollection = this.getLocalStorageData('legoCollection') || {};
            const setsCollection = this.getLocalStorageData('legoSetCollection') || {};
            const minifigsCollection = this.getLocalStorageData('legoMinifigCollection') || {};
            const favoriteThemes = this.getLocalStorageData('favoriteThemeIds') || [];
            
            // Подсчитываем количество элементов
            // Для деталей: считаем общее количество деталей (сумма по всем цветам)
            const totalParts = Object.values(partsCollection).reduce((sum, part) => {
                return sum + Object.values(part).reduce((partSum, qty) => partSum + qty, 0);
            }, 0);
            
            // Для наборов: считаем общее количество наборов
            const totalSets = Object.values(setsCollection).reduce((sum, set) => sum + (set.qty || 0), 0);
            
            // Для минифигурок: считаем общее количество минифигурок
            const totalMinifigs = Object.values(minifigsCollection).reduce((sum, minifig) => sum + (minifig.qty || 0), 0);
            
            // Уникальные элементы
            const uniqueParts = Object.keys(partsCollection).length;
            const uniqueSets = Object.keys(setsCollection).length;
            const uniqueMinifigs = Object.keys(minifigsCollection).length;
            
            // Для тем: считаем количество избранных тем
            const totalThemes = Array.isArray(favoriteThemes) ? favoriteThemes.length : 0;
            
            this.statsData = {
                totalSets: totalSets,
                totalParts: totalParts,
                totalMinifigs: totalMinifigs,
                uniqueSets: uniqueSets,
                uniqueParts: uniqueParts,
                uniqueMinifigs: uniqueMinifigs,
                totalThemes: totalThemes,
                lastUpdated: new Date().toISOString(),
                version: "1.0.0"
            };
            
            console.log('📊 Статистика загружена:', this.statsData);
        } catch (error) {
            console.error('Ошибка загрузки данных статистики:', error);
            this.statsData = {
                totalSets: 0,
                totalParts: 0,
                totalMinifigs: 0,
                uniqueSets: 0,
                uniqueParts: 0,
                uniqueMinifigs: 0,
                totalThemes: 0,
                lastUpdated: new Date().toISOString(),
                version: "1.0.0"
            };
        }
    }
    
    // Сохраняем данные статистики
    async saveStatsData() {
        try {
            // Обновляем данные в памяти
            this.statsData.lastUpdated = new Date().toISOString();
            console.log('📊 Статистика обновлена в памяти:', this.statsData);
            
            // Уведомляем виджеты об обновлении
            this.notifyWidgets();
        } catch (error) {
            console.error('Ошибка сохранения статистики:', error);
        }
    }
    
    // Функция для чтения данных из localStorage
    getLocalStorageData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Ошибка чтения ${key} из localStorage:`, error);
            return null;
        }
    }
}

// Создаем глобальный экземпляр обработчика виджетов
window.widgetHandler = new WidgetHandler();