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

  if (userOverride) {
    validUsers[userOverride.email!] = userOverride;
  }

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

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

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

  await page.route('**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

await page.route('**/api/user/*', async (route) => {
  const method = route.request().method();
  if (method === 'PUT') {
    const updatedUser = await route.request().postDataJSON();
    const oldEmail = loggedInUser?.email ?? updatedUser.email;

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

  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

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

  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    await route.fulfill({ json: orderRes });
  });

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

  // await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

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

test('AdminDashboard user search functionality', async ({ page }) => {
  // Initialize with admin user
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  // Mock users API to return multiple users initially
  let userSearchQuery = '*'; // Track what filter is applied
  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    const url = route.request().url();
    const params = new URLSearchParams(url.split('?')[1]);
    userSearchQuery = params.get('name') || '*';

    let users: { id: string; name: string; email: string; roles: { role: Role; }[]; }[];
    if (userSearchQuery === '*' || userSearchQuery.includes('admin')) {
      // All users or admin filter - return both
      users = [
        {
          id: '1',
          name: 'Admin User',
          email: 'a@jwt.com',
          roles: [{ role: Role.Admin }],
        },
        {
          id: '2',
          name: 'Diner Customer',
          email: 'diner@example.com',
          roles: [{ role: Role.Diner }],
        },
      ];
    } else if (userSearchQuery.includes('diner')) {
      // Diner filter - return only diner
      users = [
        {
          id: '2',
          name: 'Diner Customer',
          email: 'diner@example.com',
          roles: [{ role: Role.Diner }],
        },
      ];
    } else {
      // No matches
      users = [];
    }

    await route.fulfill({
      status: 200,
      json: { users, more: false },
    });
  });

  // Mock franchises (minimal - we don't test them here)
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: { franchises: [], more: false },
    });
  });

  // Login as admin
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.locator('#navbar-dark')).toContainText('Logout');
  await page.getByRole('link', { name: 'Admin' }).click();

  // Verify initial load shows both users
  await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Diner Customer' })).toBeVisible();

  // Test user search - filter for "diner"
  const usersSection = page.getByRole('heading', { name: 'Users' }).locator('xpath=following::table[1]');
  await usersSection.getByPlaceholder('Filter users').fill('diner');
  await usersSection.getByRole('button', { name: 'Search' }).click();

  // Should now only show diner user
  await expect(usersSection.getByRole('cell', { name: 'Diner Customer' })).toBeVisible();
  await expect(usersSection.getByRole('cell', { name: 'Admin User' })).not.toBeVisible();
  await expect(usersSection.getByRole('cell', { name: 'diner', exact: true })).toBeVisible();

  // Test clear filter - search empty string
  await usersSection.getByPlaceholder('Filter users').fill('');
  await usersSection.getByRole('button', { name: 'Search' }).click();

  // Should show all users again
  await expect(usersSection.getByRole('cell', { name: 'Admin User' })).toBeVisible();
  await expect(usersSection.getByRole('cell', { name: 'Diner Customer' })).toBeVisible();

  // Test page reset on filter (should be on page 0)
  await usersSection.getByPlaceholder('Filter users').fill('admin');
  await usersSection.getByRole('button', { name: 'Search' }).click();
  
  // Previous button should be disabled (page 0)
  await expect(usersSection.getByRole('button', { name: '«' })).toBeDisabled();
});

test('AdminDashboard delete user confirmation', async ({ page }) => {
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        users: [
          {
            id: '2',
            name: 'Test Diner',
            email: 'test-diner@example.com',
            roles: [{ role: Role.Diner }],
          },
        ],
        more: false,
      },
    });
  });

  await page.route(/\/api\/user\/2/, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ status: 200 });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: { franchises: [], more: false },
    });
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.locator('#navbar-dark')).toContainText('Logout');
  await page.getByRole('link', { name: 'Admin' }).click();

  const usersSection = page.getByRole('heading', { name: 'Users' }).locator('xpath=following::table[1]');
  const deleteButton = usersSection
    .getByRole('button', { name: 'Delete' })

  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).not.toBeDisabled();

  await deleteButton.click();

  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Are you sure you want to delete this user?');
    await dialog.accept();
  });

});


test('AdminDashboard blocks non-admin users', async ({ page }) => {
  await basicInit(page, {
    id: '3',
    name: 'Regular Diner',
    email: 'd@jwt.com',
    password: 'a',
    roles: [{ role: Role.Diner }],
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('http://localhost:5173/admin-dashboard');

  // ✅ Assert NotFound content
  await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
  await expect(
    page.getByText(
      'It looks like we have dropped a pizza on the floor. Please try another page.'
    )
  ).toBeVisible();
});


test('Admin cannot delete themselves', async ({ page }) => {
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        users: [
          {
            id: '1',
            name: 'Admin User',
            email: 'a@jwt.com',
            roles: [{ role: Role.Admin }],
          },
        ],
        more: false,
      },
    });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: { franchises: [], more: false },
    });
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Admin' }).click();

  const deleteButton = page.getByRole('button', { name: 'Delete' });

  await expect(deleteButton).toBeDisabled();
});


test('AdminDashboard franchise filter works', async ({ page }) => {
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: { users: [], more: false },
    });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const url = route.request().url();
    const params = new URLSearchParams(url.split('?')[1]);
    const filter = params.get('name') || '*';

    let franchises = [];

    if (filter.includes('PizzaCorp')) {
      franchises = [
        {
          id: 3,
          name: 'PizzaCorp',
          admins: [{ name: 'Owner A' }],
          stores: [],
        },
      ];
    } else {
      franchises = [
        {
          id: 2,
          name: 'LotaPizza',
          admins: [{ name: 'Owner B' }],
          stores: [],
        },
      ];
    }

    await route.fulfill({
      status: 200,
      json: { franchises, more: false },
    });
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Admin' }).click();

  const franchiseSection = page.getByRole('heading', { name: 'Franchises' })
    .locator('xpath=following::table[1]');

  await franchiseSection.getByPlaceholder('Filter franchises').fill('PizzaCorp');
  await franchiseSection.getByRole('button', { name: 'Search' }).click();

  await expect(franchiseSection.getByText('PizzaCorp')).toBeVisible();
});


test('AdminDashboard franchise pagination next button', async ({ page }) => {
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  let pageIndex = 0;

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    pageIndex++;
    await route.fulfill({
      status: 200,
      json: {
        franchises: [
          {
            id: pageIndex,
            name: `Franchise ${pageIndex}`,
            admins: [{ name: 'Owner' }],
            stores: [],
          },
        ],
        more: pageIndex === 1, // only first page has more
      },
    });
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: { users: [], more: false },
    });
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Admin' }).click();

  const nextButton = page.getByRole('button', { name: '»' }).last();

  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(page.getByText('Franchise 2')).toBeVisible();
});


test('AdminDashboard Add Franchise button navigates', async ({ page }) => {
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, json: { users: [], more: false } });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, json: { franchises: [], more: false } });
  });

  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Admin' }).click();

  await page.getByRole('button', { name: 'Add Franchise' }).click();

  await expect(page).toHaveURL(/create-franchise/);
});