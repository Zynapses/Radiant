/**
 * Configuration Commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, setConfig, config } from '../config.js';
import { ValidationError, handleError } from '../errors.js';

export function configCommands(program: Command): void {
  const cfg = program
    .command('config')
    .description('Manage CLI configuration');

  cfg
    .command('show')
    .description('Show current configuration')
    .action(() => {
      const currentConfig = getConfig();
      
      console.log(chalk.bold('\nCurrent Configuration\n'));
      console.log(`  ${chalk.cyan('Base URL:')}       ${currentConfig.baseUrl}`);
      console.log(`  ${chalk.cyan('Default Model:')}  ${currentConfig.defaultModel}`);
      console.log(`  ${chalk.cyan('Output Format:')}  ${currentConfig.outputFormat}`);
      console.log(`  ${chalk.cyan('API Key:')}        ${currentConfig.apiKey ? '***configured***' : chalk.yellow('not set')}`);
      console.log();
    });

  cfg
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action((key: string, value: string) => {
      const validKeys = ['baseUrl', 'defaultModel', 'outputFormat'];
      
      if (!validKeys.includes(key)) {
        handleError(new ValidationError(`Invalid key: ${key}. Valid keys: ${validKeys.join(', ')}`));
      }

      if (key === 'outputFormat' && !['text', 'json', 'table'].includes(value)) {
        handleError(new ValidationError('Invalid output format. Use: text, json, or table'));
      }

      setConfig(key as keyof ReturnType<typeof getConfig>, value);
      console.log(chalk.green(`✓ Set ${key} = ${value}`));
    });

  cfg
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action((key: string) => {
      const currentConfig = getConfig();
      const value = currentConfig[key as keyof typeof currentConfig];
      
      if (value === undefined) {
        console.log(chalk.yellow('Not set'));
      } else if (key === 'apiKey') {
        console.log('***configured***');
      } else {
        console.log(value);
      }
    });

  cfg
    .command('reset')
    .description('Reset configuration to defaults')
    .action(async () => {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Reset all configuration to defaults?',
          default: false,
        },
      ]);

      if (confirm) {
        config.clear();
        console.log(chalk.green('✓ Configuration reset to defaults'));
      } else {
        console.log('Cancelled');
      }
    });

  cfg
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      console.log(config.path);
    });
}
