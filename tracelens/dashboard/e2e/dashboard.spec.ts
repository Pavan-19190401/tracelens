import { test, expect } from "@playwright/test";

test.describe("TraceLens Observability Dashboard E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Set mock or stored token in localStorage to simulate authenticated session
    await page.addInitScript(() => {
      localStorage.setItem("tracelens_token", "mock_e2e_jwt_token");
      localStorage.setItem("tracelens_active_project", "proj_demo_seeded_001");
    });
  });

  test("1. Authentication - Login flow renders and handles submissions", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Sign in to TraceLens");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Fill in credentials
    await page.locator('input[type="email"]').fill("developer@example.com");
    await page.locator('input[type="password"]').fill("ValidPassword123!");
    await page.locator('button[type="submit"]').click();
  });

  test("2. Overview - KPI cards, charts and project switcher render", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Observability Overview");
    await expect(page.locator("text=Total Traces")).toBeVisible();
    await expect(page.locator("text=Error Rate")).toBeVisible();
    await expect(page.locator("text=p95 Latency")).toBeVisible();
    await expect(page.locator("text=Estimated Cost")).toBeVisible();
  });

  test("3. Traces Explorer - Search, model/status filters and table list render", async ({ page }) => {
    await page.goto("/traces");
    await expect(page.locator("h1")).toContainText("Traces Explorer");
    await expect(page.locator('input[placeholder*="Search traces"]')).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible(); // Status filter
    await expect(page.locator("table")).toBeVisible();
  });

  test("4. Trace Detail View - Span tree, waterfall timeline and I/O inspect render", async ({ page }) => {
    await page.goto("/traces/mock_trace_id_101");
    await expect(page.locator("h1")).toContainText("Trace");
    await expect(page.locator("text=Waterfall Timeline")).toBeVisible();
    await expect(page.locator("text=Span Tree Hierarchy")).toBeVisible();
    await expect(page.locator("text=Input / Output")).toBeVisible();
  });

  test("5. Prompt Versioning - Versions list and side-by-side diff view", async ({ page }) => {
    await page.goto("/prompts");
    await expect(page.locator("h1")).toContainText("Prompt Management");
    await expect(page.locator("text=Side-by-Side Version Diff")).toBeVisible();
  });

  test("6. Evaluations & Benchmark - Runs and side-by-side win/loss comparison", async ({ page }) => {
    await page.goto("/evals");
    await expect(page.locator("h1")).toContainText("LLM Evaluations");
    await expect(page.locator("text=Side-by-Side Win/Loss Comparison")).toBeVisible();
    await expect(page.locator("button:has-text('New Evaluation Run')")).toBeVisible();
  });

  test("7. Alerts - Rules configuration and incident events timeline", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.locator("h1")).toContainText("Alert Rules");
    await expect(page.locator("text=Active Rules")).toBeVisible();
    await expect(page.locator("text=Recent Alert Events Log")).toBeVisible();
  });

  test("8. Projects & API Keys - Key generation modal and management", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("h1")).toContainText("Projects & Ingestion API Keys");
    await expect(page.locator("text=Active Project")).toBeVisible();
    await expect(page.locator("button:has-text('Create API Key')")).toBeVisible();
  });
});
