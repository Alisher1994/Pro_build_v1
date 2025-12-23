// ========================================
// Norms Manager - Управление нормативами производительности
// ========================================

const NormsManager = {
    // Кэш нормативов в localStorage
    getNormCacheKey(workTypeName, unit) {
        return `norm_${workTypeName}_${unit || 'default'}`;
    },

    // Получить норматив из кэша
    getCachedNorm(workTypeName, unit) {
        const key = this.getNormCacheKey(workTypeName, unit);
        const cached = localStorage.getItem(key);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                // Проверяем, не устарел ли кэш (30 дней)
                if (Date.now() - data.timestamp < 30 * 24 * 60 * 60 * 1000) {
                    return data.productionRate;
                }
            } catch (e) {
                // Игнорируем ошибки парсинга
            }
        }
        return null;
    },

    // Сохранить норматив в кэш
    saveNormToCache(workTypeName, unit, productionRate) {
        const key = this.getNormCacheKey(workTypeName, unit);
        const data = {
            productionRate,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Рассчитать норматив с помощью ИИ
    async calculateNorm(workTypeName, unit) {
        try {
            // Проверяем кэш
            const cached = this.getCachedNorm(workTypeName, unit);
            if (cached !== null) {
                return cached;
            }

            // Запрашиваем у ИИ
            const response = await fetch(`${API_BASE_URL}/norms/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workTypeName: workTypeName,
                    unit: unit
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to calculate norm');
            }

            const result = await response.json();
            
            // Сохраняем в кэш
            if (result.productionRate) {
                this.saveNormToCache(workTypeName, unit, result.productionRate);
            }

            return result.productionRate || 10;
        } catch (error) {
            console.error('Error calculating norm:', error);
            // Возвращаем значение по умолчанию
            return 10;
        }
    },

    // Сохранить норматив для вида работ (в description)
    async saveNormToWorkType(workTypeId, productionRate) {
        try {
            // Получаем текущий вид работ
            const workType = await api.getWorkType(workTypeId);
            
            // Обновляем description, добавляя норматив
            let description = workType.description || '';
            // Удаляем старый норматив, если есть
            description = description.replace(/productionRate[:\s=]+[\d.]+\s*/gi, '');
            // Добавляем новый норматив
            description = (description + ` productionRate:${productionRate}`).trim();
            
            // Обновляем вид работ
            await api.updateWorkType(workTypeId, { description });
            
            return true;
        } catch (error) {
            console.error('Error saving norm to work type:', error);
            return false;
        }
    }
};







