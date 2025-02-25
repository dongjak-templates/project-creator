import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';
import templatesConfig from './templates.json' assert { type: 'json' };

/**
 * Python API模板参数
 */
interface PythonApiTemplateParams extends TemplateParams {
  orm: boolean;
  orm_framework?: 'sqlmodel';
  web_framework: boolean;
  web_framework_choice?: 'flask' | 'fastapi';
  use_alembic?: boolean;
  includeAliSms?: boolean;
  includeAliOss?: boolean;
}

/**
 * Python API项目模板
 */
export class PythonApiTemplate extends BaseTemplate {
  constructor() {
    super(
      'python-api',
      'Python API',
      'Python API项目模板',
      `  python -m venv venv  # 创建虚拟环境
  source venv/bin/activate  # Linux/macOS激活虚拟环境
  venv\\Scripts\\activate    # Windows激活虚拟环境
  pip install -r requirements.txt  # 安装依赖
  python main.py  # 运行项目`
    );
  }
  
  /**
   * 获取Python API模板特定参数
   */
  async getParameters(): Promise<PythonApiTemplateParams> {
    // 使用ORM
    const { orm } = await inquirer.prompt<{ orm: boolean }>([
      {
        type: 'confirm',
        name: 'orm',
        message: '是否使用ORM?',
        default: true
      }
    ]);
    
    // ORM框架选择
    let orm_framework: 'sqlmodel' | undefined;
    if (orm) {
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
      orm_framework = ormAnswer.orm_framework;
    }
    
    // 使用Web框架
    const { web_framework } = await inquirer.prompt<{ web_framework: boolean }>([
      {
        type: 'confirm',
        name: 'web_framework',
        message: '是否使用Web框架?',
        default: true
      }
    ]);
    
    // Web框架选择
    let web_framework_choice: 'flask' | 'fastapi' | undefined;
    if (web_framework) {
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
      web_framework_choice = webFrameworkAnswer.web_framework_choice;
    }
    
    // 使用Alembic
    let use_alembic: boolean | undefined;
    if (orm) {
      const alembicAnswer = await inquirer.prompt<{ use_alembic: boolean }>([
        {
          type: 'confirm',
          name: 'use_alembic',
          message: '是否使用Alembic管理数据库架构?',
          default: true
        }
      ]);
      use_alembic = alembicAnswer.use_alembic;
    }
    
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
      orm,
      orm_framework,
      web_framework,
      web_framework_choice,
      use_alembic,
      includeAliSms,
      includeAliOss
    };
  }
  
  /**
   * 根据条件获取模板仓库地址
   */
  private getTemplateRepo(params: PythonApiTemplateParams): string {
    const templateConfig = templatesConfig['python-api'];
    
    // 查找匹配的条件
    for (const condition of templateConfig.conditions) {
      if (
        (!condition.web_framework || condition.web_framework === params.web_framework_choice) &&
        (!condition.orm || condition.orm === params.orm) &&
        (!condition.orm_framework || condition.orm_framework === params.orm_framework)
      ) {
        return condition.repo;
      }
    }
    
    // 如果没有匹配的条件，返回默认仓库
    return templateConfig.default;
  }
  
  /**
   * 初始化Python API模板
   */
  async initialize(targetDir: string, projectName: string, params: PythonApiTemplateParams): Promise<void> {
    const { orm, orm_framework, web_framework, web_framework_choice, use_alembic, includeAliSms, includeAliOss } = params;
    
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
    
    // 更新项目名称
    await this.updateProjectName(targetDir, projectName);
    
    // 根据参数配置项目
    await this.configureProject(targetDir, projectName, params);
    
    // 渲染所有模板文件
    console.log('正在渲染模板文件...');
    await super.renderTemplateFiles(targetDir, {
      projectName,
      ...params,
      // 添加一些额外的上下文变量，方便在模板中使用
      hasOrm: orm,
      hasWebFramework: web_framework,
      isFlask: web_framework && web_framework_choice === 'flask',
      isFastApi: web_framework && web_framework_choice === 'fastapi',
      hasSqlModel: orm && orm_framework === 'sqlmodel',
      hasAlembic: orm && use_alembic,
      hasAliSms: includeAliSms,
      hasAliOss: includeAliOss
    });
    
    // 应用补丁
    await this.applyPatches(targetDir, params);
    
    console.log('项目初始化完成');
  }
  
  /**
   * 更新项目名称
   */
  private async updateProjectName(targetDir: string, projectName: string): Promise<void> {
    // 更新pyproject.toml中的项目名称
    const pyprojectPath = path.join(targetDir, 'pyproject.toml');
    if (await fs.pathExists(pyprojectPath)) {
      let content = await fs.readFile(pyprojectPath, 'utf8');
      content = content.replace(/name = ".*"/g, `name = "${projectName}"`);
      await fs.writeFile(pyprojectPath, content);
    }
    
    // 更新setup.py中的项目名称
    const setupPath = path.join(targetDir, 'setup.py');
    if (await fs.pathExists(setupPath)) {
      let content = await fs.readFile(setupPath, 'utf8');
      content = content.replace(/name=".*"/g, `name="${projectName}"`);
      await fs.writeFile(setupPath, content);
    }
  }
  
  /**
   * 根据参数配置项目
   */
  private async configureProject(targetDir: string, projectName: string, params: PythonApiTemplateParams): Promise<void> {
    const { orm, orm_framework, web_framework, web_framework_choice, use_alembic, includeAliSms, includeAliOss } = params;
    
    // 如果不使用ORM，移除相关文件
    if (!orm) {
      const ormDirs = [
        path.join(targetDir, 'app', 'models'),
        path.join(targetDir, 'app', 'db')
      ];
      
      for (const dir of ormDirs) {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir);
        }
      }
    }
    
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
    
    // 更新requirements.txt
    await this.updateRequirements(targetDir, params);
  }
  
  /**
   * 更新requirements.txt
   */
  private async updateRequirements(targetDir: string, params: PythonApiTemplateParams): Promise<void> {
    const { orm, orm_framework, web_framework, web_framework_choice, use_alembic, includeAliSms, includeAliOss } = params;
    const requirementsPath = path.join(targetDir, 'requirements.txt');
    
    if (await fs.pathExists(requirementsPath)) {
      let requirements = await fs.readFile(requirementsPath, 'utf8');
      const lines = requirements.split('\n');
      const newLines: string[] = [];
      
      for (const line of lines) {
        // 根据参数过滤依赖
        if (!orm && (line.includes('sqlmodel') || line.includes('sqlalchemy'))) {
          continue;
        }
        
        if (!use_alembic && line.includes('alembic')) {
          continue;
        }
        
        if (web_framework && web_framework_choice === 'flask' && line.includes('fastapi')) {
          newLines.push('flask==2.3.3');
          continue;
        }
        
        if (web_framework && web_framework_choice === 'fastapi' && line.includes('flask')) {
          newLines.push('fastapi==0.103.1');
          newLines.push('uvicorn==0.23.2');
          continue;
        }
        
        if (!includeAliSms && line.includes('aliyun-python-sdk-core')) {
          continue;
        }
        
        if (!includeAliOss && line.includes('oss2')) {
          continue;
        }
        
        newLines.push(line);
      }
      
      await fs.writeFile(requirementsPath, newLines.join('\n'));
    }
  }
  
  
  /**
   * 应用补丁
   */
  private async applyPatches(targetDir: string, params: PythonApiTemplateParams): Promise<void> {
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
