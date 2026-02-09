import { browserService } from '../agent-core/services/BrowserService';
import { divarService } from '../agent-core/services/DivarService';
import { geminiService } from '../agent-core/services/GeminiService';
import { logger } from '../agent-core/utils/logger';

async function main() {
  try {
    // 1. Launch Browser first (so user can navigate if needed)
    const page = await browserService.launchBrowser();
    await divarService.init(page);

    // 2. Check for URL or wait for user
    let adUrl = process.argv[2];
    
    if (adUrl && adUrl.includes('divar.ir')) {
        logger.info(`Using URL from arguments: ${adUrl}`);
        await divarService.navigateToAd(adUrl);
    } else {
        logger.info('No URL provided. Opening Divar home page...');
        await page.goto('https://divar.ir', { waitUntil: 'domcontentloaded' });
        
        logger.info('⚠️ WAITING FOR USER TO NAVIGATE TO AN AD PAGE...');
        logger.info('Please navigate to the desired Ad page in the browser window.');

        // Wait until URL looks like an ad page
        while (true) {
            const currentUrl = page.url();
            if (currentUrl.includes('/v/') || currentUrl.includes('/chat/')) {
                logger.info(`Detected Ad/Chat page: ${currentUrl}`);
                adUrl = currentUrl;
                break;
            }
            await page.waitForTimeout(1000);
        }
    }
    
    // 3. Check if already in chat or need to click
    logger.info('Checking chat state...');
    let inChat = false;
    
    // Check if we are already on a chat page
    if (page.url().includes('divar.ir/chat/')) {
        inChat = true;
        logger.info('Detected existing chat session.');
    } else {
        logger.info('Attempting to open chat...');
        inChat = await divarService.clickChatButton(adUrl);
    }

    if (!inChat) {
        // Fallback to login check
        const isLoginNeeded = await divarService.checkLoginRequired();
        if (isLoginNeeded) {
            logger.warn('Login required!');
            await divarService.handleLogin();
            await divarService.navigateToAd(adUrl);
            await divarService.clickChatButton(adUrl);
        }
    }

    // 6. Get Context
    const adDescription = await divarService.getAdDescription();
    logger.info(`Ad Context: "${adDescription.substring(0, 50)}..."`);

    // 7. Conversation Loop
    let lastHistory = '';
    let consecutiveNoChange = 0;

    logger.info('Starting conversation loop...');

    while (true) {
      // Get history
      const currentHistory = await divarService.getChatHistory();
      
      // If history hasn't changed, wait longer
      if (currentHistory === lastHistory && currentHistory.length > 0) {
        consecutiveNoChange++;
        if (consecutiveNoChange % 5 === 0) {
            logger.info('Waiting for seller response...');
        }
        await page.waitForTimeout(5000);
        continue;
      }
      
      consecutiveNoChange = 0;
      lastHistory = currentHistory;

      // Generate Reply
      let reply = await geminiService.generateReply(currentHistory, adDescription);

      if (reply.includes('WAIT')) {
          logger.info('Gemini suggested to WAIT (Last message is from us).');
          await page.waitForTimeout(5000);
          continue;
      }

      if (reply.includes('PRICE_FOUND:')) {
        logger.info('✅ MISSION ACCOMPLISHED');
        logger.info(reply);
        break;
      }

      // Check if we should send the reply
      // If the last message in history is seemingly ours, we might want to skip.
      // But Gemini is smart enough to see "Chat History" and decide if it needs to reply.
      // However, my prompt says "Generate a reply". 
      // I should add logic: if Gemini output is "WAIT" (meaning it's not my turn), do nothing.
      // But the prompt currently forces a reply.
      // Let's rely on the change detection (lastHistory). 
      // If history changed (new message from seller), we reply.
      // Initial state: history might be empty or just system messages.
      
      if (reply) {
          await divarService.sendReply(reply);
          // Wait to ensure our message appears in history so we don't double send
          await page.waitForTimeout(3000);
          lastHistory = await divarService.getChatHistory(); // Update history immediately
      }

      // Random delay
      const delay = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
      await page.waitForTimeout(delay);
    }

  } catch (error) {
    logger.error('An error occurred:', error);
  } finally {
    logger.info('Process finished. Press Ctrl+C to exit.');
    // Keep alive for user inspection
    setInterval(() => {}, 1000);
  }
}

main();
