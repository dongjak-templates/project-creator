import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';
import templatesConfig from './templates.json' assert { type: 'json' };

/**
 * Python Web模板参数
 */
interface PythonWebTemplateParams extends TemplateParams {
  orm_framework?: 'sqlmodel';
  web_framework_choice?: 'flask' | 'fastapi';
  use_alembic?: boolean;
  includeAliSms?: boolean;
  includeAliOss?: boolean;
}

/**
 * Python Web项目模板
 */
export class PythonWebTemplate extends BaseTemplate {
  constructor() {
    super(
      'python-web',
      'Python Web',
      'Python Web项目模板',
      `  python -m venv venv  # 创建虚拟环境
  source venv/bin/activate  # Linux/macOS激活虚拟环境
  venv\\Scripts\\activate    # Windows激活虚拟环境
  pip install -r requirements.txt  # 安装依赖
  python main.py  # 运行项目`
    );
  }

  /**
   * 获取Python Web模板特定参数
   */
  async getParameters(): Promise<PythonWebTemplateParams> {
    // ORM框架选择
    const ormAnswer = await inquirer.prompt<{ orm_framework: 'sqlmodel' }>([
      {
        type: 'list',
        name: 'orm_framework',
        message: '选择ORM框架:',
        choices: [
          { name: 'SQLModel', value: 'sqlmodel' }
        ],
        default: 'sqlmodel'
      }
    ]);
    const orm_framework = ormAnswer.orm_framework;

    // Web框架选择
    const webFrameworkAnswer = await inquirer.prompt<{ web_framework_choice: 'flask' | 'fastapi' }>([
      {
        type: 'list',
        name: 'web_framework_choice',
        message: '选择Web框架:',
        choices: [
          { name: 'Flask', value: 'flask' },
          { name: 'FastAPI', value: 'fastapi' }
        ],
        default: 'fastapi'
      }
    ]);
    const web_framework_choice = webFrameworkAnswer.web_framework_choice;

    // 使用Alembic
    const alembicAnswer = await inquirer.prompt<{ use_alembic: boolean }>([
      {
        type: 'confirm',
        name: 'use_alembic',
        message: '是否使用Alembic管理数据库架构?',
        default: true
      }
    ]);
    const use_alembic = alembicAnswer.use_alembic;

    // 选择云服务
    const { cloudServices } = await inquirer.prompt<{ cloudServices: string[] }>([
      {
        type: 'checkbox',
        name: 'cloudServices',
        message: '选择要包含的云服务 (使用空格键选择/取消):',
        choices: [
          { name: '阿里云短信服务 (AliSMS)', value: 'aliSms' },
          { name: '阿里云对象存储服务 (AliOSS)', value: 'aliOss' }
        ]
      }
    ]);

    // 确定是否包含各个服务
    const includeAliSms = cloudServices.includes('aliSms');
    const includeAliOss = cloudServices.includes('aliOss');

    return {
      orm_framework,
      web_framework_choice,
      use_alembic,
      includeAliSms,
      includeAliOss
    };
  }

  /**
   * 根据条件获取模板仓库地址
   */
  private getTemplateRepo(params: PythonWebTemplateParams): string {
    const templateConfig = templatesConfig['python-web'];

    // 查找匹配的条件
    for (const condition of templateConfig.conditions) {
      if (
        (!condition.web_framework_choice || condition.web_framework_choice === params.web_framework_choice) &&
        (!condition.orm_framework || condition.orm_framework === params.orm_framework)
      ) {
        return condition.repo;
      }
    }

    // 如果没有匹配的条件，返回默认仓库
    return templateConfig.default;
  }

  /**
   * 初始化Python Web模板
   */
  async initialize(targetDir: string, projectName: string, params: PythonWebTemplateParams): Promise<void> {
    const { orm_framework, web_framework_choice, use_alembic, includeAliSms, includeAliOss } = params;

    // 获取模板仓库地址
    const templateRepo = this.getTemplateRepo(params);
    console.log(`使用模板仓库: ${templateRepo}`);

    // 克隆模板仓库
    try {
      execSync(`git clone ${templateRepo} ${targetDir}`, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`克隆模板仓库失败: ${error}`);
    }

    // 删除.git目录
    await fs.remove(path.join(targetDir, '.git'));

    // 根据参数配置项目
    await this.configureProject(targetDir, projectName, params);

    // 渲染所有模板文件
    console.log('正在渲染模板文件...');
    await super.renderTemplateFiles(targetDir, {
      projectName,
      ...params,
      // 添加一些额外的上下文变量，方便在模板中使用
      hasOrm: true,
      hasWebFramework: true,
      isFlask: web_framework_choice === 'flask',
      isFastApi: web_framework_choice === 'fastapi',
      hasSqlModel: orm_framework === 'sqlmodel',
      hasAlembic: use_alembic,
      hasAliSms: includeAliSms,
      hasAliOss: includeAliOss
    });

    // 应用补丁
    await this.applyPatches(targetDir, params);

    console.log('项目初始化完成');
  }


  /**
   * 根据参数配置项目
   */
  private async configureProject(targetDir: string, projectName: string, params: PythonWebTemplateParams): Promise<void> {
    const { orm_framework, web_framework_choice, use_alembic, includeAliSms, includeAliOss } = params;

    // 如果不使用Alembic，移除相关文件
    if (!use_alembic) {
      const alembicDir = path.join(targetDir, 'alembic');
      const alembicIni = path.join(targetDir, 'alembic.ini');

      if (await fs.pathExists(alembicDir)) {
        await fs.remove(alembicDir);
      }

      if (await fs.pathExists(alembicIni)) {
        await fs.remove(alembicIni);
      }
    }

    // 如果不包含阿里云短信服务，移除相关文件
    if (!includeAliSms) {
      const aliSmsDir = path.join(targetDir, 'app', 'services', 'ali_sms');

      if (await fs.pathExists(aliSmsDir)) {
        await fs.remove(aliSmsDir);
      }
    }

    // 如果不包含阿里云对象存储服务，移除相关文件
    if (!includeAliOss) {
      const aliOssDir = path.join(targetDir, 'app', 'services', 'ali_oss');

      if (await fs.pathExists(aliOssDir)) {
        await fs.remove(aliOssDir);
      }
    }
  }


  /**
   * 应用补丁
   */
  private async applyPatches(targetDir: string, params: PythonWebTemplateParams): Promise<void> {
    const { includeAliSms, includeAliOss } = params;
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

    // 应用阿里云短信服务补丁
    if (includeAliSms) {
      const aliSmsPatch = path.join(patchesDir, 'includeAliSms.patch');
      if (await fs.pathExists(aliSmsPatch)) {
        console.log('正在应用阿里云短信服务补丁...');
        try {
          execSync(`git apply ${aliSmsPatch}`, { stdio: 'inherit' });
          console.log('阿里云短信服务补丁应用成功');
        } catch (error) {
          console.error(`应用阿里云短信服务补丁失败: ${error}`);
        }
      } else {
        console.warn('未找到阿里云短信服务补丁文件');
      }
    }

    // 应用阿里云对象存储服务补丁
    if (includeAliOss) {
      const aliOssPatch = path.join(patchesDir, 'includeAliOss.patch');
      if (await fs.pathExists(aliOssPatch)) {
        console.log('正在应用阿里云对象存储服务补丁...');
        try {
          execSync(`git apply ${aliOssPatch}`, { stdio: 'inherit' });
          console.log('阿里云对象存储服务补丁应用成功');
        } catch (error) {
          console.error(`应用阿里云对象存储服务补丁失败: ${error}`);
        }
      } else {
        console.warn('未找到阿里云对象存储服务补丁文件');
      }
    }

    // 删除.patches目录
    await fs.remove(patchesDir);

    // 删除.git目录
    await fs.remove(path.join(targetDir, '.git'));
  }
}
