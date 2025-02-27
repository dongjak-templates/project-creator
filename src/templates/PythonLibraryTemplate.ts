import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';
import templatesConfig from './templates.json' assert { type: 'json' };

/**
 * Python库模板参数
 */
interface PythonLibraryTemplateParams extends TemplateParams {
  projectDescription: string;
}

/**
 * Python库项目模板
 */
export class PythonLibraryTemplate extends BaseTemplate {
  constructor() {
    super(
      'python-library',
      'Python Library',
      'Python库项目模板，用于创建可分发的Python库',
      `  python -m venv venv  # 创建虚拟环境
  source venv/bin/activate  # Linux/macOS激活虚拟环境
  venv\\Scripts\\activate    # Windows激活虚拟环境
  pip install -e ".[dev]"  # 安装依赖（开发模式）
  pytest  # 运行测试`
    );
  }

  /**
   * 获取Python库模板特定参数
   */
  async getParameters(): Promise<PythonLibraryTemplateParams> {
    // 项目描述
    const descriptionAnswer = await inquirer.prompt<{ projectDescription: string }>([
      {
        type: 'input',
        name: 'projectDescription',
        message: '请输入项目描述:',
        default: '一个Python库项目'
      }
    ]);
    const projectDescription = descriptionAnswer.projectDescription;

    return {
      projectDescription
    };
  }

  /**
   * 获取模板仓库地址
   */
  private getTemplateRepo(): string {
    const templateConfig = templatesConfig['python-library'];
    return templateConfig?.default || 'https://github.com/dongjak-templates/py-library-template.git';
  }

  /**
   * 初始化Python库模板
   */
  async initialize(targetDir: string, projectName: string, params: PythonLibraryTemplateParams): Promise<void> {
    const { projectDescription } = params;

    // 获取模板仓库地址
    const templateRepo = this.getTemplateRepo();
    console.log(`使用模板仓库: ${templateRepo}`);

    // 克隆模板仓库
    try {
      execSync(`git clone ${templateRepo} ${targetDir}`, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`克隆模板仓库失败: ${error}`);
    }

    // 删除.git目录
    await fs.remove(path.join(targetDir, '.git'));

    // 应用补丁，使模板可渲染
    await this.applyPatches(targetDir);

    // 渲染所有模板文件
    console.log('正在渲染模板文件...');
    await super.renderTemplateFiles(targetDir, {
      projectName,
      projectDescription,
      // 添加一些常用的派生变量
      projectNameSnakeCase: projectName.replace(/-/g, '_').toLowerCase(),
      currentYear: new Date().getFullYear()
    });

    console.log('项目初始化完成');
  }

  /**
   * 应用补丁，使模板可渲染
   * 在模板开发时，不能直接使用{{这种模板变量，需要通过补丁来恢复
   */
  private async applyPatches(targetDir: string): Promise<void> {
    const patchesDir = path.join(targetDir, '.patches');
    
    // 检查补丁目录是否存在
    if (!await fs.pathExists(patchesDir)) {
      console.log('没有找到补丁目录，跳过应用补丁步骤');
      return;
    }

    // 初始化Git仓库以便应用补丁
    try {
      process.chdir(targetDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit before applying patches"', { stdio: 'ignore' });
    } catch (error) {
      console.warn(`初始化Git仓库失败，无法应用补丁: ${error}`);
      return;
    }

    // 首先应用handlebars.patch补丁（如果存在）
    const handlebarsPatchPath = path.join(patchesDir, 'handlebars.patch');
    if (await fs.pathExists(handlebarsPatchPath)) {
      console.log('正在应用Handlebars补丁...');
      try {
        execSync(`git apply ${handlebarsPatchPath}`, { stdio: 'inherit' });
        console.log('Handlebars补丁应用成功');
      } catch (error) {
        console.error(`应用Handlebars补丁失败: ${error}`);
      }
    }

    // 应用其他可能存在的补丁
    const patchFiles = await fs.readdir(patchesDir);
    for (const patchFile of patchFiles) {
      // 跳过已经应用的handlebars.patch
      if (patchFile === 'handlebars.patch') continue;
      
      // 确保只处理.patch文件
      if (!patchFile.endsWith('.patch')) continue;
      
      const patchPath = path.join(patchesDir, patchFile);
      console.log(`正在应用补丁: ${patchFile}...`);
      try {
        execSync(`git apply ${patchPath}`, { stdio: 'inherit' });
        console.log(`补丁 ${patchFile} 应用成功`);
      } catch (error) {
        console.error(`应用补丁 ${patchFile} 失败: ${error}`);
      }
    }
    
    // 删除.patches目录
    await fs.remove(patchesDir);
    
    // 删除.git目录
    await fs.remove(path.join(targetDir, '.git'));
  }
}
