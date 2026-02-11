import { test, expect } from "playwright-test-coverage";
import { Page } from '@playwright/test';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page, userOverride?: User) {
  let loggedInUser: User | undefined;

  const validUsers: Record<string, User> = {
    'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
    'a@jwt.com': { id: '1', name: 'Admin User', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
    'f@jwt.com': { id: '2', name: 'franchisee user', email: 'f@jwt.com', password: 'franchisee', roles: [{ role: Role.Franchisee }] }
  };

  // Override user if provided
  if (userOverride) {
    validUsers[userOverride.email!] = userOverride;
  }

  // Mock login API
  await page.route('**/api/auth', async (route) => {
  const method = route.request().method();
  if (method === 'DELETE') {
    loggedInUser = undefined;
    await route.fulfill({ status: 200, json: { success: true } });
    return;
  }
  if (method !== 'POST' && method !== 'PUT') {
    await route.continue();
    return;
  }
  const loginReq = await route.request().postDataJSON();
  if (!loginReq || !loginReq.email) {
    await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    return;
  }
  const user = validUsers[loginReq.email];
  if (!user || user.password !== loginReq.password) {
    await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    return;
  }
  loggedInUser = user;
  const loginRes = { user: loggedInUser, token: 'abcdef' };
  await route.fulfill({ status: 200, json: loginRes });
});

  // Mock get current user API
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // Mock login, register, and logout
  await page.route('**/api/auth', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ status: 200, json: { success: true } });
      return;
    }
    if (method !== 'POST' && method !== 'PUT') {
      await route.continue();
      return;
    }
    const loginReq = await route.request().postDataJSON();
    if (!loginReq || !loginReq.email) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = user;
    const loginRes = { user: loggedInUser, token: 'abcdef' };
    await route.fulfill({ status: 200, json: loginRes });
  });

  // Mock get current user API
  await page.route('**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

await page.route('http://localhost:3000/api/user/1001', async (route) => {
  const method = route.request().method();
  if (method === 'PUT') {
    const updatedUser = await route.request().postDataJSON();
    const oldEmail = loggedInUser?.email ?? updatedUser.email;

    // Ensure password is persisted if not present in update (common for profile UIs)
    const curUser = loggedInUser || validUsers[oldEmail] || {};
    const mergedUser = { ...curUser, ...updatedUser };

    if (loggedInUser && loggedInUser.id === '1001') {
      Object.assign(loggedInUser, mergedUser);
    }

    if (oldEmail !== mergedUser.email && validUsers[oldEmail]) {
      delete validUsers[oldEmail];
    }
    validUsers[mergedUser.email] = mergedUser;

    await route.fulfill({
      status: 200,
      json: { user: mergedUser, token: 'abcdef' }
    });
    return;
  }
  await route.continue();
});

  // Mock menu API
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Mock franchises API
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 2,
          name: 'LotaPizza',
          stores: [
            { id: 4, name: 'Lehi' },
            { id: 5, name: 'Springville' },
            { id: 6, name: 'American Fork' },
          ],
        },
        { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
        { id: 4, name: 'topSpot', stores: [] },
      ],
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

  // Mock order API
  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    await route.fulfill({ json: orderRes });
  });

  // Mock create store API for admin test
  await page.route('*/**/api/franchise/2/store', async (route) => {
    const req = route.request();
    expect(req.method()).toBe('POST');
    const postData = route.request().postDataJSON();
    expect(postData.name).toBeTruthy(); // Ensure store name present
    await route.fulfill({ json: { id: '123', name: postData.name } });
  });

  await page.goto('/');
}


test("update user name", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const user: User = {
    id: "1001",
    name: "pizza diner",
    email,
    password: "diner",
    roles: [{ role: Role.Diner }],
  };
  await basicInit(page, user);

  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

test("update user email address", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const user: User = {
    id: "1001",
    name: "pizza diner",
    email,
    password: "diner",
    roles: [{ role: Role.Diner }],
  };
  await basicInit(page, user);
  const newEmail = `updated${Math.floor(Math.random() * 10000)}@jwt.com`;

  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator('input[type="email"]').fill(newEmail);
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await page.getByRole("link", { name: "Logout" }).click();


  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(newEmail);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "pd" }).click();
  await expect(page.getByRole("main")).toContainText(newEmail);
});

