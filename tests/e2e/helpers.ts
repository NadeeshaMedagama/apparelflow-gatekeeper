import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const DEMO = {
  supervisor: "supervisor@apparelflow.demo",
  verifier: "verifier@apparelflow.demo",
  sewing: "sewing@apparelflow.demo",
  password: "ApparelFlow@2026",
} as const;

/** Signs in through the real login API; the session cookie is shared with the page. */
export async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/auth/login", { data: { email, password: DEMO.password } });
  expect(response.ok()).toBeTruthy();
}

/** WCAG 2.x A/AA audit (includes colour-contrast). Fails the test on any violation. */
export async function expectAccessible(page: Page, context: string) {
  // Sample final colours, not mid-transition ones (e.g. a button fading from disabled to enabled).
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => !(animation instanceof CSSTransition) || animation.playState !== "running"),
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map((node) => `   - ${node.target.join(" ")} :: ${node.failureSummary?.split("\n").join(" ")}`)
        .join("\n"),
  );
  expect(summary, `Accessibility violations on ${context}`).toEqual([]);
}
