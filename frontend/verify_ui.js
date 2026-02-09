import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Config
const DASHBOARD_URL = 'http://localhost:5173';
const TARGET_API_URL = 'https://texcult-backend-latest-1.onrender.com/texcultv1/user/action/login-otp';
const SCREENSHOT_PATH = path.resolve('C:\\Users\\hp\\.gemini\\antigravity\\brain\\7ef12c81-a728-44e3-920c-e7c9452ec551', 'verification_ui_proof.png');

(async () => {
    console.log("🚀 Starting UI Verification Robot...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    try {
        // 1. Open Dashboard
        console.log(`[1/6] Opening ${DASHBOARD_URL}...`);
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });

        // 2. Type URL
        console.log("[2/6] Entering Target API URL...");
        const urlInput = await page.$('input[placeholder*="http"]');
        await urlInput.click({ clickCount: 3 });
        await urlInput.type(TARGET_API_URL);

        // 3. Ask Intelligence
        console.log("[3/6] Asking Intelligence Panel...");
        const promptInput = await page.$('textarea[placeholder*="Ask Gemini"]');
        await promptInput.type("Create a login payload for this endpoint");
        
        const executeBtn = await page.$('button >> text=Execute');
        await executeBtn.click();

        // 4. Wait for AI Response
        console.log("[4/6] Waiting for Gemini Response...");
        await page.waitForSelector('button >> text=Copy to Clipboard', { timeout: 15000 });
        
        // 5. Apply Payload
        console.log("[5/6] Applying Payload...");
        // Click Body Tab
        const bodyTab = await page.$('button >> text=Body');
        await bodyTab.click();
        
        // Click Copy (Simulate action by grabbing text manually since clipboard is tricky in headless)
        const payloadText = await page.$eval('.bg-slate-100 pre, .bg-slate-100 div.font-mono', el => el.innerText);
        
        // Paste into Textarea
        const bodyInput = await page.$('textarea[placeholder="{}"]');
        await bodyInput.click();
        await bodyInput.type(payloadText); // Typing simulated paste

        // 6. Send
        console.log("[6/6] Clicking SEND...");
        const sendBtn = await page.$('button >> text=Send');
        await sendBtn.click();
        
        // Wait a bit for network
        await new Promise(r => setTimeout(r, 5000));

        // Screenshot
        console.log(`📸 Taking Proof Screenshot: ${SCREENSHOT_PATH}`);
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

        console.log("✅ Verification Complete!");

    } catch (e) {
        console.error("❌ Verification Failed:", e);
        await page.screenshot({ path: 'error_state.png' });
    } finally {
        await browser.close();
    }
})();
