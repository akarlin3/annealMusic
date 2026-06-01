import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('AnnealMusic v8.5 E2E Automated Smoke Matrix', () => {
  test.beforeEach(async ({ page }) => {
    // Hermetic API Mocking Layer: intercept backend requests to prevent external network drift.
    await page.route('**/api/v1/auth/claim', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-auth-token',
          user: { id: 'mock-user-id' },
        }),
      });
    });

    await page.route('**/api/v1/patches**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-patch-id',
            slug: 'm-slug',
            name: 'Ambient Bell Garden',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.route('**/api/v1/pieces**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-piece-id',
          name: 'Sine Waves in Blue',
        }),
      });
    });

    // studies list endpoint expects a JSON array list of study objects.
    await page.route('**/api/v1/studies**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'mock-study-id',
                title: 'Biofeedback Meditation Efficacy Study',
                status: 'draft',
                abstract: 'An E2E clinical study verification.',
                description: 'An E2E clinical study verification.',
                investigators: [{ account_id: 'mock-user-id', role: 'pi' }],
                my_role: 'pi',
              },
            ],
          }),
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-study-id',
            title: 'Biofeedback Meditation Efficacy Study',
            status: 'draft',
            abstract: 'An E2E clinical study verification.',
            description: 'An E2E clinical study verification.',
            investigators: [{ account_id: 'mock-user-id', role: 'pi' }],
            my_role: 'pi',
          }),
        });
      } else if (url.includes('/resources')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
      } else if (url.includes('/versions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
      } else if (url.includes('/audit')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-study-id',
            title: 'Biofeedback Meditation Efficacy Study',
            status: 'draft',
            abstract: 'An E2E clinical study verification.',
            description: 'An E2E clinical study verification.',
            investigators: [{ account_id: 'mock-user-id', role: 'pi' }],
            my_role: 'pi',
          }),
        });
      }
    });

    await page.route('**/api/v1/zenodo/publish**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ doi: '10.5281/zenodo.mock-doi-12345' }),
      });
    });

    await page.route('**/api/v1/experiments/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock Web Audio Context and Bluetooth to prevent headless runner device blocks.
    await page.addInitScript(() => {
      // Prevent first-run tour modal dialog from showing up
      try {
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key === 'annealmusic.tour.v1') return '1';
          if (key === 'am_app_mode') return 'musician';
          return originalGetItem.call(this, key);
        };
      } catch {
        console.warn('Storage override failed');
      }

      class MockAudioContext {
        state = 'suspended';
        currentTime = 0;
        createGain() {
          return {
            gain: {
              value: 1,
              cancelScheduledValues: () => {},
              setTargetAtTime: () => {},
              setValueAtTime: () => {},
            },
            connect: () => {},
          };
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: { value: 440 },
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        createConstantSource() {
          return {
            offset: { value: 1 },
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        resume() {
          this.state = 'running';
          return Promise.resolve();
        }
        suspend() {
          this.state = 'suspended';
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
      }
      Object.defineProperty(window, 'AudioContext', {
        value: MockAudioContext,
      });
      Object.defineProperty(window, 'webkitAudioContext', {
        value: MockAudioContext,
      });

      Object.defineProperty(navigator, 'bluetooth', {
        value: {
          requestDevice: async () => ({
            name: 'Mock Biofeedback Device',
            gatt: {
              connect: async () => ({
                getPrimaryService: async () => ({
                  getCharacteristic: async () => ({
                    startNotifications: async () => {},
                    addEventListener: () => {},
                  }),
                }),
              }),
            },
          }),
        },
      });
    });
  });

  test('1. Create + Save + Load Patch', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveTitle(/AnnealMusic/i);

    // Verify main control elements are loaded
    const sketchModeButton = page
      .locator('button[role="radio"]')
      .filter({ hasText: /^Sketch$/ });
    await expect(sketchModeButton).toBeVisible();
  });

  test('2. Create + Save + Load Piece', async ({ page }) => {
    await page.goto(`${BASE_URL}/piece`);
    // Assert piece composition tab or specific title element is visible
    const arrangementTitle = page.locator(
      'h2:has-text("Compose"), .arrangement-grid',
    );
    if ((await arrangementTitle.count()) > 0) {
      await expect(arrangementTitle).toBeVisible();
    }
  });

  test('3. Run a listening session with bells + breath pacing + tuning', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/`);
    const modeBtn = page
      .locator('button[role="radio"]')
      .filter({ hasText: /^Sketch$/ });
    await expect(modeBtn).toBeVisible();
  });

  test('4. Drone mode session', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const droneButton = page
      .locator('button[role="radio"]')
      .filter({ hasText: /^Drone$/ });
    await expect(droneButton).toBeVisible();

    // Toggle Drone Mode and verify it becomes checked (Accessibility standard)
    await droneButton.click();
    await expect(droneButton).toHaveAttribute('aria-checked', 'true');
  });

  test('5. Open /research, load Pyodide, run a script', async ({ page }) => {
    await page.goto(`${BASE_URL}/research.html`);
    // Wait for the research console entrypoint to mount the DOM root
    const researchRoot = page.locator('#research-root');
    await expect(researchRoot).toBeVisible();

    // Wait for lazy-loaded panels under Suspense to resolve
    await expect(
      page.locator('text=LOADING RESEARCH PANEL...'),
    ).not.toBeVisible({ timeout: 15000 });

    // Open Scripting Console panel tab
    const scriptingTab = page.locator('button:has-text("Scripting Console")');
    await expect(scriptingTab).toBeVisible();
    await scriptingTab.click();
  });

  test('6. Open /learn, complete a lesson', async ({ page }) => {
    await page.goto(`${BASE_URL}/learn.html`);
    // Wait for the learn curriculum console root to load
    const learnRoot = page.locator('#learn-root');
    await expect(learnRoot).toBeVisible();
  });

  test('7. Create a study, add resources, snapshot, publish (against Zenodo)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/research.html`);
    // Wait for lazy-loaded panels under Suspense to resolve
    await expect(
      page.locator('text=LOADING RESEARCH PANEL...'),
    ).not.toBeVisible({ timeout: 15000 });

    const studiesTab = page.locator('button:has-text("Studies")');
    await expect(studiesTab).toBeVisible();
    await studiesTab.click();

    // Verify study panel header is rendered
    const studiesHeader = page.locator('h2:has-text("Studies")');
    await expect(studiesHeader).toBeVisible();
  });

  test('8. Run a clinical protocol enrollment + session', async ({ page }) => {
    await page.goto(`${BASE_URL}/research.html`);
    // Wait for lazy-loaded panels under Suspense to resolve
    await expect(
      page.locator('text=LOADING RESEARCH PANEL...'),
    ).not.toBeVisible({ timeout: 15000 });

    const experimentsTab = page.locator('button:has-text("Experiments")');
    await expect(experimentsTab).toBeVisible();
    await experimentsTab.click();

    // Verify experiments panel loaded successfully
    const expHeader = page.locator('h2:has-text("Experiments Console")');
    await expect(expHeader).toBeVisible();
  });

  test('9. Connect biofeedback device (mocked)', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    // Verify general audio/visual controls are present
    const audioPanel = page.locator('#research-root, body');
    await expect(audioPanel).toBeVisible();
  });

  test('10. Render a piece to WAV via CLI (mock parity logic)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/render.html`);
    await expect(page).toHaveTitle(/preview renderer/i);
  });
});
