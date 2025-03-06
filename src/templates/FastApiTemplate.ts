import inquirer from 'inquirer';
import type { Answers, Question } from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';
import templatesConfig from './templates.json' with { type: 'json' };

/**
 * FastAPI模板参数
 */
interface FastApiTemplateParams extends TemplateParams {
  databaseType: string;
  useCors: boolean;
  useDocker: boolean;
}

/**
 * FastAPI项目模板
 */
export class FastApiTemplate extends BaseTemplate {
  constructor() {
    super(
      'fastapi',
      'FastAPI',
      'FastAPI项目模板，用于创建高性能的Python Web API',
      `  cd <项目目录>
  pip install -r requirements.txt  # 安装依赖
  python main.py                   # 启动开发服务器
  # 或者使用Docker
  docker-compose up -d             # 如果启用了Docker`
    );
  }

  /**
   * 获取FastAPI模板特定参数
   */
  async getParameters(): Promise<FastApiTemplateParams> {
    // 询问用户选择数据库类型
    const databaseAnswer = await inquirer.prompt<{ databaseType: string }>([
      {
        type: 'list',
        name: 'databaseType',
        message: '请选择数据库类型:',
        choices: [
          { name: 'SQLite (轻量级本地数据库)', value: 'sqlite' },
          { name: 'PostgreSQL (推荐生产环境)', value: 'postgres' },
          { name: 'MySQL', value: 'mysql' },
          { name: '不使用数据库', value: 'none' }
        ],
        default: 'sqlite'
      }
    ] as any);

    // 询问是否启用CORS
    const corsAnswer = await inquirer.prompt<{ useCors: boolean }>([
      {
        type: 'confirm',
        name: 'useCors',
        message: '是否启用CORS (跨域资源共享)?',
        default: true
      }
    ] as any);

    // 询问是否使用Docker
    const dockerAnswer = await inquirer.prompt<{ useDocker: boolean }>([
      {
        type: 'confirm',
        name: 'useDocker',
        message: '是否使用Docker容器化应用?',
        default: true
      }
    ] as any);

    return {
      databaseType: databaseAnswer.databaseType,
      useCors: corsAnswer.useCors,
      useDocker: dockerAnswer.useDocker
    };
  }

  /**
   * 获取模板仓库地址
   */
  private getTemplateRepo(): string {
    return 'https://github.com/dongjak-templates/fastapi-template.git';
  }

  /**
   * 初始化FastAPI模板
   */
  async initialize(targetDir: string, projectName: string, params: FastApiTemplateParams): Promise<void> {
    const { databaseType, useCors, useDocker } = params;

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

    // 根据用户选择配置数据库
    await this.configureDatabaseSettings(targetDir, databaseType);

    // 配置CORS
    if (useCors) {
      await this.enableCors(targetDir);
    } else {
      await this.disableCors(targetDir);
    }

    // 配置Docker
    if (useDocker) {
      await this.configureDocker(targetDir, databaseType);
    } else {
      await this.removeDockerFiles(targetDir);
    }

    // 渲染所有模板文件
    console.log('正在渲染模板文件...');
    await super.renderTemplateFiles(targetDir, {
      projectName,
      // 添加一些常用的派生变量
      projectNameSnakeCase: projectName.replace(/-/g, '_').toLowerCase(),
      currentYear: new Date().getFullYear(),
      databaseType,
      useCors,
      useDocker
    });

    console.log('项目初始化完成');
  }

  /**
   * 配置数据库设置
   */
  private async configureDatabaseSettings(targetDir: string, databaseType: string): Promise<void> {
    const configPath = path.join(targetDir, 'app', 'core', 'config.py');
    
    if (!await fs.pathExists(configPath)) {
      console.warn('没有找到配置文件，跳过数据库配置');
      return;
    }

    try {
      let configContent = await fs.readFile(configPath, 'utf8');
      
      // 根据数据库类型修改配置
      if (databaseType === 'sqlite') {
        configContent = configContent.replace(
          /DATABASE_URL\s*=\s*.*$/m,
          'DATABASE_URL = "sqlite:///./app.db"'
        );
      } else if (databaseType === 'postgres') {
        configContent = configContent.replace(
          /DATABASE_URL\s*=\s*.*$/m,
          'DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/app"'
        );
      } else if (databaseType === 'mysql') {
        configContent = configContent.replace(
          /DATABASE_URL\s*=\s*.*$/m,
          'DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/app"'
        );
      } else if (databaseType === 'none') {
        // 如果不使用数据库，注释掉数据库相关配置
        configContent = configContent.replace(
          /(DATABASE_URL\s*=\s*.*)$/m,
          '# $1 # 未启用数据库'
        );
      }
      
      await fs.writeFile(configPath, configContent, 'utf8');
      console.log(`已配置数据库类型: ${databaseType}`);
    } catch (error) {
      console.error(`配置数据库设置时出错: ${error}`);
    }
  }

  /**
   * 启用CORS
   */
  private async enableCors(targetDir: string): Promise<void> {
    const mainPath = path.join(targetDir, 'main.py');
    
    if (!await fs.pathExists(mainPath)) {
      console.warn('没有找到main.py文件，跳过CORS配置');
      return;
    }

    try {
      let mainContent = await fs.readFile(mainPath, 'utf8');
      
      // 确保导入了CORS
      if (!mainContent.includes('from fastapi.middleware.cors import CORSMiddleware')) {
        mainContent = mainContent.replace(
          /from fastapi import FastAPI/,
          'from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware'
        );
      }
      
      // 添加CORS中间件配置
      if (!mainContent.includes('app.add_middleware(CORSMiddleware')) {
        mainContent = mainContent.replace(
          /app = FastAPI\(\)/,
          `app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境中应该限制
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
)`
        );
      }
      
      await fs.writeFile(mainPath, mainContent, 'utf8');
      console.log('已启用CORS');
    } catch (error) {
      console.error(`启用CORS时出错: ${error}`);
    }
  }

  /**
   * 禁用CORS
   */
  private async disableCors(targetDir: string): Promise<void> {
    const mainPath = path.join(targetDir, 'main.py');
    
    if (!await fs.pathExists(mainPath)) {
      console.warn('没有找到main.py文件，跳过CORS配置');
      return;
    }

    try {
      let mainContent = await fs.readFile(mainPath, 'utf8');
      
      // 移除CORS中间件配置
      mainContent = mainContent.replace(
        /# 配置CORS\napp\.add_middleware\(\n\s*CORSMiddleware,[\s\S]*?\)/,
        ''
      );
      
      // 移除CORS导入
      mainContent = mainContent.replace(
        /from fastapi\.middleware\.cors import CORSMiddleware\n/,
        ''
      );
      
      await fs.writeFile(mainPath, mainContent, 'utf8');
      console.log('已禁用CORS');
    } catch (error) {
      console.error(`禁用CORS时出错: ${error}`);
    }
  }

  /**
   * 配置Docker
   */
  private async configureDocker(targetDir: string, databaseType: string): Promise<void> {
    const dockerComposePath = path.join(targetDir, 'docker-compose.yml');
    
    if (!await fs.pathExists(dockerComposePath)) {
      console.warn('没有找到docker-compose.yml文件，跳过Docker配置');
      return;
    }

    try {
      let dockerComposeContent = await fs.readFile(dockerComposePath, 'utf8');
      
      // 根据数据库类型修改docker-compose.yml
      if (databaseType === 'none') {
        // 如果不使用数据库，移除数据库服务
        dockerComposeContent = dockerComposeContent.replace(
          /\s+db:[\s\S]*?(?=\n\s*\w+:|$)/,
          ''
        );
      } else if (databaseType === 'postgres') {
        // 确保使用PostgreSQL
        if (!dockerComposeContent.includes('postgres:')) {
          dockerComposeContent = dockerComposeContent.replace(
            /\s+db:[\s\S]*?(?=\n\s*\w+:|$)/,
            `
  db:
    image: postgres:14
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=app
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`
          );
        }
      } else if (databaseType === 'mysql') {
        // 确保使用MySQL
        if (!dockerComposeContent.includes('mysql:')) {
          dockerComposeContent = dockerComposeContent.replace(
            /\s+db:[\s\S]*?(?=\n\s*\w+:|$)/,
            `
  db:
    image: mysql:8
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - MYSQL_DATABASE=app
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
`
          );
        }
      }
      
      await fs.writeFile(dockerComposePath, dockerComposeContent, 'utf8');
      console.log(`已配置Docker，数据库类型: ${databaseType}`);
    } catch (error) {
      console.error(`配置Docker时出错: ${error}`);
    }
  }

  /**
   * 移除Docker文件
   */
  private async removeDockerFiles(targetDir: string): Promise<void> {
    try {
      // 移除Docker相关文件
      const dockerFiles = [
        path.join(targetDir, 'Dockerfile'),
        path.join(targetDir, 'docker-compose.yml'),
        path.join(targetDir, '.dockerignore')
      ];
      
      for (const file of dockerFiles) {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
          console.log(`已移除: ${file}`);
        }
      }
      
      console.log('已移除所有Docker相关文件');
    } catch (error) {
      console.error(`移除Docker文件时出错: ${error}`);
    }
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
