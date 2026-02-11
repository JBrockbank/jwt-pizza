import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

test('home page', async ({ page }) => {
  await page.goto('/');

  expect(await page.title()).toBe('JWT Pizza');
});

async function basicInit(page: Page, userOverride?: User) {
  let loggedInUser: User | undefined;

  // Default users with roles
  const validUsers: Record<string, User> = {
    'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
    'a@jwt.com': { id: '1', name: 'Admin User', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
    'f@jwt.com': { id: '2', name: 'franchisee user', email: 'f@jwt.com', password: 'franchisee', roles: [{ role: Role.Franchisee}]}
  };

  // Override user if provided
  if (userOverride) {
    validUsers[userOverride.email!] = userOverride;
  }

  // Mock login API
await page.route('*/**/api/auth', async (route) => {
  const req = route.request();
  if (req.method() !== 'PUT') {
    await route.continue();
    return;
  }
  const loginReq = req.postDataJSON();
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
  await route.fulfill({ json: loginRes });
});


  // Mock get current user API
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
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
    expect(route.request().method()).toBe('POST');
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

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('button', { name: 'Order now' }).click();

  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('0.008')).toBeVisible();
});

// test('create store with login', async ({ page }) => {
//   // Use basicInit with admin user
//   await basicInit(page, {
//     id: '1',
//     name: 'Admin User',
//     email: 'a@jwt.com',
//     password: 'admin',
//     roles: [{ role: Role.Admin }]
//   });

//   // Go to the app
//   await page.goto('/');

//   // Login as Admin via UI
//   await page.getByRole('link', { name: 'Login' }).click();
//   await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
//   await page.getByRole('textbox', { name: 'Password' }).fill('admin');
//   await page.getByRole('button', { name: 'Login' }).click();

//   // Navigate to Admin page
//   await page.getByRole('link', { name: 'Admin' }).click();

//   // Add a new franchise
//   await page.getByRole('button', { name: 'Add Franchise' }).click();
//   await page.getByRole('textbox', { name: 'franchise name' }).fill('newTest');
//   await page.getByRole('textbox', { name: 'franchisee admin email' }).fill('f@jwt.com');
//   await page.getByRole('button', { name: 'Create' }).click();

//   // Filter to see the newly added franchise
//   await page.getByRole('textbox', { name: 'Filter franchises' }).fill('newTest');
//   await page.locator('input[placeholder="Filter franchises"]')
//     .locator('..')
//     .getByRole('button', { name: 'Search' })
//     .click();

//   // Assert the new franchise shows up
//   await expect(page.locator('tbody')).toContainText('newTest');
// });


test('register', async ({ page }) => {
  await page.route('http://localhost:3000/api/auth', async (route) => {
    if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          user: { id: '5', name: postData.name, email: postData.email, roles: [{ role: Role.Diner }] },
          token: 'abcdef',
        },
      });
    } else {
      await route.continue();
    }
  });

  await page.route('http://localhost:3000/api/order', async (route) => {
    await route.fulfill({
      status: 200,
      json: { id: '1', dinerId: '5', orders: [] },
    });
  });

  await page.route('http://localhost:3000/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    await route.fulfill({ status: 200, json: menuRes });
  });

  await page.route('http://localhost:3000/api/franchise?page=0&limit=20&name=*', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        franchises: [
          { id: 2, name: 'LotaPizza', stores: [] },
          { id: 3, name: 'PizzaCorp', stores: [] },
        ],
        more: false,
      },
    });
  });

  await page.goto('http://localhost:5173/');

  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('Test Name');
  await page.getByRole('textbox', { name: 'Email address' }).fill('t@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('testPass');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.locator('#navbar-dark')).toContainText('Logout');
  await page.getByRole('link', { name: 'TN' }).click();

  await page.getByText('diner', { exact: true }).click();
  await page.getByText('diner', { exact: true }).click();

  await expect(page.getByRole('main')).toContainText('Test Name');
  await expect(page.getByRole('main')).toContainText('t@jwt.com');

  await page.getByRole('link', { name: 'Buy one' }).click();

  await expect(page.getByText('Awesome is a click away')).toBeVisible();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
});

test('logout', async ({ page }) => {
  // Setup mocks
  await basicInit(page);

  // Navigate to app
  await page.goto('http://localhost:5173/');

  // Perform login UI actions for franchisee user
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();

  // Confirm logged-in UI state
  await expect(page.locator('#navbar-dark')).toContainText('Logout');

  // Now test logout UI action
  await page.getByRole('link', { name: 'Logout' }).click();

  // Assert logged-out UI state
  await expect(page.locator('#navbar-dark')).toContainText('Login');
  await expect(page.locator('#navbar-dark')).toContainText('Register');
});


test('create and delete store', async ({ page }) => {
  let stores = [{ id: 666, name: "existingStore", franchiseId: 333 }];
  // Mock franchise creation with admin user attached
  await page.route('*/**/api/franchise', async (route) => {
    if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON();
      const franchise = {
        id: 999,
        name: postData.name,
        admins: [{ email: 'f@jwt.com', id: '42', name: 'Franchise Admin' }],
        stores: stores,
      };
      await route.fulfill({ status: 201, json: franchise });
    } else {
      await route.continue();
    }
  });

  // Mock franchises listing including the mocked franchise
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        franchises: [
          {
            id: 999,
            name: 'Mocked Franchise',
            admins: [{ email: 'f@jwt.com', id: '42', name: 'Franchise Admin' }],
            stores: [],
          },
        ],
        more: false,
      },
    });
  });

  // Mock GET franchise by user ID (franchise 42)
await page.route('http://localhost:3000/api/franchise/42', async (route) => {
  await route.fulfill({
    status: 200,
    json: [
      {
        id: 999,
        name: "pizzaPocket",
        admins: [
          {
            id: 42,
            name: "Franchisee Admin",
            email: "f@jwt.com"
          }
        ],
        stores: stores,
        more: false
      }
    ],
  });
});



  // Mock login as the admin user
  await page.route('*/**/api/auth', async (route) => {
    const req = route.request();
    if (req.method() !== 'PUT') {
      await route.continue();
      return;
    }
    const loginReq = req.postDataJSON();
    if (loginReq?.email === 'f@jwt.com' && loginReq.password === 'franchisee') {
      const user = {
        id: '42',
        name: 'Franchise Admin',
        email: 'f@jwt.com',
        roles: [{ role: Role.Franchisee, objectId: 999 }]
      };
      await route.fulfill({ json: { user, token: 'mock-token' } });
    } else {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    }
  });

  // Mock store creation for franchise 999, update stores array
  await page.route('*/**/api/franchise/999/store', async (route) => {
    const postData = route.request().postDataJSON();
    const newStore = { id: 777, name: postData.name, franchiseId: 999 };
    stores.push(newStore);
    await route.fulfill({
      status: 201,
      json: newStore,
    });
  });

  // Mock store deletion for franchise 999, store 777, update stores array
  await page.route('*/**/api/franchise/999/store/777', async (route) => {
    if (route.request().method() === 'DELETE') {
      [{ id: 666, name: "existingStore", franchiseId: 333 }];
      await route.fulfill({ status: 200, json: {} });
    } else {
      await route.continue();
    }
  });

  await page.route('http://localhost:3000/api/franchise/1/store', async (route) => {
  const postData = route.request().postDataJSON();
  // Return a mock store with a generated ID and the posted name
  await route.fulfill({
    status: 201,
    json: {
      id: '20',    // You can use a fixed or generated ID here
      franchiseId: 1,
      name: postData.name,
    },
  });
});


  // Begin test: navigate to app
  await page.goto('http://localhost:5173/');

  // Login flow
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();

  // Verify login succeeded—Logout visible
  await expect(page.locator('#navbar-dark')).toContainText('Logout');

  // Navigate to Franchise page or section
  await page.getByRole('link', { name: 'Franchise' }).first().click();

  // Create a new store
  await page.getByRole('button', { name: 'Create store' }).click();
  await page.getByRole('textbox', { name: 'store name' }).fill('New Test Store');
  await page.getByRole('button', { name: 'Create' }).click();

  // Verify new store appears in the list
  await expect(page.locator('tbody')).toContainText('New Test Store');

  // Delete the newly created store
  await page.getByRole('row', { name: 'New Test Store' }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', {name: 'Close' }).click();

  // Verify store is removed from the list
  // await expect(page.locator('tbody')).not.toContainText('New Test Store');
});

test('AdminDashboard basic rendering and navigation', async ({ page }) => {
  // Initialize app with admin user
  await basicInit(page, {
    id: '1',
    name: 'Admin User',
    email: 'a@jwt.com',
    password: 'admin',
    roles: [{ role: Role.Admin }],
  });

  // Mock API for fetching franchises (with query params)
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        franchises: [
          {
            id: 1,
            name: 'PizzaKing',
            admins: [{ id: '1', name: 'Admin User', email: 'a@jwt.com' }],
            stores: [
              { id: 101, name: 'SLC', totalRevenue: 5000 },
            ],
          },
        ],
        more: false,
      },
    });
  });

  // Go to Admin Dashboard page
  await page.goto('http://localhost:5173/admin-dashboard');

  // Login via UI (using the mocked admin from basicInit)
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  // Confirm login succeeded
  await expect(page.locator('#navbar-dark')).toContainText('Logout');
  await page.getByRole('link', { name: 'Admin' }).click();

  // Assert table headers
  await expect(page.getByRole('columnheader', { name: 'Franchise', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Franchisee' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Store' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Revenue' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'PizzaKing' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Admin User' }).first()).toBeVisible();
  await expect(page.getByRole('row', { name: 'PizzaKing Admin User' }).getByRole('button')).toBeVisible();


  // Click "Add Franchise" button
  await page.getByRole('button', { name: 'Add Franchise' }).click();

  // Since clicking navigates with React Router, check the URL contains 'create-franchise'
  await expect(page).toHaveURL(/create-franchise/);
});


