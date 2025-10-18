#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .version('1.0.0')
  .description('A simple CLI tool')
  .option('-n, --name <name>', 'Your name')
  .action((options) => {
    console.log(`Hello, ${options.name || 'World'}!`);
  });

program.parse(process.argv);
