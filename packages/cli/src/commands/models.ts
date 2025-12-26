/**
 * Models Commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { apiRequest } from '../api.js';
import { handleError } from '../errors.js';

interface Model {
  id: string;
  display_name: string;
  category: string;
  context_window: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  capabilities: string[];
}

interface ModelList {
  data: Model[];
}

export function modelsCommands(program: Command): void {
  const models = program
    .command('models')
    .description('Manage AI models');

  models
    .command('list')
    .alias('ls')
    .description('List available models')
    .option('--category <category>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action(async (options: { category?: string; json?: boolean }) => {
      try {
        const spinner = ora('Fetching models...').start();
        const response = await apiRequest<ModelList>('GET', '/models');
        spinner.stop();

        let modelsList = response.data;

        if (options.category) {
          const category = options.category;
          modelsList = modelsList.filter(
            m => m.category.toLowerCase() === category.toLowerCase()
          );
        }

        if (options.json) {
          console.log(JSON.stringify(modelsList, null, 2));
          return;
        }

        if (modelsList.length === 0) {
          console.log(chalk.yellow('No models found'));
          return;
        }

        const tableData = [
          [
            chalk.bold('ID'),
            chalk.bold('Name'),
            chalk.bold('Category'),
            chalk.bold('Context'),
            chalk.bold('Cost (in/out)'),
          ],
          ...modelsList.map(m => [
            m.id,
            m.display_name,
            m.category,
            formatNumber(m.context_window),
            `$${m.input_cost_per_1k}/$${m.output_cost_per_1k}`,
          ]),
        ];

        console.log(table(tableData));
        console.log(chalk.gray(`${modelsList.length} models available`));
      } catch (error) {
        handleError(error);
      }
    });

  models
    .command('info')
    .description('Get detailed model information')
    .argument('<model-id>', 'Model ID')
    .option('--json', 'Output as JSON')
    .action(async (modelId: string, options: { json?: boolean }) => {
      try {
        const spinner = ora('Fetching model...').start();
        const response = await apiRequest<{ data: Model }>('GET', `/models/${modelId}`);
        spinner.stop();

        const model = response.data;

        if (options.json) {
          console.log(JSON.stringify(model, null, 2));
          return;
        }

        console.log(chalk.bold('\nModel Information\n'));
        console.log(`  ${chalk.cyan('ID:')}            ${model.id}`);
        console.log(`  ${chalk.cyan('Name:')}          ${model.display_name}`);
        console.log(`  ${chalk.cyan('Category:')}      ${model.category}`);
        console.log(`  ${chalk.cyan('Context:')}       ${formatNumber(model.context_window)} tokens`);
        console.log(`  ${chalk.cyan('Input Cost:')}    $${model.input_cost_per_1k}/1K tokens`);
        console.log(`  ${chalk.cyan('Output Cost:')}   $${model.output_cost_per_1k}/1K tokens`);
        console.log(`  ${chalk.cyan('Capabilities:')}  ${model.capabilities.join(', ')}`);
        console.log();
      } catch (error) {
        handleError(error);
      }
    });

  models
    .command('search')
    .description('Search for models')
    .argument('<query>', 'Search query')
    .action(async (query: string) => {
      try {
        const spinner = ora('Searching...').start();
        const response = await apiRequest<ModelList>('GET', '/models');
        spinner.stop();

        const lowerQuery = query.toLowerCase();
        const matches = response.data.filter(
          m =>
            m.id.toLowerCase().includes(lowerQuery) ||
            m.display_name.toLowerCase().includes(lowerQuery) ||
            m.category.toLowerCase().includes(lowerQuery)
        );

        if (matches.length === 0) {
          console.log(chalk.yellow('No models found matching:'), query);
          return;
        }

        for (const model of matches) {
          console.log(`${chalk.cyan(model.id)} - ${model.display_name} (${model.category})`);
        }
      } catch (error) {
        handleError(error);
      }
    });
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}
