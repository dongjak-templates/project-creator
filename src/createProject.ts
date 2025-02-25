import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { loadTemplates } from './templates/index.js';

/**
 * 创建项目
 * @param projectName 项目名称
 */
export async function createProject(projectName: string): Promise<void> {
  console.log(chalk.blue(`正在创建项目: ${projectName}`));
  
  // 检查目标目录是否已存在
  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `目录 ${projectName} 已存在，是否覆盖?`,
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log(chalk.yellow('操作已取消'));
      process.exit(0);
    }
    
    // 清空目录
    await fs.emptyDir(targetDir);
  } else {
    // 创建目录
    await fs.ensureDir(targetDir);
  }
  
  // 加载模板列表
  const templates = loadTemplates();
  
  // 让用户选择模板
  const { templateId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateId',
      message: '请选择项目模板:',
      choices: templates.map(template => ({
        name: `${template.name} - ${template.description}`,
        value: template.id
      }))
    }
  ]);
  
  // 获取选择的模板
  const selectedTemplate = templates.find(t => t.id === templateId);
  if (!selectedTemplate) {
    throw new Error(`未找到模板: ${templateId}`);
  }
  
  console.log(chalk.blue(`使用模板: ${selectedTemplate.name}`));
  
  // 收集模板特定的参数
  const templateParams = await selectedTemplate.getParameters();
  
  // 初始化模板
  await selectedTemplate.initialize(targetDir, projectName, templateParams);
  
  // 进入项目目录
  process.chdir(targetDir);
  
  // 初始化git仓库
  try {
    console.log(chalk.blue('初始化Git仓库...'));
    execSync('git init', { stdio: 'ignore' });
    execSync('git add .', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit from template"', { stdio: 'ignore' });
    console.log(chalk.green('Git仓库初始化成功'));
  } catch (error) {
    console.warn(chalk.yellow('Git仓库初始化失败，请手动初始化'));
  }
  
  // 显示后续步骤
  console.log('\n' + chalk.green('项目创建成功！') + '\n');
  console.log(chalk.cyan('后续步骤:'));
  console.log(chalk.cyan(`  cd ${projectName}`));
  
  if (selectedTemplate.postInstallInstructions) {
    console.log(chalk.cyan(selectedTemplate.postInstallInstructions));
  }
}
