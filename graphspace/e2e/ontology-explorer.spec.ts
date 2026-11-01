import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const fixture = path.resolve('src/widgets/ontology-explorer/model/motivation-full.fixture.json');
const legacy = path.resolve('src/pages/ontology-viewer/model/ontology-graph-contract/fixtures/ontology_normalized_ir.specgraph-core.min.json');

for (const mobile of [false, true]) {
  test(`ontology explorer ${mobile ? 'mobile' : 'desktop'} read-only delivery`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 });
    const mutations: string[] = [];
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()); });
    await page.goto('/ontology');
    await page.getByLabel('Open ontology artifact').setInputFiles(fixture);
    await expect(page.getByText('PACKAGE · READ ONLY')).toBeVisible();
    const canvas = page.getByLabel('Ontology graph', { exact: true });
    await expect(canvas.locator('.react-flow__node').first()).toBeVisible();
    await page.getByLabel('Search graph', { exact: true }).fill('motivcore:Motive');
    await page.getByRole('button', { name: 'motivcore:Motive class', exact: true }).click();
    await expect(page.getByLabel('Inspector')).toContainText('/spec/classes/Motive');
    await expect(page.getByLabel('Inspector')).toContainText('File SHA-256');
    await page.getByLabel('Search graph', { exact: true }).fill('');
    const selected = canvas.locator('.react-flow__node').filter({ hasText: 'motivcore:Motive' });
    const before = await selected.getAttribute('style');
    await page.getByText('Filters', { exact: true }).click();
    const imported = page.getByRole('checkbox', { name: 'Classes', exact: true });
    await imported.uncheck();
    await expect(page.getByText('This selection is outside the active filters.')).toBeVisible();
    await page.getByRole('radio', { name: 'Dim', exact: true }).check();
    await expect(canvas.locator('.react-flow__node.filter-dim').first()).toBeVisible();
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(selected).toHaveAttribute('style', before!);
    const packageFilter = page.getByRole('checkbox', { name: 'Package org.0al.events.core@0.2.0', exact: true });
    const completeCount = await canvas.locator('.react-flow__node').count();
    await packageFilter.uncheck();
    await expect.poll(() => canvas.locator('.react-flow__node').count()).toBeLessThan(completeCount);
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await page.getByText('Filters', { exact: true }).click();
    const malformed = JSON.parse(readFileSync(fixture, 'utf8')); malformed.schemaVersion = 'ontology.diagram-projection/v999';
    await page.getByLabel('Open ontology artifact').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed)) });
    await expect(page.getByRole('alert')).toContainText('Unsupported schemaVersion');
    await expect(page.getByLabel('Inspector')).toContainText('motivcore:Motive');
    await page.getByLabel('Open ontology artifact').setInputFiles(fixture);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByLabel('Search graph', { exact: true }).fill('motivcore:Motive');
    await page.getByRole('button', { name: 'motivcore:Motive class', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(canvas.locator('.react-flow__viewport')).toHaveAttribute('style', /scale\(1\)/);
    await page.getByLabel('Inspector').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Inspector')).toBeVisible();
    await page.screenshot({ path: info.outputPath('ontology-explorer.png'), fullPage: true });
    await page.getByLabel('Open ontology artifact').setInputFiles({ name: 'ontology.normalized.json', mimeType: 'application/json', buffer: readFileSync(legacy) });
    await expect(page.getByText('local artifact viewer')).toBeVisible();
    await expect(page.getByText('Package', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Open ontology artifact').setInputFiles(fixture);
    await expect(page.getByText('PACKAGE · READ ONLY')).toBeVisible();
    if (!mobile) {
      await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
          if (this.name === 'slow.json') {
            await new Promise(resolve => setTimeout(resolve, 300));
            (window as unknown as Record<string, unknown>).slowReadFinished = true;
          }
          return original.call(this);
        };
        const originalText = File.prototype.text;
        File.prototype.text = async function () {
          if (this.name === 'unreadable.json') throw new Error('Simulated unreadable file');
          return originalText.call(this);
        };
      });
      await page.getByLabel('Open ontology artifact').setInputFiles({ name: 'unreadable.json', mimeType: 'application/json', buffer: readFileSync(fixture) });
      await expect(page.getByRole('alert')).toContainText('Simulated unreadable file');
      await expect(page.getByText('PACKAGE · READ ONLY')).toBeVisible();
      await page.getByLabel('Open ontology artifact').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed)) });
      await page.getByLabel('Open ontology artifact').setInputFiles(fixture);
      await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>).slowReadFinished)).toBe(true);
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
    expect(mutations).toEqual([]);
  });
}
