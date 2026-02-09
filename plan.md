# Divar Price Inquiry Agent Plan

This agent automates the process of inquiring about product prices on the Divar website using a browser automation tool (Playwright) and an AI model (Gemini).

## 1. Project Overview

The goal is to:
1.  Open a Divar ad link.
2.  Click "Chat" (requires login).
3.  Handle OTP login manually via terminal input (session saved for future runs).
4.  Read the ad description to understand the context.
5.  Engage in a conversation with the seller using Gemini to ask for the price in a natural, human-like manner.
6.  Extract the price from the seller's response and terminate.

## 2. Technical Stack

-   **Runtime**: Node.js
-   **Language**: TypeScript
-   **Browser Automation**: Playwright (Headful mode for debugging and manual intervention).
-   **AI**: Google Generative AI (Gemini Pro).
-   **Utilities**: `dotenv` (env vars), `readline` (user input).

## 3. Architecture

### File Structure
```
D:\DivarAgent\
├── src\
│   ├── index.ts                # Main entry point and orchestration loop
│   ├── config.ts               # Configuration and environment variables
│   ├── services\
│   │   ├── BrowserService.ts   # Manages Playwright browser, context, and storage state
│   │   ├── DivarService.ts     # Interactions with Divar (navigation, clicking, reading chat)
│   │   └── GeminiService.ts    # AI logic for generating replies and detecting price
│   └── utils\
│       └── logger.ts           # Simple logging utility
├── .env                        # API keys and secrets
├── package.json
└── tsconfig.json
```

## 4. Implementation Steps

### Phase 1: Setup & Infrastructure
1.  **Initialize Project**: Create `package.json` and install dependencies.
2.  **TypeScript Config**: Setup `tsconfig.json`.
3.  **Environment Variables**: Create `.env` file for `GEMINI_API_KEY`.

### Phase 2: Browser Automation (The Body)
4.  **Browser Service**:
    -   Launch Playwright in headful mode.
    -   Implement `saveSession` and `loadSession` to persist login cookies.
5.  **Divar Service (Basic)**:
    -   Navigate to ad URL.
    -   Click "Chat" button.
    -   **Login Flow**: If not logged in, prompt user for phone number and OTP in terminal, then input into browser.

### Phase 3: AI Integration (The Brain)
6.  **Gemini Service**:
    -   Initialize Google Generative AI client.
    -   Create a prompt that instructs Gemini to act as a buyer.
    -   Implement `generateReply(history, adDescription)` method.
    -   Implement `extractPrice(text)` method (or include it in the main prompt logic).

### Phase 4: The Conversation Loop & Orchestration
7.  **Chat Interface**:
    -   Implement logic to read chat history from the DOM.
    -   Implement logic to type and send messages.
8.  **Main Loop (`index.ts`)**:
    -   Start browser.
    -   Go to ad.
    -   Get ad description.
    -   **Loop**:
        -   Check for new messages.
        -   If new message, send history to Gemini.
        -   Gemini generates response.
        -   Agent sends response.
        -   Check if price is found. If yes, exit.
        -   Wait random delay (human-like behavior).

### Phase 5: Refinement
9.  **Error Handling**: Handle timeouts, network errors, or element not found.
10. **Polishing**: Add random delays between actions.

## 5. Development Checklist

- [ ] Initialize Node.js project (`npm init -y`)
- [ ] Install dependencies (`playwright`, `@google/generative-ai`, `dotenv`, `typescript`, `ts-node`, `@types/node`)
- [ ] Setup `tsconfig.json`
- [ ] Create `.env` file
- [ ] Implement `src/config.ts`
- [ ] Implement `src/utils/logger.ts`
- [ ] Implement `src/services/GeminiService.ts`
- [ ] Implement `src/services/BrowserService.ts`
- [ ] Implement `src/services/DivarService.ts` (Navigation & Login)
- [ ] Implement `src/services/DivarService.ts` (Chat & Scraping)
- [ ] Implement `src/index.ts` (Main Loop)
- [ ] Test & Debug
