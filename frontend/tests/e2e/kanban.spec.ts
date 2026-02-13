import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Note: these are end-to-end tests that assume both frontend (Vite dev server)
// and backend (Socket.IO server) are running locally. The Playwright config
// is set to `reuseExistingServer: true` and `baseURL: http://localhost:5173`.

// Helper: find task card by text (use .filter + .first() to avoid strict-mode collisions)
const taskCardLocator = (page: Page, title: string) =>
  page.locator('[data-testid^="task-"]').filter({ hasText: title }).first();

// Helper: create a task via the form and wait for the server-driven sync
const createTask = async (page: Page, title: string) => {
  await page.fill('[data-testid=title-input]', title);
  await page.fill('[data-testid=description-input]', `${title} description`);

  await page.click('[data-testid=priority-select]');
  const priorityInput = page.locator('[data-testid=priority-select] input');
  await priorityInput.fill('High');
  await priorityInput.press('Enter');

  await page.click('[data-testid=category-select]');
  const categoryInput = page.locator('[data-testid=category-select] input');
  await categoryInput.fill('Feature');
  await categoryInput.press('Enter');

  // Small deterministic image
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  await page.setInputFiles('[data-testid=file-input]', [
    { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(pngBase64, 'base64') },
  ]);

  await page.click('[data-testid=create-button]');

  // Wait for the created task to appear in any column
  const created = page.locator('[data-testid^="task-"]').filter({ hasText: title }).first();
  await expect(created).toBeVisible({ timeout: 7000 });
  return created;
};

test.describe('Kanban E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
      // Wait for the client socket to be connected before interacting with the page.
      // This prevents race conditions where tests create tasks before the socket is ready
      // and the server-driven broadcasts are missed.
      await page.waitForFunction(() => (window as any).__socketConnected === true, null, { timeout: 5000 });
  });

  test('Create Task', async ({ page }) => {
    const name = `E2E Task ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // createTask handles filling, upload and waits for server sync
    const created = await createTask(page, name);

    // Verify it appears in the To Do column specifically
    const todoTask = page.locator('[data-testid=todo-column]').locator(`text=${name}`).first();
    await expect(todoTask).toBeVisible({ timeout: 7000 });
  });

  test('Drag and Drop', async ({ page }) => {
    const name = `E2E Drag ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await createTask(page, name);

    // Drag to In Progress column using real drag events
    await created.dragTo(page.locator('[data-testid=inprogress-column]'));

    // Assert it appears in In Progress
    const inprogress = page.locator('[data-testid=inprogress-column]').locator(`text=${name}`).first();
    await expect(inprogress).toBeVisible({ timeout: 7000 });

    await expect(page.locator('[data-testid=progress-chart]')).toBeVisible();
    const inProgressCount = await page.locator('[data-testid=inprogress-column] [data-testid^="task-"]').count();
    expect(inProgressCount).toBeGreaterThanOrEqual(1);
  });

  test('Delete Task', async ({ page }) => {
    const name = `E2E Delete ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await createTask(page, name);

    // Click its delete button and wait for removal (server-driven)
    await created.locator('button[aria-label="Delete task"]').first().click();

    // Ensure the task is removed from UI
    await expect(page.locator(`[data-testid^="task-"]`).filter({ hasText: name })).toHaveCount(0, { timeout: 7000 });
  });

  test('Dropdown Select (edit task)', async ({ page }) => {
    const name = `EditTask ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await createTask(page, name);

    // read its data-testid attribute to get the generated id (task-<id>)
    const attr = await created.getAttribute('data-testid');
    if (!attr) throw new Error('Task data-testid missing');
    const id = attr.replace('task-', '');

    // Change priority and category on the card (inline selects)
    await page.click(`[data-testid=priority-select-${id}]`);
    const cardP = page.locator(`[data-testid=priority-select-${id}] input`);
    await cardP.fill('High');
    await cardP.press('Enter');

    await page.click(`[data-testid=category-select-${id}]`);
    const cardC = page.locator(`[data-testid=category-select-${id}] input`);
    await cardC.fill('Enhancement');
    await cardC.press('Enter');

    // Wait for socket-driven update (the select should now show chosen values)
    await expect(page.locator(`[data-testid=priority-select-${id}]`).getByText('High', { exact: true }).first()).toBeVisible({ timeout: 7000 });
    await expect(page.locator(`[data-testid=category-select-${id}]`).getByText('Enhancement', { exact: true }).first()).toBeVisible({ timeout: 7000 });
  });

  test('File Upload validation', async ({ page }) => {
    // Test invalid file type
    const invalidPath = path.join('tests', 'e2e', 'fixtures', 'sample.txt');
    await page.setInputFiles('[data-testid=file-input]', invalidPath);
    await expect(page.locator('[data-testid=file-error]')).toBeVisible();

    // Test valid file again using inline buffer
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    await page.setInputFiles('[data-testid=file-input]', [
      { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(pngBase64, 'base64') },
    ]);
    await expect(page.locator('img[data-testid="create-preview-img"][alt="sample.png"]')).toBeVisible();
  });
});
