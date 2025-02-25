#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProject } from './createProject.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('cruldra-create-project')
  .description('快速生成不同类型的项目骨架')
  .version('1.0.0')
  .argument('[project-name]', '项目名称')
  .action(async (projectName) => {
    try {
      // 如果没有提供项目名称，则提示用户输入
      if (!projectName) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: '请输入项目名称:',
            validate: (input) => {
              if (!input.trim()) {
                return '项目名称不能为空';
              }
              return true;
            }
          }
        ]);
        projectName = answers.projectName;
      }

      // 创建项目
      await createProject(projectName);
      
      console.log(chalk.green(`✅ 项目 ${projectName} 创建成功！`));
    } catch (error) {
      console.error(chalk.red('创建项目时出错:'), error);
      process.exit(1);
    }
  });

program.parse();
