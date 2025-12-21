import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Конфигурация Ollama
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// Для инструкций используем отдельную переменную, если не указана - используем общую или дефолт
const OLLAMA_MODEL = process.env.OLLAMA_INSTRUCTIONS_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:1b'; // Легкая и быстрая модель (1B параметров) для инструкций
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY; // API ключ для Ollama Cloud (если используется)
const USE_OLLAMA_CLOUD = process.env.USE_OLLAMA_CLOUD === 'true' || !!OLLAMA_API_KEY; // Использовать облачный API

// ========================================
// CRUD для инструкций
// ========================================

// GET /api/instructions - Получить все инструкции
router.get('/', async (req, res) => {
  try {
    const instructions = await prisma.instruction.findMany({
      include: {
        workTypes: {
          include: {
            workTypeItem: {
              include: {
                group: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(instructions);
  } catch (error: any) {
    console.error('Error fetching instructions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/instructions/:id - Получить инструкцию по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const instruction = await prisma.instruction.findUnique({
      where: { id },
      include: {
        workTypes: {
          include: {
            workTypeItem: {
              include: {
                group: true
              }
            }
          }
        }
      }
    });
    
    if (!instruction) {
      return res.status(404).json({ error: 'Инструкция не найдена' });
    }
    
    res.json(instruction);
  } catch (error: any) {
    console.error('Error fetching instruction:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/instructions - Создать инструкцию
router.post('/', async (req, res) => {
  try {
    const { code, name, text, workTypeItemIds } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Код инструкции обязателен' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Название инструкции обязательно' });
    }
    
    if (!text) {
      return res.status(400).json({ error: 'Текст инструкции обязателен' });
    }
    
    if (text.length > 20000) {
      return res.status(400).json({ error: 'Текст инструкции не должен превышать 20 000 символов' });
    }
    
    const instruction = await prisma.instruction.create({
      data: {
        code,
        name,
        text,
        workTypes: {
          create: (workTypeItemIds || []).map((workTypeItemId: string) => ({
            workTypeItemId
          }))
        }
      },
      include: {
        workTypes: {
          include: {
            workTypeItem: {
              include: {
                group: true
              }
            }
          }
        }
      }
    });
    
    res.status(201).json(instruction);
  } catch (error: any) {
    console.error('Error creating instruction:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/instructions/:id - Обновить инструкцию
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, text, workTypeItemIds } = req.body;
    
    if (text && text.length > 20000) {
      return res.status(400).json({ error: 'Текст инструкции не должен превышать 20 000 символов' });
    }
    
    // Удаляем старые связи с видами работ
    await prisma.instructionWorkType.deleteMany({
      where: { instructionId: id }
    });
    
    // Обновляем инструкцию и создаем новые связи
    const instruction = await prisma.instruction.update({
      where: { id },
      data: {
        code,
        name,
        text,
        workTypes: {
          create: (workTypeItemIds || []).map((workTypeItemId: string) => ({
            workTypeItemId
          }))
        }
      },
      include: {
        workTypes: {
          include: {
            workTypeItem: {
              include: {
                group: true
              }
            }
          }
        }
      }
    });
    
    res.json(instruction);
  } catch (error: any) {
    console.error('Error updating instruction:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/instructions/:id - Удалить инструкцию
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.instruction.delete({
      where: { id }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting instruction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// Генерация текста инструкции через AI
// ========================================

// POST /api/instructions/generate-excerpt
// Генерирует текстовую выдержку для инструкции на основе выбранных видов работ
router.post('/generate-excerpt', async (req, res) => {
  try {
    const { worktypeNames, instructionName, code } = req.body;

    if (!worktypeNames || !Array.isArray(worktypeNames) || worktypeNames.length === 0) {
      return res.status(400).json({ error: 'Список видов работ обязателен' });
    }

    // Формируем оптимизированный промпт для генерации подробной инструкции
    const worktypesList = worktypeNames.join(', ');
    const prompt = `Ты профессиональный инженер по охране труда. Напиши подробную инструкцию по охране труда на русском языке.

  Виды работ, для которых пишется инструкция: ${worktypesList}

  Требования к ответу:
  - Весь текст СТРОГО на русском языке
  - НЕЛЬЗЯ отвечать отказом, предупреждением или ссылками на международные стандарты (ILO и т.п.)
  - ЗАПРЕЩЕНО использовать английские слова (worksite, guard, site, burn, worker и т.д.)
  - Все технические термины только на русском (работник, рабочее место, площадка и т.д.)
  - Объем текста: не менее 2000 символов, стремись к 2500–3500 символов
  - Пиши инструкцию ТОЛЬКО для указанных видов работ, не добавляй лишнего
  - Не упоминай, что текст может быть неточным, просто выдай готовую инструкцию

  Структура инструкции (используй нумерацию 1.1., 1.2., 1.3. и т.д.):

1. ОБЩИЕ ТРЕБОВАНИЯ БЕЗОПАСНОСТИ
- Допуск к работам (квалификация, обучение, медицинский осмотр)
- Требования к средствам индивидуальной защиты (каска, очки, перчатки, спецодежда и т.д.)
- Знание инструкций и правил техники безопасности

2. ТРЕБОВАНИЯ БЕЗОПАСНОСТИ ПЕРЕД НАЧАЛОМ РАБОТЫ
- Осмотр рабочего места и территории
- Проверка инструментов и оборудования
- Подготовка средств защиты и ограждений

3. ТРЕБОВАНИЯ БЕЗОПАСНОСТИ ВО ВРЕМЯ РАБОТЫ
- Безопасные приемы выполнения работ
- Запрещенные действия
- Правила использования инструментов и оборудования
- Работа на высоте (если применимо к видам работ)
- Работа с электричеством (если применимо к видам работ)
- Меры предосторожности

4. ТРЕБОВАНИЯ БЕЗОПАСНОСТИ В АВАРИЙНЫХ СИТУАЦИЯХ
- Действия при возникновении опасности
- Порядок оказания первой помощи
- Правила эвакуации

5. ТРЕБОВАНИЯ БЕЗОПАСНОСТИ ПОСЛЕ ОКОНЧАНИЯ РАБОТЫ
- Уборка рабочего места
- Сдача инструментов и оборудования
- Отчетность о выполненных работах

Пиши конкретно и подробно для указанных видов работ: ${worktypesList}. Будь профессиональным. Используй простой и понятный русский язык. СТРОГО ЗАПРЕЩЕНО использовать английские слова.`;

    // Генерируем через Ollama (без заглушки)
    let excerpt: string;
    try {
      excerpt = await generateWithOllama(prompt);
    } catch (ollamaError: any) {
      console.error('Ошибка генерации через Ollama:', ollamaError.message);
      throw new Error(`Не удалось сгенерировать текст: ${ollamaError.message}. Убедитесь, что Ollama запущен и модель скачана.`);
    }

    // Обрезаем до 10000 символов
    excerpt = excerpt.substring(0, 10000).trim();

    res.json({ 
      excerpt,
      generated: true,
      isAI: true // Всегда true, так как заглушка убрана
    });
  } catch (error: any) {
    console.error('Error generating instruction excerpt:', error);
    res.status(500).json({ 
      error: 'Ошибка генерации текста', 
      message: error.message 
    });
  }
});

// Функция для генерации текста с помощью Ollama
async function generateWithOllama(prompt: string): Promise<string> {
  // Определяем URL и заголовки в зависимости от типа подключения
    let apiUrl: string;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (USE_OLLAMA_CLOUD && OLLAMA_API_KEY) {
      // Используем Ollama Cloud API
      apiUrl = 'https://api.ollama.ai/v1/generate';
      headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
    } else {
      // Используем локальный Ollama
      apiUrl = `${OLLAMA_URL}/api/generate`;
    }

  // Устанавливаем таймаут для генерации (Saiga/8B может отвечать дольше)
  const GENERATION_TIMEOUT_MS = Number(process.env.OLLAMA_INSTRUCTIONS_TIMEOUT_MS || 120000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2200, // Умеренная длина для 1B модели, чтобы сократить время и избежать таймаута
          top_p: 0.9,
          repeat_penalty: 1.1, // Уменьшаем повторения
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
      return typedData.response || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        const seconds = Math.round(GENERATION_TIMEOUT_MS / 1000);
        throw new Error(`Таймаут генерации (${seconds} секунд). Попробуйте уменьшить количество выбранных видов работ или повторить попытку.`);
      }
      throw new Error(`Failed to generate with Ollama: ${error.message}`);
    }
}

export default router;

