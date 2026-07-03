export function loadUiCatalogPage() {
  return import("./ui/UiCatalogPage").then(({ UiCatalogPage }) => ({
    default: UiCatalogPage,
  }));
}
