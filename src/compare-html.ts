import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';

type ExclusionMap = Map<string, Set<string>>;

/**
 * Parses a comma-separated string of tag:attribute pairs into a structured Map.
 * @param excludeStr The string from the --exclude-attrs option.
 * @returns A Map where keys are tag names and values are Sets of attributes to exclude.
 */
function parseExcludeAttrs(excludeStr?: string): ExclusionMap {
  const exclusions: ExclusionMap = new Map();
  if (!excludeStr) {
    return exclusions;
  }

  const pairs = excludeStr.split(',');
  for (const pair of pairs) {
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

/**
 * Recursively compares two DOM nodes to see if their structure is identical.
 */
function compareNodes(nodeA: Node, nodeB: Node, path: string, exclusions: ExclusionMap): boolean {
  let areStructuresIdentical = true;

  const childrenA = Array.from(nodeA.childNodes).filter(n => n.nodeType === 1) as Element[];
  const childrenB = Array.from(nodeB.childNodes).filter(n => n.nodeType === 1) as Element[];

  if (childrenA.length !== childrenB.length) {
    console.error(`❌ Difference found: Different number of child elements at path "${path}".`);
    console.error(`   - URL A has ${childrenA.length} children, URL B has ${childrenB.length}.`);
    return false;
  }

  for (let i = 0; i < childrenA.length; i++) {
    const childA = childrenA[i];
    const childB = childrenB[i];
    const currentPath = `${path} > ${childA.tagName.toLowerCase()}:nth-child(${i + 1})`;

    let isCurrentNodeIdentical = true;

    if (childA.tagName !== childB.tagName) {
      console.error(`❌ Difference found: Different tag names at path "${path}".`);
      console.error(`   - URL A: <${childA.tagName.toLowerCase()}>, URL B: <${childB.tagName.toLowerCase()}>`);
      isCurrentNodeIdentical = false;
    }

    const attributeFilter = (attr: Attr) => {
      if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) return false;
      const tagExclusions = exclusions.get(childA.tagName);
      if (tagExclusions && tagExclusions.has(attr.name)) return false;
      return true;
    };

    const attrsA = Array.from(childA.attributes).filter(attributeFilter).sort((a, b) => a.name.localeCompare(b.name));
    const attrsB = Array.from(childB.attributes).filter(attributeFilter).sort((a, b) => a.name.localeCompare(b.name));

    if (attrsA.length !== attrsB.length) {
      console.error(`❌ Difference found: Different number of attributes at path "${currentPath}".`);
      console.error(`   - URL A has ${attrsA.length}, URL B has ${attrsB.length}.`);
      isCurrentNodeIdentical = false;
    } else {
      for (let j = 0; j < attrsA.length; j++) {
        if (attrsA[j].name !== attrsB[j].name || attrsA[j].value !== attrsB[j].value) {
          console.error(`❌ Difference found: Different attributes at path "${currentPath}".`);
          console.error(`   - URL A: ${attrsA[j].name}="${attrsA[j].value}"`);
          console.error(`   - URL B: ${attrsB[j].name}="${attrsB[j].value}"`);
          isCurrentNodeIdentical = false;
        }
      }
    }

    if (!compareNodes(childA, childB, currentPath, exclusions)) {
      isCurrentNodeIdentical = false;
    }

    if (!isCurrentNodeIdentical) {
      areStructuresIdentical = false;
    }
  }

  return areStructuresIdentical;
}

function areStructuresEqual(htmlA: string, htmlB: string, selector: string, exclusions: ExclusionMap): boolean {
  const domA = new JSDOM(htmlA);
  const domB = new JSDOM(htmlB);
  return compareNodes(domA.window.document.body, domB.window.document.body, selector, exclusions);
}

function logComparisonResult(htmlA: string, htmlB: string, selector: string, excludeStr?: string): void {
  const exclusions = parseExcludeAttrs(excludeStr);
  if (areStructuresEqual(htmlA, htmlB, selector, exclusions)) {
    console.log(`✅ The HTML structure inside "${selector}" is identical (with specified exclusions).`);
  } else {
    console.error(`
Comparison finished. One or more structural differences were found.`);
  }
}

export async function compareHtml(urlA: string, urlB: string, selector: string, excludeStr?: string): Promise<void> {
  console.log(`Comparing HTML structure inside selector "${selector}" of:
- ${urlA}
- ${urlB}
`);
  if (excludeStr) {
    console.log(`Excluding attributes: ${excludeStr}`);
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

    logComparisonResult(htmlA, htmlB, selector, excludeStr);

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