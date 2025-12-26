#!/usr/bin/env node
/**
 * RADIANT CLI - Command-line interface for the RADIANT AI Platform
 */

import { Command } from 'commander';
import { authCommands } from './commands/auth.js';
import { chatCommands } from './commands/chat.js';
import { modelsCommands } from './commands/models.js';
import { billingCommands } from './commands/billing.js';
import { configCommands } from './commands/config.js';

const VERSION = '4.18.0';

const program = new Command();

program
  .name('radiant')
  .description('RADIANT AI Platform CLI')
  .version(VERSION);

// Register command groups
authCommands(program);
chatCommands(program);
modelsCommands(program);
billingCommands(program);
configCommands(program);

program.parse();
