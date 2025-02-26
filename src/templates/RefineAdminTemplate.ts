import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';
import templatesConfig from './templates.json' assert { type: 'json' };

/**
 * Refine Admin模板参数
 */
interface RefineAdminTemplateParams extends TemplateParams {
  multiEnv?: boolean;
  includeUnocss?: boolean;
}

/**
 * Refine Admin项目模板
 */
export class RefineAdminTemplate extends BaseTemplate {
  constructor() {
    super(
      'refine-admin',
      'Refine Admin',
      'Refine Admin项目模板，基于React的管理后台框架',
      `  cd ${process.platform === 'win32' ? '' : './'}项目目录
  npm install  # 安装依赖
  npm run dev  # 启动开发服务器`
    );
  }

  /**
   * 获取Refine Admin模板特定参数
   */
  async getParameters(): Promise<RefineAdminTemplateParams> {
    // 功能选择
    const { features } = await inquirer.prompt<{ features: string[] }>([
      {
        type: 'checkbox',
        name: 'features',
        message: '选择要包含的功能 (使用空格键选择/取消):',
        choices: [
          { name: '多环境支持 (开发、测试、生产环境配置)', value: 'multiEnv' },
          { name: '集成UnoCSS (原子化CSS框架)', value: 'unocss' }
        ]
      }
    ]);

    // 确定是否包含各个功能
    const multiEnv = features.includes('multiEnv');
    const includeUnocss = features.includes('unocss');

    return {
      multiEnv,
      includeUnocss
    };
  }

  /**
   * 获取模板仓库地址
   */
  private getTemplateRepo(): string {
    const templateConfig = templatesConfig['refine-admin'];
    return templateConfig?.default || 'https://github.com/dongjak-templates/refine-admin-template.git';
  }

  /**
   * 初始化Refine Admin模板
   */
  async initialize(targetDir: string, projectName: string, params: RefineAdminTemplateParams): Promise<void> {
    const { multiEnv, includeUnocss } = params;

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

    // 渲染所有模板文件
    console.log('正在渲染模板文件...');
    await super.renderTemplateFiles(targetDir, {
      projectName,
      ...params,
      // 添加一些额外的上下文变量，方便在模板中使用
      hasMultiEnv: multiEnv,
      hasUnocss: includeUnocss
    });

    // 应用补丁
    await this.applyPatches(targetDir, params);

    console.log('项目初始化完成');
  }
 

  /**
   * 应用补丁
   */
  private async applyPatches(targetDir: string, params: RefineAdminTemplateParams): Promise<void> {
    const { multiEnv, includeUnocss } = params;
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

    // 应用多环境支持补丁
    if (multiEnv) {
      const multiEnvPatch = path.join(patchesDir, 'multiEnv.patch');
      if (await fs.pathExists(multiEnvPatch)) {
        console.log('正在应用多环境支持补丁...');
        try {
          execSync(`git apply ${multiEnvPatch}`, { stdio: 'inherit' });
          console.log('多环境支持补丁应用成功');
        } catch (error) {
          console.error(`应用多环境支持补丁失败: ${error}`);
        }
      } else {
        console.warn('未找到多环境支持补丁文件');
      }
    }

    // 应用UnoCSS集成补丁
    if (includeUnocss) {
      const unocssPath = path.join(patchesDir, 'unocss.patch');
      if (await fs.pathExists(unocssPath)) {
        console.log('正在应用UnoCSS集成补丁...');
        try {
          execSync(`git apply ${unocssPath}`, { stdio: 'inherit' });
          console.log('UnoCSS集成补丁应用成功');
        } catch (error) {
          console.error(`应用UnoCSS集成补丁失败: ${error}`);
        }
      } else {
        console.warn('未找到UnoCSS集成补丁文件');
      }
    }

    // 删除.patches目录
    await fs.remove(patchesDir);

    // 删除.git目录
    await fs.remove(path.join(targetDir, '.git'));
  }
}
