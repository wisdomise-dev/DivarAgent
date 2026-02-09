import { Page } from 'playwright';
import { logger } from '../utils/logger';
import { browserService } from './BrowserService';
import * as readline from 'readline';

class DivarService {
  private page: Page | null = null;

  async init(page: Page) {
    this.page = page;
  }

  async navigateToAd(url: string) {
    if (!this.page) throw new Error('DivarService not initialized');
    logger.info(`Navigating to ad: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000); // Wait for dynamic content
  }

  async clickChatButton(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      // Try to find the chat button
      // Divar chat button usually says "چت" or has an icon
      const chatButton = await this.page.getByRole('button', { name: /چت/i }).first();
      
      if (await chatButton.isVisible()) {
        logger.info('Clicking Chat button...');
        await chatButton.click();
        await this.page.waitForTimeout(2000);
        return true;
      } else {
        logger.warn('Chat button not found directly.');
        // Fallback: search for any button containing "چت" text
        const fallbackBtn = await this.page.locator('button:has-text("چت")').first();
        if (await fallbackBtn.isVisible()) {
             await fallbackBtn.click();
             await this.page.waitForTimeout(2000);
             return true;
        }
        return false;
      }
    } catch (e) {
      logger.error('Error finding chat button:', e);
      return false;
    }
  }

  async checkLoginRequired(): Promise<boolean> {
    if (!this.page) return false;
    // Check for login modal or text indicating login is needed
    // Divar login usually has "ورود به حساب کاربری" or similar
    const loginText = await this.page.getByText('ورود به حساب کاربری').first();
    const phoneInput = await this.page.locator('input[type="tel"]').first(); // Phone input
    
    return (await loginText.isVisible()) || (await phoneInput.isVisible());
  }

  async handleLogin(): Promise<void> {
    if (!this.page) return;
    
    logger.info('Login required. Starting login flow...');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (query: string): Promise<string> => {
      return new Promise((resolve) => rl.question(query, resolve));
    };

    try {
      // Step 1: Phone Number
      const phoneInput = this.page.locator('input[type="tel"]').first();
      // Also try other selectors for phone input
      const phoneInputAlt = this.page.locator('input[name="mobile"]').first();
      const phoneInputGeneric = this.page.locator('input[placeholder*="شماره"]').first();
      
      let targetPhoneInput = null;
      if (await phoneInput.isVisible()) targetPhoneInput = phoneInput;
      else if (await phoneInputAlt.isVisible()) targetPhoneInput = phoneInputAlt;
      else if (await phoneInputGeneric.isVisible()) targetPhoneInput = phoneInputGeneric;

      if (targetPhoneInput) {
        let phoneNumber = process.env.DIVAR_PHONE;
        if (!phoneNumber) {
             logger.info('Waiting for phone number input...');
             phoneNumber = await askQuestion('Please enter your phone number (e.g., 0912...): ');
        } else {
            logger.info('Using phone number from environment variable.');
        }

        if (!phoneNumber) throw new Error('Phone number is required');

        await targetPhoneInput.fill(phoneNumber);
        
        // Click "Next" or "Submit" - usually "تایید" or "ارسال کد"
        // Look for submit button
        const submitBtn = this.page.locator('button[type="submit"]').first(); // Often generic
        if (await submitBtn.isVisible()) {
             await submitBtn.click();
        } else {
             // Fallback search for text
             await this.page.getByText('تایید').click();
        }
        
        logger.info('Phone number submitted. Saving intermediate session...');
        await browserService.saveSession();
        
        logger.info('Waiting for OTP input...');
        await this.page.waitForTimeout(2000);
      }

      // Step 2: OTP
      // Wait for OTP input to appear
      const otpInput = this.page.locator('input[name="code"]').first(); 
      
      let otpCode = process.env.DIVAR_OTP;
      if (!otpCode) {
          logger.info('Waiting for OTP input...');
          otpCode = await askQuestion('Please enter the OTP sent to your phone: ');
      } else {
          logger.info('Using OTP from environment variable.');
      }
      
      if (!otpCode) throw new Error('OTP is required');
      
      // Fill OTP
      const otpField = this.page.locator('input[autocomplete="one-time-code"]').first();
      if (await otpField.isVisible()) {
          await otpField.fill(otpCode);
      } else {
          // Fallback: try filling in the first visible input if specific one not found
           const anyInput = this.page.locator('input').first();
           await anyInput.fill(otpCode);
      }

      // Click Confirm
      // Wait for auto-submit or click button
      await this.page.waitForTimeout(1000);
      const confirmBtn = this.page.getByText('تایید').first();
      if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
      }
      
      logger.info('Login submitted. Waiting for redirection...');
      await this.page.waitForTimeout(5000);
      
      // Save session
      await browserService.saveSession();
      logger.info('Session saved.');

    } catch (error) {
      logger.error('Login failed:', error);
    } finally {
      rl.close();
    }
  }

  async getAdDescription(): Promise<string> {
    if (!this.page) return '';
    try {
      // Find description element
      // Usually generic text block or specific class
      const descriptionEl = await this.page.locator('.kt-description-row__text').first(); // Example class
      if (await descriptionEl.isVisible()) {
        return await descriptionEl.innerText();
      }
      // Fallback: get all paragraph text
      return await this.page.locator('p').allInnerTexts().then(texts => texts.join('\n'));
    } catch (e) {
      logger.warn('Could not extract description:', e);
      return '';
    }
  }

  async getChatHistory(): Promise<string> {
    if (!this.page) return '';
    try {
      // Select chat messages container
      // This selector is tricky without seeing the DOM.
      // Look for message bubbles.
      // Assuming a standard chat structure.
      // We will look for elements with text content that aren't navigation.
      
      // Let's assume messages are in a list or divs.
      // We'll grab text from the chat area.
      // This is a placeholder selector - MUST be verified on actual site.
      const messages = await this.page.locator('[role="log"] div, .chat-message, .message-bubble').allInnerTexts();
      
      if (messages.length === 0) {
          // Fallback: try to read all text in the "modal" or "chat box" if it's a popup
          const chatBox = this.page.locator('.chat-box, [role="dialog"]').first();
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
    if (!this.page) return;
    try {
      logger.info(`Sending reply: "${text}"`);
      // Find textarea
      const textarea = this.page.locator('textarea').first();
      await textarea.fill(text);
      await this.page.waitForTimeout(500);
      
      // Find send button
      const sendBtn = this.page.locator('button[type="submit"], button:has-text("ارسال")').first();
      await sendBtn.click();
      await this.page.waitForTimeout(2000);
    } catch (e) {
      logger.error('Error sending reply:', e);
    }
  }
}

export const divarService = new DivarService();
