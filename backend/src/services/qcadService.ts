import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

/**
 * Сервис для работы с QCAD CLI
 */
export class QCadService {
    // Путь к QCAD (можно вынести в .env)
    private static getQcadBatPath(): string | null {
        const envPath = process.env.QCAD_PATH ? path.join(process.env.QCAD_PATH, 'dwg2pdf.bat') : null;
        const candidates = [
            envPath,
            'C://Program Files//QCAD//dwg2pdf.bat',
            'C://Program Files (x86)//QCAD//dwg2pdf.bat',
            'C://Program Files//QCAD Professional//dwg2pdf.bat',
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Конвертирует DWG в PDF для превью
     * @param inputPath Абсолютный путь к исходному DWG
     * @param outputDir Директория для сохранения PDF
     * @returns Путь к созданному PDF (относительно корня проекта)
     */
    static async convertToPdf(inputPath: string, outputDir: string): Promise<string | null> {
        return new Promise((resolve) => {
            const batPath = this.getQcadBatPath();
            if (!batPath) {
                logger.warn('QCAD dwg2pdf.bat не найден. Установите QCAD и задайте переменную QCAD_PATH или путь по умолчанию.');
                return resolve(null);
            }

            const fileName = path.basename(inputPath, path.extname(inputPath)) + '.pdf';
            const outputPath = path.join(outputDir, fileName);
            const absoluteInputPath = path.resolve(inputPath);
            const absoluteOutputPath = path.resolve(outputPath);

            // Команда: -f (перезаписать), -a (авто-масштаб), -o (выходной файл)
            const command = `"${batPath}" -f -a -o "${absoluteOutputPath}" "${absoluteInputPath}"`;
            const qcadDir = path.dirname(batPath);

            logger.info(`Запуск конвертации DWG -> PDF: ${command}`);

            // dwg2pdf.bat expects qcadcmd.com in the working directory
            exec(command, { cwd: qcadDir }, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Ошибка QCAD: ${error.message}`);
                    return resolve(null);
                }
                if (stderr) {
                    logger.warn(`QCAD stderr: ${stderr}`);
                }
                
                logger.info(`Успешная конвертация: ${outputPath}`);
                // Возвращаем путь в формате uploads/...
                const relativePath = outputPath.replace(/\\/g, '/');
                resolve(relativePath);
            });
        });
    }
}
