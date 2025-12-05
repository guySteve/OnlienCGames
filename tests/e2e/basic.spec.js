const { test, expect } = require('@playwright/test');

test.describe('VegasCore Basic Functionality', () => {
  
  test('should load the homepage and show correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Moe's Card Room/i);
  });

  test('should have login button', async ({ page }) => {
    await page.goto('/');
    // On welcome page (unauthenticated), the button says "ENTER THE ROOM"
    const loginBtn = page.getByRole('link', { name: 'ENTER THE ROOM' });
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toHaveAttribute('href', '/auth/google');
  });

  test('should serve static assets', async ({ page }) => {
    const response = await page.request.get('/styles.css');
    expect(response.ok()).toBeTruthy();
  });

});
