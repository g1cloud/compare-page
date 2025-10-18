import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';

type AttrExclusionMap = Map<string, Set<string>>;
type RegexExclusionRule = { tag: string; attribute: string; regex: RegExp; };

function parseExcludeAttrs(excludeStr?: string): AttrExclusionMap {
  const exclusions: AttrExclusionMap = new Map();
  if (!excludeStr) return exclusions;

  for (const pair of excludeStr.split(',')) {
    const [tag, attr] = pair.split(':');
    if (tag && attr) {
      const tagName = tag.toUpperCase();
      if (!exclusions.has(tagName)) {
        exclusions.set(tagName, new Set());
      }
      exclusions.get(tagName)!.add(attr);
    }
  }
  return exclusions;
}

function parseExcludeAttrRegex(regexRules?: string[]): RegexExclusionRule[] {
  const rules: RegexExclusionRule[] = [];
  if (!regexRules) return rules;

  for (const rule of regexRules) {
    const parts = rule.split(':');
    if (parts.length === 3) {
      const [tag, attribute, regex] = parts;
      try {
        rules.push({ tag: tag.toUpperCase(), attribute, regex: new RegExp(regex) });
      } catch (e) {
        console.error(`Skipping invalid regex rule "${rule}": ${(e as Error).message}`);
      }
    }
  }
  return rules;
}

function buildFilteredTreeString(node: Node, level: number, attrExclusions: AttrExclusionMap, regexExclusions: RegexExclusionRule[]): string {
  let result = '';
  const children = Array.from(node.childNodes).filter(n => n.nodeType === 1) as Element[];

  for (const child of children) {
    const indentation = '  '.repeat(level);
    const tagName = child.tagName.toLowerCase();

    const attributeFilter = (attr: Attr): boolean => {
      if (attr.value === '') return false;
      if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) return false;

      const tagExclusions = attrExclusions.get(child.tagName);
      if (tagExclusions && tagExclusions.has(attr.name)) return false;

      for (const rule of regexExclusions) {
        if ((rule.tag === '*' || rule.tag === child.tagName) && rule.attribute === attr.name) {
          if (rule.regex.test(attr.value)) return false;
        }
      }

      return true;
    };

    const attrs = Array.from(child.attributes)
      .filter(attributeFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(attr => `${attr.name}="${attr.value}"`) // Corrected escaping for attribute values
      .join(' ');

    const hasChildren = child.children.length > 0;
    const tagString = attrs ? `<${tagName} ${attrs}>` : `<${tagName}>`;

    result += indentation + tagString + '\n';

    if (hasChildren) {
      result += buildFilteredTreeString(child, level + 1, attrExclusions, regexExclusions);
    }
  }
  return result;
}

async function processAndCompare(htmlA: string, htmlB: string, selector: string, excludeStr?: string, regexRules?: string[], outPrefix: string = 'compare'): Promise<void> {
  const attrExclusions = parseExcludeAttrs(excludeStr);
  const regexExclusions = parseExcludeAttrRegex(regexRules);

  const domA = new JSDOM(htmlA);
  const domB = new JSDOM(htmlB);

  const filteredHtmlA = buildFilteredTreeString(domA.window.document.body, 0, attrExclusions, regexExclusions);
  const filteredHtmlB = buildFilteredTreeString(domB.window.document.body, 0, attrExclusions, regexExclusions);

  const fileNameA = `${outPrefix}_a.html`;
  const fileNameB = `${outPrefix}_b.html`;

  await Promise.all([
    fs.writeFile(fileNameA, filteredHtmlA),
    fs.writeFile(fileNameB, filteredHtmlB),
  ]);

  if (filteredHtmlA === filteredHtmlB) {
    console.log(`✅ The HTML structure inside "${selector}" is identical (with specified exclusions).`);
    console.log(`   - Output files ${fileNameA} and ${fileNameB} are identical.`);
  } else {
    console.error(`❌ The HTML structure inside "${selector}" is different.`);
    console.error('   - Inspect the differences by comparing the generated files:');
    console.error(
      `     diff ${fileNameA} ${fileNameB}`
    );
  }
}

export async function compareHtml(urlA: string, urlB: string, selector: string, excludeStr?: string, regexRules?: string[], outPrefix?: string): Promise<void> {
  console.log(`Comparing HTML structure inside selector "${selector}" of:\n- ${urlA}\n- ${urlB}\n`);
  if (excludeStr) {
    console.log(`Excluding attributes: ${excludeStr}`);
  }
  if (regexRules && regexRules.length > 0) {
    console.log('Excluding attributes by regex:');
    regexRules.forEach(rule => console.log(`  - ${rule}`))
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  try {
    const getElementHtml = async (url: string): Promise<string> => {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        return await page.innerHTML(selector);
      } finally {
        await page.close();
      }
    };

    const [htmlA, htmlB] = await Promise.all([getElementHtml(urlA), getElementHtml(urlB)]);

    await processAndCompare(htmlA, htmlB, selector, excludeStr, regexRules, outPrefix);

  } catch (error) {
    if (error instanceof Error && error.message.includes('waiting for selector')) {
        console.error(`Error: The selector "${selector}" was not found on one of the pages.`);
    } else {
        console.error('An error occurred while comparing the pages:', error);
    }
  } finally {
    await browser.close();
  }
}
