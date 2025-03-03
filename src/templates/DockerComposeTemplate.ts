import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';
import templatesConfig from './templates.json' with { type: 'json' };
import yaml from 'js-yaml';

/**
 * Docker Compose模板参数
 */
interface DockerComposeTemplateParams extends TemplateParams {
  selectedServices: string[];
}

/**
 * Docker Compose项目模板
 */
export class DockerComposeTemplate extends BaseTemplate {
  constructor() {
    super(
      'docker-compose',
      'Docker Compose',
      'Docker Compose项目模板，用于创建多容器Docker应用',
      `  docker-compose up -d  # 启动所有服务
  docker-compose ps     # 查看服务状态
  docker-compose logs   # 查看服务日志
  docker-compose down   # 停止并移除所有服务`
    );
  }

  /**
   * 获取Docker Compose模板特定参数
   */
  async getParameters(): Promise<DockerComposeTemplateParams> {
    // 克隆模板到临时目录以读取docker-compose.yml
    const tempDir = path.join(process.cwd(), '.temp-docker-compose-template');
    const templateRepo = this.getTemplateRepo();
    
    try {
      // 确保临时目录不存在
      await fs.remove(tempDir);
      
      // 克隆模板仓库到临时目录
      execSync(`git clone ${templateRepo} ${tempDir}`, { stdio: 'ignore' });
      
      // 读取docker-compose.yml文件
      const composeFilePath = path.join(tempDir, 'docker-compose.yml');
      
      if (!await fs.pathExists(composeFilePath)) {
        throw new Error('模板中没有找到docker-compose.yml文件');
      }
      
      const composeFileContent = await fs.readFile(composeFilePath, 'utf8');
      const composeConfig = yaml.load(composeFileContent) as any;
      
      if (!composeConfig.services || typeof composeConfig.services !== 'object') {
        throw new Error('docker-compose.yml中没有找到有效的services配置');
      }
      
      // 获取所有服务名称
      const serviceNames = Object.keys(composeConfig.services);
      
      if (serviceNames.length === 0) {
        throw new Error('docker-compose.yml中没有定义任何服务');
      }
      
      // 创建服务选项
      const serviceChoices = serviceNames.map(name => ({
        name,
        value: name,
        short: name
      }));

      // 让用户选择要保留的服务
      const servicesAnswer = await inquirer.prompt<{ selectedServices: string[] }>([
        {
          type: 'checkbox',
          name: 'selectedServices',
          message: '请选择要保留的服务 (空格选择/取消，回车确认):',
          choices: serviceChoices,
          default: serviceNames, // 默认全选
          pageSize: 10
        }
      ]);
      
      // 清理临时目录
      await fs.remove(tempDir);
      
      return {
        selectedServices: servicesAnswer.selectedServices
      };
    } catch (error) {
      // 确保清理临时目录
      await fs.remove(tempDir);
      throw error;
    }
  }

  /**
   * 获取模板仓库地址
   */
  private getTemplateRepo(): string {
    const templateConfig = templatesConfig['docker-compose'];
    return templateConfig?.default || 'https://github.com/dongjak-templates/docker-compose-template.git';
  }

  /**
   * 初始化Docker Compose模板
   */
  async initialize(targetDir: string, projectName: string, params: DockerComposeTemplateParams): Promise<void> {
    const { selectedServices } = params;

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

    // 处理docker-compose.yml文件，移除未选中的服务
    await this.processDockerComposeFile(targetDir, selectedServices);

    // 渲染所有模板文件
    console.log('正在渲染模板文件...');
    await super.renderTemplateFiles(targetDir, {
      projectName,
      // 添加一些常用的派生变量
      projectNameSnakeCase: projectName.replace(/-/g, '_').toLowerCase(),
      currentYear: new Date().getFullYear()
    });

    console.log('项目初始化完成');
  }

  /**
   * 处理docker-compose.yml文件，移除未选中的服务
   */
  private async processDockerComposeFile(targetDir: string, selectedServices: string[]): Promise<void> {
    const composeFilePath = path.join(targetDir, 'docker-compose.yml');
    
    if (!await fs.pathExists(composeFilePath)) {
      console.warn('没有找到docker-compose.yml文件，跳过处理');
      return;
    }
    
    try {
      // 读取docker-compose.yml
      const composeFileContent = await fs.readFile(composeFilePath, 'utf8');
      const composeConfig = yaml.load(composeFileContent) as any;
      
      if (!composeConfig.services || typeof composeConfig.services !== 'object') {
        console.warn('docker-compose.yml中没有找到有效的services配置，跳过处理');
        return;
      }
      
      // 获取所有服务名称
      const allServiceNames = Object.keys(composeConfig.services);
      
      // 移除未选中的服务
      for (const serviceName of allServiceNames) {
        if (!selectedServices.includes(serviceName)) {
          delete composeConfig.services[serviceName];
        }
      }
      
      // 将修改后的配置写回文件
      const updatedComposeContent = yaml.dump(composeConfig, {
        lineWidth: -1, // 不限制行宽
        noRefs: true,  // 不使用引用
        quotingType: '"' // 使用双引号
      });
      
      await fs.writeFile(composeFilePath, updatedComposeContent, 'utf8');
      console.log(`已更新docker-compose.yml，保留了以下服务: ${selectedServices.join(', ')}`);
    } catch (error) {
      console.error(`处理docker-compose.yml文件时出错: ${error}`);
      throw error;
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
