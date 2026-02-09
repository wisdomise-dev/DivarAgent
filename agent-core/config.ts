import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SESSION_FILE: 'session.json',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
