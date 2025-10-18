#!/usr/bin/env node

import { Command } from 'commander';
import { compareHtml } from './compare-html';

const program = new Command();

program
  .version('1.0.0')
  .description('A CLI tool to compare two web pages.');

program
  .command('html <urlA> <urlB>')
  .description('Compare the HTML structure of two web pages.')
  .option('-s, --selector <selector>', 'CSS selector for the element to compare', 'body')
  .option('--exclude-attrs <attributes>', 'Comma-separated list of tag:attribute pairs to exclude (e.g., img:src,img:alt)')
  .option('--exclude-attr-regex <rule...>', 'A tag:attribute:regex rule to exclude. Can be specified multiple times.')
  .action((urlA, urlB, options) => {
    compareHtml(urlA, urlB, options.selector, options.excludeAttrs, options.excludeAttrRegex);
  });

program.parse(process.argv);