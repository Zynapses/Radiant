/**
 * Chat Commands
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, streamRequest } from '../api.js';
import { getConfig } from '../config.js';
import { handleError } from '../errors.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function chatCommands(program: Command): void {
  const chat = program
    .command('chat')
    .description('Chat with AI models');

  chat
    .command('send')
    .description('Send a message to an AI model')
    .argument('<message>', 'Message to send')
    .option('-m, --model <model>', 'Model to use')
    .option('-s, --system <prompt>', 'System prompt')
    .option('--stream', 'Stream the response')
    .option('--json', 'Output as JSON')
    .action(async (message: string, options: { model?: string; system?: string; stream?: boolean; json?: boolean }) => {
      const config = getConfig();
      const model = options.model || config.defaultModel;
      
      const messages: ChatMessage[] = [];
      
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }
      messages.push({ role: 'user', content: message });

      try {
        if (options.stream) {
          process.stdout.write(chalk.cyan('Assistant: '));
          await streamRequest('/chat/completions', {
            model,
            messages,
          }, (content) => {
            process.stdout.write(content);
          });
          console.log('\n');
        } else {
          const spinner = ora('Thinking...').start();
          
          const response = await apiRequest<ChatCompletionResponse>(
            'POST',
            '/chat/completions',
            { model, messages }
          );
          
          spinner.stop();
          
          if (options.json) {
            console.log(JSON.stringify(response, null, 2));
          } else {
            console.log(chalk.cyan('Assistant:'), response.choices[0].message.content);
            console.log(chalk.gray(`\n[${response.usage.total_tokens} tokens]`));
          }
        }
      } catch (error) {
        handleError(error);
      }
    });

  chat
    .command('interactive')
    .alias('i')
    .description('Start an interactive chat session')
    .option('-m, --model <model>', 'Model to use')
    .option('-s, --system <prompt>', 'System prompt')
    .action(async (options: { model?: string; system?: string }) => {
      const config = getConfig();
      const model = options.model || config.defaultModel;
      
      console.log(chalk.cyan(`RADIANT Chat (${model})`));
      console.log(chalk.gray('Type "exit" or Ctrl+C to quit\n'));

      const messages: ChatMessage[] = [];
      
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
        console.log(chalk.gray(`System: ${options.system}\n`));
      }

      let chatActive = true;
      while (chatActive) {
        const { input } = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: chalk.green('You:'),
            prefix: '',
          },
        ]);

        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          console.log(chalk.gray('Goodbye!'));
          chatActive = false;
          continue;
        }

        if (!input.trim()) continue;

        messages.push({ role: 'user', content: input });

        try {
          process.stdout.write(chalk.cyan('Assistant: '));
          
          let fullResponse = '';
          await streamRequest('/chat/completions', {
            model,
            messages,
          }, (content) => {
            process.stdout.write(content);
            fullResponse += content;
          });
          
          console.log('\n');
          messages.push({ role: 'assistant', content: fullResponse });
        } catch (error) {
          console.error(chalk.red('\nError:'), (error as Error).message);
        }
      }
    });

  chat
    .command('complete')
    .description('Complete a prompt (non-chat format)')
    .argument('<prompt>', 'Prompt to complete')
    .option('-m, --model <model>', 'Model to use')
    .option('--max-tokens <n>', 'Maximum tokens to generate', '256')
    .option('--temperature <n>', 'Temperature (0-2)', '0.7')
    .action(async (prompt: string, options: { model?: string; maxTokens?: string; temperature?: string }) => {
      const config = getConfig();
      const model = options.model || config.defaultModel;

      try {
        const spinner = ora('Generating...').start();
        
        const response = await apiRequest<ChatCompletionResponse>(
          'POST',
          '/chat/completions',
          {
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: parseInt(options.maxTokens || '256', 10),
            temperature: parseFloat(options.temperature || '0.7'),
          }
        );
        
        spinner.stop();
        console.log(response.choices[0].message.content);
      } catch (error) {
        handleError(error);
      }
    });
}
