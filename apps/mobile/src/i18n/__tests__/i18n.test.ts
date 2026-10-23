import en from "../locales/en/common.json";
import ptBR from "../locales/pt-BR/common.json";
import i18n from "../index";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n", () => {
  it("has both pt-BR and en resources for the tab labels", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("tabs.feed")).toBe("Feed");

    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("tabs.feed")).toBe("Início");
  });

  // CLAUDE.md rule 10 "i18n everywhere" — every key added to one locale
  // must exist in the other, so a translator catches missing strings at
  // test time rather than a user seeing a raw key or a blank string.
  it("has exactly the same keys in both locales", () => {
    const enKeys = keyPaths(en).sort();
    const ptBRKeys = keyPaths(ptBR).sort();
    expect(ptBRKeys).toEqual(enKeys);
  });
});
