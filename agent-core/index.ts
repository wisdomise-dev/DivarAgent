import { browserService } from './services/BrowserService';
import { divarService } from './services/DivarService';
import { geminiService } from './services/GeminiService';
import { logger } from './utils/logger';

async function main() {
  try {
    // 1. Launch Browser first (so user can navigate if needed)
    const page = await browserService.launchBrowser(false); // Headful
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
    
    // 3. From here, we are on the page. Proceed to chat.
    // If we are already on chat page (e.g. user navigated to /chat/...), handle it.
    if (adUrl.includes('/chat/')) {
        logger.info('User navigated directly to chat page.');
        // We might need to just attach to the chat context
        // But let's let the standard flow run, it handles chat detection.
    } else {
        // We are on ad page (most likely)
        logger.info('Attempting to open chat...');
        await divarService.clickChatButton();
    }

    // 5. Check Login
    // Wait a bit for modal to appear
    await page.waitForTimeout(3000);
    const isLoginNeeded = await divarService.checkLoginRequired();
    
    if (isLoginNeeded) {
      logger.warn('Login required!');
      await divarService.handleLogin();
      
      // After login, we might need to click chat again or we might be redirected
      logger.info('Re-checking chat state after login...');
      await divarService.navigateToAd(adUrl); // Refresh/Re-nav to be safe
      await divarService.clickChatButton();
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
      const reply = await geminiService.generateReply(currentHistory, adDescription);

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
