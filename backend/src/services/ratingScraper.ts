import logger from '../utils/logger';
import puppeteer from 'puppeteer';

export async function scrapeRating(inn: string): Promise<string | null> {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true, // Use headless for server
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set viewport to see elements better
        await page.setViewport({ width: 1280, height: 800 });

        // 1. Go to page
        await page.goto('https://reyting.mc.uz/', { waitUntil: 'networkidle2', timeout: 60000 });

        // 2. Close modal if exists
        try {
            // The user provided a specific structure. Let's look for the "Yopish" button.
            const closeButtonSelector = 'button.mantine-Button-root span.mantine-Button-label';
            await page.waitForSelector(closeButtonSelector, { timeout: 5000 });

            const buttons = await page.$$(closeButtonSelector);
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.textContent, btn);
                if (text?.includes('Yopish')) {
                    await btn.click();
                    // Wait for modal to disappear
                    await new Promise(r => setTimeout(r, 1000));
                    break;
                }
            }
        } catch (e: any) {
            logger.info('No modal found or error closing it:', e.message);
        }

        // 3. Enter INN
        const inputSelector = '#stir-search';
        await page.waitForSelector(inputSelector, { timeout: 10000 });
        await page.type(inputSelector, inn);

        // 4. Click search
        // The user said: <button type="submit" class="btn">tekshirish</button>
        // There might be multiple .btn, so let's be more specific
        const searchButtonSelector = 'button[type="submit"].btn';
        await page.click(searchButtonSelector);

        // 5. Wait for results
        // The container is .results-container__box or similar
        const resultSelector = '.rating span';
        await page.waitForSelector(resultSelector, { timeout: 15000 });

        // 6. Get rating text
        const rating = await page.evaluate((sel: string) => {
            // @ts-ignore
            const element = document.querySelector(sel);
            return element ? element.textContent?.trim() : null;
        }, resultSelector);

        return rating;
    } catch (error: any) {
        logger.error(`Scraping error for INN ${inn}:`, error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

