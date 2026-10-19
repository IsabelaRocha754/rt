import i18n from "../index";

describe("i18n", () => {
  it("has both pt-BR and en resources for the tab labels", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("tabs.feed")).toBe("Feed");

    await i18n.changeLanguage("pt-BR");
    expect(i18n.t("tabs.feed")).toBe("Início");
  });
});
