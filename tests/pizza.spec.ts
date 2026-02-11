import { Page, expect } from '@playwright/test';
import { test } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

/* ------------------------ */
/* Shared Mock Setup        */
/* ------------------------ */

async function basicInit(page: Page, userOverride?: User) {
  let loggedInUser: User | undefined;

  const users: Record<string, User> = {
    'd@jwt.com': {
      id: '3',
      name: 'Kai Chen',
      email: 'd@jwt.com',
      password: 'a',
      roles: [{ role: Role.Diner }],
    },
    'a@jwt.com': {
      id: '1',
      name: 'Admin User',
      email: 'a@jwt.com',
      password: 'admin',
      roles: [{ role: Role.Admin }],
    },
    'f@jwt.com': {
      id: '42',
      name: 'Franchise Admin',
      email: 'f@jwt.com',
      password: 'franchisee',
      roles: [{ role: Role.Franchisee, objectId: '999' }],
    },
  };

  if (userOverride) {
    users[userOverride.email!] = userOverride;
  }

  /* ---------- AUTH ---------- */
  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();

    const { email, password } = route.request().postDataJSON();
    const user = users[email];

    if (!user || user.password !== password) {
      return route.fulfill({ status: 401 });
    }

    loggedInUser = user;
    await route.fulfill({ json: { user, token: 'mock-token' } });
  });

  /* ---------- CURRENT USER ---------- */
  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  /* ---------- MENU (FIXES COMBOBOX) ---------- */
  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({
      json: [
        { id: 1, title: 'Veggie', price: 0.0038 },
        { id: 2, title: 'Pepperoni', price: 0.0042 },
      ],
    });
  });

  /* ---------- FRANCHISE LIST ---------- */
  /* ---------- FRANCHISE LIST (Dynamic POST + GET) ---------- */
let franchises = [
  { id: 18, name: 'Existing Franchise', stores: [] },
];

await page.route('*/**/api/franchise', async (route) => {
  const method = route.request().method();
  const postData = route.request().postDataJSON();

  if (method === 'POST') {
    const newFranchise = { id: Date.now(), name: postData.name, stores: [] };
    franchises.push(newFranchise);

    // Fulfill POST with new franchise
    await route.fulfill({ status: 201, json: newFranchise });
    return;
  }

  // GET: return updated list
  await route.fulfill({ status: 200, json: { franchises, more: false } });
});


  /* ---------- ORDER ---------- */
  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      json: { order: { id: 23 }, jwt: 'fake-jwt' },
    });
  });

  /* ---------- STORE CREATE ---------- */
  await page.route('*/**/api/franchise/999/store', async (route) => {
    await route.fulfill({
      status: 201,
      json: { id: 777, name: route.request().postDataJSON().name },
    });
  });

  await page.goto('/');
}

/* ------------------------ */
/* Tests                    */
/* ------------------------ */

test('home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('JWT Pizza');
});

test('login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Email address').fill('d@jwt.com');
  await page.getByLabel('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

// test('purchase with login', async ({ page }) => {
//   await basicInit(page);

//   await page.getByRole('button', { name: 'Order now' }).click();

//   const storeSelect = page.getByRole('combobox');
//   await expect(storeSelect).toHaveCount(1);

//   await storeSelect.selectOption({ label: 'Lehi' });

//   await page.getByText('Veggie').click();
//   await page.getByText('Pepperoni').click();
//   await page.getByRole('button', { name: 'Checkout' }).click();

//   await page.getByLabel('Email address').fill('d@jwt.com');
//   await page.getByLabel('Password').fill('a');
//   await page.getByRole('button', { name: 'Login' }).click();

//   await expect(page.getByText('Veggie')).toBeVisible();
//   await expect(page.getByText('Pepperoni')).toBeVisible();

//   await page.getByRole('button', { name: 'Pay now' }).click();
//   await expect(page.getByText('₿')).toBeVisible();
// });

// test('admin creates franchise', async ({ page }) => {
//   await basicInit(page);

//   await page.getByRole('link', { name: 'Login' }).click();
//   await page.getByLabel('Email address').fill('a@jwt.com');
//   await page.getByLabel('Password').fill('admin');
//   await page.getByRole('button', { name: 'Login' }).click();

//   await page.getByRole('link', { name: 'Admin' }).click();
//   await page.getByRole('button', { name: 'Add Franchise' }).click();

//   await page.getByPlaceholder('franchise name').fill('newTest');
//   await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');
//   await page.getByRole('button', { name: 'Create' }).click();

//   // Wait for the GET request to update UI
//   await page.waitForResponse(resp =>
//     resp.url().includes('/api/franchise') && resp.status() === 200
//   );

//   await expect(page.getByText('newTest')).toBeVisible();
// });




test('logout', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Email address').fill('f@jwt.com');
  await page.getByLabel('Password').fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Logout')).toBeVisible();
  await page.getByText('Logout').click();

  await expect(page.getByText('Login')).toBeVisible();
  await expect(page.getByText('Register')).toBeVisible();
});
