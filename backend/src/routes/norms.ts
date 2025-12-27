import logger from '../utils/logger';
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Конфигурация Ollama
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b'; // Мощная модель для расчетов
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const USE_OLLAMA_CLOUD = process.env.USE_OLLAMA_CLOUD === 'true' || !!OLLAMA_API_KEY;

// POST /api/norms/calculate
// Рассчитывает норматив (производительность) для вида работ с помощью ИИ
router.post('/calculate', async (req, res) => {
  try {
    const { workTypeName, unit } = req.body;

    if (!workTypeName) {
      return res.status(400).json({ error: 'workTypeName обязателен' });
    }

    // Формируем промпт для ИИ
    const prompt = `Рассчитай норматив производительности (выработку за рабочий день) для строительных работ.

Вид работ: "${workTypeName}"
Единица измерения: "${unit || 'шт'}"

Учти:
- Типичную производительность для такого типа работ в строительстве
- Стандартные нормы выработки
- Реалистичные значения для бригады из 2-4 человек

Ответь ТОЛЬКО числом (норматив в единицах измерения за рабочий день), без дополнительного текста.

Примеры:
- Кладка кирпича (м²): 8-12
- Бетонные работы (м³): 5-8
- Штукатурка (м²): 15-25
- Покраска (м²): 20-30

Только число:`;

    try {
      const productionRate = await generateNormWithOllama(prompt, workTypeName, unit);
      
      res.json({ 
        productionRate,
        unit: unit || 'шт',
        workTypeName,
        generated: true
      });
    } catch (ollamaError: any) {
      logger.error('Ошибка генерации норматива:', ollamaError.message);
      // Возвращаем значение по умолчанию, если ИИ недоступен
      const defaultRate = getDefaultProductionRate(workTypeName, unit);
      res.json({ 
        productionRate: defaultRate,
        unit: unit || 'шт',
        workTypeName,
        generated: false,
        note: 'Использовано значение по умолчанию (ИИ недоступен)'
      });
    }
  } catch (error: any) {
    logger.error('Error calculating norm:', error);
    res.status(500).json({ 
      error: 'Ошибка расчета норматива', 
      message: error.message 
    });
  }
});

// Функция для генерации норматива с помощью Ollama
async function generateNormWithOllama(prompt: string, workTypeName: string, unit?: string): Promise<number> {
  let apiUrl: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (USE_OLLAMA_CLOUD && OLLAMA_API_KEY) {
    apiUrl = 'https://api.ollama.ai/v1/generate';
    headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
  } else {
    apiUrl = `${OLLAMA_URL}/api/generate`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд таймаут

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Низкая температура для более точных числовых ответов
          num_predict: 50, // Нужно только число
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const typedData = data as { response?: string };
    const responseText = (typedData.response || '').trim();
    
    // Извлекаем число из ответа
    const numbers = responseText.match(/[\d.]+/);
    if (numbers && numbers[0]) {
      const rate = parseFloat(numbers[0]);
      if (rate > 0 && rate < 10000) { // Разумные пределы
        return Math.round(rate * 10) / 10; // Округляем до 1 знака после запятой
      }
    }
    
    // Если не удалось извлечь число, возвращаем значение по умолчанию
    return getDefaultProductionRate(workTypeName, unit);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error('Таймаут генерации (20 секунд)');
    }
    throw new Error(`Failed to generate norm: ${error.message}`);
  }
}

// Функция для получения значения по умолчанию на основе типа работ
function getDefaultProductionRate(workTypeName: string, unit?: string): number {
  const name = workTypeName.toLowerCase();
  
  // Простая эвристика на основе названия работ
  if (name.includes('кладка') || name.includes('кирпич')) return 10;
  if (name.includes('бетон') || name.includes('заливка')) return 6;
  if (name.includes('штукатур') || name.includes('оштукатур')) return 20;
  if (name.includes('покраск') || name.includes('покрас')) return 25;
  if (name.includes('землян') || name.includes('котлован')) return 50;
  if (name.includes('арматур')) return 8;
  if (name.includes('кровл') || name.includes('крыш')) return 15;
  if (name.includes('утепл')) return 30;
  if (name.includes('электр') || name.includes('монтаж')) return 12;
  
  // Значение по умолчанию
  return 10;
}

export default router;


