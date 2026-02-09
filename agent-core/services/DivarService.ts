import { Page } from 'playwright';
import { logger } from '../utils/logger';
import { browserService } from './BrowserService';
import { CredentialProvider } from '../types';

export type LogCallback = (level: 'info' | 'warn' | 'error', msg: string) => void;

class DivarService {
  private page: Page | null = null;
  private chatPage: Page | null = null;
  private logCb: LogCallback = () => {};

  setLogCallback(cb: LogCallback) {
    this.logCb = cb;
  }

  private dashLog(level: 'info' | 'warn' | 'error', msg: string) {
    this.logCb(level, msg);
    if (level === 'info') logger.info(msg);
    else if (level === 'warn') logger.warn(msg);
    else logger.error(msg);
  }

  async init(page: Page) {
    this.page = page;
    this.chatPage = null;
  }

  async navigateToAd(url: string) {
    if (!this.page) throw new Error('DivarService not initialized');
    logger.info(`Navigating to ad: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  async clickChatButton(adUrl?: string, credentialProvider?: CredentialProvider): Promise<boolean> {
    if (!this.page) return false;
    
    // Strategy 1: Direct navigation to chat URL if adUrl is provided
    if (adUrl) {
      try {
        let cleanUrl = adUrl.split('?')[0];
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
        const parts = cleanUrl.split('/');
        const token = parts[parts.length - 1];
        
        if (token && token.length > 3) {
           const chatUrl = `https://divar.ir/chat/${token}`;
           this.dashLog('info', `[CHAT] Navigating to: ${chatUrl}`);
           await this.page.goto(chatUrl, { waitUntil: 'domcontentloaded' });
           
           // WAITING FOR CHAT TO APPEAR (FOREVER UNTIL SUCCESS)
           logger.info('Waiting for you to login and enter chat...');
           const textarea = this.page.locator('textarea').first();
           const loginBtn = this.page.locator('button:has-text("ورود به حساب کاربری")').first();

           // If login button is visible, click it once for convenience
           if (await loginBtn.isVisible()) {
               logger.info('Clicking login button once...');
               await loginBtn.click().catch(() => {});
           }

           // INFINITE WAIT LOOP UNTIL CHAT IS READY
           while (true) {
               if (await textarea.isVisible()) {
                   logger.info('Chat detected! Starting conversation...');
                   this.chatPage = null;
                   return true;
               }
               // Check every 1 second
               await this.page.waitForTimeout(1000);
           }
        }
      } catch (e) {
        logger.warn('Error in direct chat navigation:', e);
      }
    }

    try {
      // Strategy 2: Button Click (Fallback)
      const specificBtn = this.page.locator('button[class*="start-chat-button"]').first();
      const chatButton = this.page.getByRole('button', { name: /چت/i }).first();
      const fallbackBtn = this.page.locator('button:has-text("چت")').first();
      
      let btn = specificBtn;
      if (!await btn.isVisible()) {
          if (await chatButton.isVisible()) btn = chatButton;
          else if (await fallbackBtn.isVisible()) btn = fallbackBtn;
      }

      if (!await btn.isVisible()) {
        this.dashLog('warn', '[CHAT] FAIL: Chat button not found on ad page.');
        return false;
      }
      
      this.dashLog('info', '[CHAT] Clicking Chat button on ad page...');
      try {
        await btn.click({ timeout: 5000 });
      } catch (e) {
        logger.warn('Standard click failed, trying force click...', e);
        await btn.click({ force: true, timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);
      
      const textarea = this.page.locator('textarea').first();
      const chatInput = this.page.locator('[contenteditable="true"]').first();
      
      if (await textarea.isVisible() || await chatInput.isVisible()) {
          logger.info('Successfully entered chat via button click.');
          this.chatPage = null;
          return true;
      }

      const loginRequiredBtn = this.page.locator('button:has-text("ورود به حساب کاربری")').first();
      if (await loginRequiredBtn.isVisible()) {
          logger.info('Login required after clicking chat button. Starting login flow...');
          await this.handleLogin(credentialProvider);
          logger.info('Login completed via button flow. Restoring ad page...');
          
          if (adUrl) {
              await this.navigateToAd(adUrl);
              logger.info('Ad page restored. Clicking chat button again...');
              // Try clicking the button again
              try {
                await btn.click({ timeout: 5000 });
              } catch (e) {
                await btn.click({ force: true, timeout: 5000 });
              }
              await this.page.waitForTimeout(3000);
          } else {
              // If no URL, just reload and hope we are on the right page (unlikely if handleLogin went to home)
              await this.page.reload({ waitUntil: 'domcontentloaded' });
              await this.page.waitForTimeout(5000);
          }

          if (await textarea.isVisible() || await chatInput.isVisible()) {
               logger.info('Successfully entered chat after login via button.');
               return true;
          }
      }

      this.dashLog('warn', '[CHAT] FAIL: Chat did not open after clicking button.');
      return false;
    } catch (e) {
      logger.error('Error opening chat:', e);
      return false;
    }
  }

  async checkLoginRequired(): Promise<boolean> {
    if (!this.page) return false;
    const loginText = await this.page.getByText('ورود به حساب کاربری').first();
    const phoneInput = await this.page.locator('input[type="tel"]').first();
    return (await loginText.isVisible()) || (await phoneInput.isVisible());
  }

  async handleLogin(credentialProvider?: CredentialProvider): Promise<void> {
    if (!this.page) return;
    
    logger.info('Login required. Starting login flow...');
    
    // Step 0: Click Login Button
    const loginBtn = this.page.locator('button:has-text("ورود به حساب کاربری"), a:has-text("ورود به حساب کاربری")').first();
    if (await loginBtn.isVisible()) {
      logger.info('Clicking "ورود به حساب کاربری"...');
      await loginBtn.click();
      await this.page.waitForTimeout(1000);
    }

    // Step 1: Wait for Phone Input (User must enter manually)
    logger.info('Waiting for Phone Input to appear...');
    try {
        const phoneInput = this.page.locator('input[type="tel"], input[name="mobile"]').first();
        await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
        logger.info('Phone Input visible. WAITING FOR USER TO ENTER PHONE...');
    } catch (e) {
        logger.warn('Phone input did not appear. Maybe already past it? Checking next steps...');
    }

    // POLL 1: Wait until we see OTP Input OR We are already inside
    logger.info('WAITING FOR OTP INPUT OR SUCCESS...');
    await new Promise<void>(resolve => {
        const checkState = setInterval(async () => {
            const otpField = this.page?.locator('input[autocomplete="one-time-code"], input[name="code"]').first();
            const textarea = this.page?.locator('textarea').first();
            const myDivar = this.page?.locator('button:has-text("دیوار من"), a:has-text("دیوار من")').first();

            // 1. If we are ALREADY in chat or logged in -> DONE
            if ((await textarea?.isVisible()) || (await myDivar?.isVisible())) {
                clearInterval(checkState);
                logger.info('Login successful (Chat/Profile detected). Skipping OTP wait.');
                resolve();
                return;
            }

            // 2. If OTP field appears -> Move to next wait
            if (await otpField?.isVisible()) {
                clearInterval(checkState);
                logger.info('OTP Input detected. Waiting for you to submit it...');
                resolve();
            }
        }, 1000);
    });

    // Check if we are already done (from step 1 above)
    const textarea = this.page?.locator('textarea').first();
    const myDivar = this.page?.locator('button:has-text("دیوار من"), a:has-text("دیوار من")').first();
    if ((await textarea?.isVisible()) || (await myDivar?.isVisible())) {
        logger.info('Login confirmed. Saving session...');
        await browserService.saveSession();
        return; // EXIT FUNCTION
    }

    // Step 2: Wait for OTP to be submitted (Input must disappear)
    logger.info('WAITING FOR OTP SUBMISSION...');
    
    // POLL 2: Wait until OTP field is GONE OR Chat appears
    await new Promise<void>(resolve => {
        const checkOtpDone = setInterval(async () => {
             const otpField = this.page?.locator('input[autocomplete="one-time-code"], input[name="code"]').first();
             const textarea = this.page?.locator('textarea').first();
             const myDivar = this.page?.locator('button:has-text("دیوار من"), a:has-text("دیوار من")').first();
             
             const isOtpVisible = await otpField?.isVisible();
             const isChatVisible = await textarea?.isVisible();
             const isProfileVisible = await myDivar?.isVisible();

             if ((!isOtpVisible) || isChatVisible || isProfileVisible) {
                 clearInterval(checkOtpDone);
                 logger.info('Login flow finished.');
                 resolve();
             }
        }, 1000);
    });

    logger.info('Login confirmed. Saving session...');
    await this.page.waitForTimeout(2000); // Extra buffer just to be safe
    await browserService.saveSession();
  }

  async getAdDescription(): Promise<string> {
    if (!this.page) return '';
    try {
      const descriptionEl = await this.page.locator('.kt-description-row__text').first();
      if (await descriptionEl.isVisible()) {
        return await descriptionEl.innerText();
      }
      const mainContent = await this.page.locator('main').first();
      if (await mainContent.isVisible()) {
          return await mainContent.innerText();
      }
      return await this.page.locator('body').innerText();
    } catch (e) {
      logger.warn('Could not extract description:', e);
      return '';
    }
  }

  async getChatHistory(): Promise<string> {
    const target = this.chatPage || this.page;
    if (!target) return '';
    try {
      const messages = await target.locator('[role="log"] div, .chat-message, .message-bubble, [class*="message"]').allInnerTexts();
      if (messages.length === 0) {
          const chatBox = target.locator('.chat-box, [role="dialog"], [class*="chat"], [class*="conversation"]').first();
          if (await chatBox.isVisible()) {
              return await chatBox.innerText();
          }
      }
      return messages.join('\n');
    } catch (e) {
      return '';
    }
  }

  async sendReply(text: string): Promise<void> {
    const target = this.chatPage || this.page;
    if (!target) return;
    try {
      logger.info(`Sending reply: "${text}"`);
      const textarea = target.locator('textarea').first();
      await textarea.fill(text);
      await target.waitForTimeout(500);

      // Try multiple selectors for the send button
      const sendBtn = target.locator(
          'button[type="submit"], button:has-text("ارسال"), button[aria-label="ارسال"], button[class*="send-button"], button:has(svg[data-icon="send"])'
      ).first();

      if (await sendBtn.isVisible()) {
          logger.info('Clicking send button...');
          await sendBtn.click();
      } else {
          logger.warn('Send button not found/visible. Trying Enter key...');
          await textarea.press('Enter');
      }
      
      await target.waitForTimeout(2000);
    } catch (e) {
      logger.error('Error sending reply:', e);
    }
  }
}

export const divarService = new DivarService();
