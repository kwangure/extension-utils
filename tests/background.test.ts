import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
import path from "path";

// User temporary directory for user data
const userDataDir = "";
const extensionPath = path.join(__dirname, "./fixtures/extension");

console.log({ extensionPath });

describe("basic", async () => {
    let browserContext: BrowserContext;
    let page: Page;

    beforeAll(async () => {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`
            ],
        });
        page = await browserContext.newPage();
    });

    afterAll(async () => {
        await browserContext.close();
    });

    test("should have the correct title?", async () => {
        try {
            const backgroundPage = browserContext;

            console.log({ backgroundPage });
        } catch (e) {
            console.error(e);
            expect(e).toBeUndefined();
        }
    }, 60_000_000);
})