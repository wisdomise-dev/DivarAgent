import { browserService } from '../agent-core/services/BrowserService';
import { divarService } from '../agent-core/services/DivarService';
import { geminiService } from '../agent-core/services/GeminiService';
import { logger } from '../agent-core/utils/logger';
export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'navigating'
  | 'login_phone'
  | 'login_otp'
  | 'chatting'
  | 'price_found'
  | 'error';

export interface AgentState {
  status: AgentStatus;
  url?: string;
  adDescription?: string;
  priceResult?: string;
  error?: string;
}

export type LogCallback = (level: 'info' | 'warn' | 'error', msg: string) => void;
export type StatusCallback = (state: AgentState) => void;

export class AgentRunner {
  status: AgentStatus = 'idle';
  private logCb: LogCallback = () => {};
  private statusCb: StatusCallback = () => {};
  private resolvePhone: ((v: string) => void) | null = null;
  private resolveOtp: ((v: string) => void) | null = null;
  private phonePromise: Promise<string> | null = null;
  private otpPromise: Promise<string> | null = null;
  private aborted = false;

  onLog(cb: LogCallback) {
    this.logCb = cb;
  }
  onStatus(cb: StatusCallback) {
    this.statusCb = cb;
  }
  private log(level: 'info' | 'warn' | 'error', msg: string) {
    this.logCb(level, msg);
    if (level === 'info') logger.info(msg);
    else if (level === 'warn') logger.warn(msg);
    else logger.error(msg);
  }
  private setStatus(s: Partial<AgentState>) {
    if (s.status) this.status = s.status;
    this.statusCb(s as AgentState);
  }

  providePhone(phone: string) {
    if (this.resolvePhone) this.resolvePhone(phone);
  }
  provideOtp(otp: string) {
    if (this.resolveOtp) this.resolveOtp(otp);
  }
  abort() {
    this.aborted = true;
  }

  async run(adUrl: string): Promise<void> {
    this.aborted = false;
    this.phonePromise = new Promise<string>((resolve) => { this.resolvePhone = resolve; });
    this.otpPromise = new Promise<string>((resolve) => { this.resolveOtp = resolve; });

    try {
      this.setStatus({ status: 'starting', url: adUrl });
      this.log('info', `Starting with URL: ${adUrl}`);

      if (!adUrl || !adUrl.includes('divar.ir')) {
        throw new Error('Invalid Divar URL.');
      }

      const page = await browserService.launchBrowser();
      divarService.setLogCallback((level, msg) => this.log(level, msg));
      await divarService.init(page);

      this.setStatus({ status: 'navigating' });
      await divarService.navigateToAd(adUrl);
      let adDescription = await divarService.getAdDescription();
      this.log('info', `Ad Context:\n${adDescription}`);

      this.log('info', 'Attempting to enter chat...');
      const enteredChat = await divarService.clickChatButton(adUrl, {
          getPhone: () => this.phonePromise!,
          getOtp: () => this.otpPromise!,
          onStepChange: (step) => this.setStatus({ status: step === 'phone' ? 'login_phone' : 'login_otp' })
      });
      
      if (!enteredChat) {
          throw new Error('Failed to enter chat. Check logs for details (Login issue or Chat button not found).');
      }

      this.setStatus({ status: 'chatting', adDescription });

      let lastHistory = '';
      let consecutiveNoChange = 0;

      while (!this.aborted) {
        const currentHistory = await divarService.getChatHistory();
        if (currentHistory === lastHistory && currentHistory.length > 0) {
          consecutiveNoChange++;
          if (consecutiveNoChange % 5 === 0) this.log('info', 'Waiting for seller response...');
          await page.waitForTimeout(5000);
          continue;
        }
        consecutiveNoChange = 0;
        lastHistory = currentHistory;

        const reply = await geminiService.generateReply(currentHistory, adDescription);
        
        let finalReply = reply;
        
        if (finalReply.includes('WAIT')) {
          this.log('info', 'Gemini suggested to WAIT (Last message is from us).');
          await page.waitForTimeout(5000);
          continue;
        }

        if (finalReply.includes('PRICE_FOUND:')) {
          this.log('info', '✅ MISSION ACCOMPLISHED');
          this.log('info', finalReply);
          this.setStatus({ status: 'price_found', priceResult: finalReply });
          return;
        }

        if (finalReply) {
          await divarService.sendReply(finalReply);
          await page.waitForTimeout(3000);
          lastHistory = await divarService.getChatHistory();
        }

        const delay = Math.floor(Math.random() * 5000) + 5000;
        await page.waitForTimeout(delay);
      }
    } catch (err: any) {
      this.log('error', err?.message || 'An error occurred');
      this.setStatus({ status: 'error', error: err?.message });
    } finally {
      this.log('info', 'Process finished.');
    }
  }
}
