import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { config } from '../config';

class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  public page: Page | null = null;

  async launchBrowser(headless: boolean = false): Promise<Page> {
    logger.info(`Launching browser (headless: ${headless})...`);
    const userDataDir = path.resolve(process.cwd(), 'divar-user-data');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: headless,
      viewport: { width: 1280, height: 720 },
      userAgent: config.USER_AGENT,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    return this.page;
  }

  async saveSession(): Promise<void> {
    if (this.context) {
      logger.info('Saving session to file...');
      const sessionPath = path.resolve(process.cwd(), config.SESSION_FILE);
      await this.context.storageState({ path: sessionPath });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.context) {
      logger.info('Closing browser...');
      await this.context.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}

export const browserService = new BrowserService();
