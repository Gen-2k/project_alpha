import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runExtract } from "../commands/extract.js";
import { runValidate } from "../commands/validate.js";

describe("CLI End-to-End Integration Flow", () => {
  let fixtureDir: string;
  let localesDir: string;

  beforeEach(async () => {
    fixtureDir = join(tmpdir(), `giltflow-e2e-${String(Date.now())}`);
    localesDir = join(fixtureDir, "locales");
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(localesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it("should scan, rewrite code, generate en.json, and validate target translations", async () => {
    const componentPath = join(fixtureDir, "CheckoutCard.tsx");
    const rawComponent = `
"use client";
import React from "react";

export function CheckoutCard({ user, total }: Props) {
  return (
    <div className="card">
      <h2>{\`Order Summary for \${user.name}\`}</h2>
      <p>Please review your order details before submitting.</p>
      <input type="text" placeholder="Enter coupon code" />
      <button>Complete Order</button>
    </div>
  );
}
    `.trim();

    await writeFile(componentPath, rawComponent, "utf-8");

    // 1. Run extraction
    await runExtract({ path: fixtureDir, localesDir });

    // 2. Verify component was rewritten
    const rewrittenComponent = await readFile(componentPath, "utf-8");
    expect(rewrittenComponent).toContain('import { useTranslations } from "next-intl";');
    expect(rewrittenComponent).toContain("const t = useTranslations();");
    expect(rewrittenComponent).toContain('placeholder={t("checkout_card.enter_coupon_code")}');

    // 3. Verify en.json was generated
    const enCatalogPath = join(localesDir, "en.json");
    const enCatalogRaw = await readFile(enCatalogPath, "utf-8");
    const enCatalog = JSON.parse(enCatalogRaw) as Record<string, string>;

    expect(Object.keys(enCatalog).length).toBe(4);
    expect(enCatalog["checkout_card.order_summary_for"]).toBe("Order Summary for {name}");
    expect(enCatalog["checkout_card.complete_order"]).toBe("Complete Order");

    // 4. Add valid German translation
    const deCatalog = {
      "checkout_card.order_summary_for": "Bestellübersicht für {name}",
      "checkout_card.please_review_your_order":
        "Bitte überprüfen Sie Ihre Bestelldaten vor dem Absenden.",
      "checkout_card.enter_coupon_code": "Gutscheincode eingeben",
      "checkout_card.complete_order": "Bestellung abschließen",
    };
    await writeFile(join(localesDir, "de.json"), JSON.stringify(deCatalog, null, 2), "utf-8");

    const validResult = await runValidate({ localesDir });
    expect(validResult).toBe(true);

    // 5. Add corrupted Spanish translation (dropped {name} variable)
    const esCatalogCorrupted = {
      "checkout_card.order_summary_for": "Resumen de pedido", // Missing {name}!
      "checkout_card.please_review_your_order": "Por favor revise los detalles de su pedido.",
      "checkout_card.enter_coupon_code": "Ingresar cupón",
      "checkout_card.complete_order": "Completar pedido",
    };
    await writeFile(
      join(localesDir, "es.json"),
      JSON.stringify(esCatalogCorrupted, null, 2),
      "utf-8",
    );

    const invalidResult = await runValidate({ localesDir });
    expect(invalidResult).toBe(false);
  });
});
