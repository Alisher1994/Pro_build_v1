import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export interface ConvertOptions {
  ifcPath: string;
  outputDir: string;
  onProgress?: (progress: number, message: string) => void;
}

export async function convertIfcToXkt(options: ConvertOptions): Promise<string> {
  const { ifcPath, outputDir, onProgress } = options;

  console.log('🔄 Начало конвертации IFC → XKT');
  console.log('📂 IFC файл:', ifcPath);

  // Проверяем существование IFC файла
  if (!fs.existsSync(ifcPath)) {
    throw new Error(`IFC файл не найден: ${ifcPath}`);
  }

  // Создаём директорию для XKT если не существует
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Генерируем имя для XKT файла
  const ifcFileName = path.basename(ifcPath, '.ifc');
  const xktFileName = `${ifcFileName}.xkt`;
  const xktPath = path.join(outputDir, xktFileName);

  return new Promise((resolve, reject) => {
    if (onProgress) onProgress(10, 'Начало конвертации...');

    // Используем spawn для асинхронной конвертации
    const convertProcess = spawn('npx', [
      '@xeokit/xeokit-convert',
      '-s', ifcPath,
      '-o', xktPath,
      '-l'
    ], {
      cwd: path.join(__dirname, '../..'),
      shell: true
    });

    let stdoutData = '';
    let stderrData = '';
    let progressPercent = 20;

    convertProcess.stdout?.on('data', (data) => {
      stdoutData += data.toString();
      const output = data.toString();
      console.log(output);
      
      // Симулируем прогресс
      if (progressPercent < 90) {
        progressPercent += 10;
        if (onProgress) onProgress(progressPercent, 'Обработка модели...');
      }
    });

    convertProcess.stderr?.on('data', (data) => {
      stderrData += data.toString();
      console.error(data.toString());
    });

    convertProcess.on('error', (error) => {
      console.error('❌ Ошибка запуска процесса конвертации:', error.message);
      reject(new Error(`Не удалось запустить конвертацию: ${error.message}`));
    });

    convertProcess.on('close', (code) => {
      if (code === 0) {
        // Проверяем что XKT файл создан
        if (!fs.existsSync(xktPath)) {
          reject(new Error('XKT файл не был создан'));
          return;
        }

        const stats = fs.statSync(xktPath);
        console.log('✅ XKT файл создан:', xktPath);
        console.log('📦 Размер XKT:', (stats.size / 1024).toFixed(2), 'KB');
        
        if (onProgress) onProgress(100, 'Конвертация завершена');
        resolve(xktPath);
      } else {
        console.error('❌ Ошибка конвертации. Код выхода:', code);
        console.error('Stderr:', stderrData);
        reject(new Error(`Конвертация завершилась с кодом ${code}`));
      }
    });
  });
}

// Удаление временных файлов
export function cleanupTempFiles(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Временный файл удалён:', filePath);
    }
  } catch (error) {
    console.error('Ошибка удаления файла:', error);
  }
}
