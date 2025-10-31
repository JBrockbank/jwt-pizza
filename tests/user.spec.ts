import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { Role } from "../src/service/pizzaService";

async function mockUserUpdateApis(page: Page, initialUser: any) {
  let currentUser = { ...initialUser };

  await page.route("*/**/api/auth", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const postData = req.postDataJSON();
      currentUser = {
        id: `${Math.floor(Math.random() * 10000)}`,
        name: postData.name,
        email: postData.email,
        password: postData.password,
        roles: [{ role: Role.Diner }],
      };
      await route.fulfill({
        status: 200,
        json: { user: currentUser, token: "fake-token" },
      });
    } else if (req.method() === "PUT") {
      const loginReq = req.postDataJSON();
      if (
        loginReq.email === currentUser.email &&
        loginReq.password === currentUser.password
      ) {
        await route.fulfill({
          status: 200,
          json: { user: currentUser, token: "fake-token" },
        });
      } else {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      }
    } else {
      await route.continue();
    }
  });

  await page.route("*/**/api/user/me", async (route) => {
    await route.fulfill({ json: currentUser });
  });

  await page.route(/\/api\/user\/\d+/, async (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      const updateData = req.postDataJSON();
      currentUser = {
        ...currentUser,
        ...updateData,
        password: currentUser.password,
      };
      await route.fulfill({
        status: 200,
        json: { user: currentUser, token: "fake-token" },
      });
    } else {
      await route.continue();
    }
  });

  await page.route("*/**/api/auth", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });
}

test("update user name", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await mockUserUpdateApis(page, {
    id: "1001",
    name: "pizza diner",
    email,
    password: "diner",
    roles: [{ role: Role.Diner }],
  });
  await page.goto("/");
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

  // await page.getByRole("link", { name: "Logout" }).click();
  // await page.getByRole("link", { name: "Login" }).click();

  // await page.getByRole("textbox", { name: "Email address" }).fill(email);
  // await page.getByRole("textbox", { name: "Password" }).fill("diner");
  // await page.getByRole("button", { name: "Login" }).click();

  // await page.getByRole("link", { name: "pd" }).click();

  // await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

test("update user email address", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await mockUserUpdateApis(page, {
    id: "1001",
    name: "pizza diner",
    email,
    password: "diner",
    roles: [{ role: Role.Diner }],
  });
  const newEmail = `updated${Math.floor(Math.random() * 10000)}@jwt.com`;

  await page.goto("/");
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

  // Confirm login works with new email
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(newEmail);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();
  // await page.getByRole("link", { name: "pd" }).click();

  // await expect(page.getByRole("main")).toContainText(newEmail);
});
