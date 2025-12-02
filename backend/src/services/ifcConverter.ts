import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export interface ConvertOptions {
  ifcPath: string;
  outputDir: string;
}

export async function convertIfcToXkt(options: ConvertOptions): Promise<string> {
  const { ifcPath, outputDir } = options;

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

  try {
    // Используем xeokit-convert через CLI с правильными флагами
    const convertCmd = `npx @xeokit/xeokit-convert -s "${ifcPath}" -o "${xktPath}" -l`;
    
    console.log('⚙️ Выполнение команды:', convertCmd);
    
    execSync(convertCmd, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
    });

    // Проверяем что XKT файл создан
    if (!fs.existsSync(xktPath)) {
      throw new Error('XKT файл не был создан');
    }

    const stats = fs.statSync(xktPath);
    console.log('✅ XKT файл создан:', xktPath);
    console.log('📦 Размер XKT:', (stats.size / 1024).toFixed(2), 'KB');

    return xktPath;
  } catch (error: any) {
    console.error('❌ Ошибка конвертации:', error.message);
    throw new Error(`Не удалось конвертировать IFC в XKT: ${error.message}`);
  }
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
