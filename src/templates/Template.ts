/**
 * 模板参数类型
 */
import fs from 'fs-extra';
import path from 'path';
import Handlebars from 'handlebars';

export type TemplateParams = Record<string, any>;

/**
 * 模板接口
 */
export interface Template {
  /**
   * 模板ID
   */
  id: string;
  
  /**
   * 模板名称
   */
  name: string;
  
  /**
   * 模板描述
   */
  description: string;
  
  /**
   * 安装后的指导说明
   */
  postInstallInstructions?: string;
  
  /**
   * 获取模板参数
   */
  getParameters(): Promise<TemplateParams>;
  
  /**
   * 初始化模板
   * @param targetDir 目标目录
   * @param projectName 项目名称
   * @param params 模板参数
   */
  initialize(targetDir: string, projectName: string, params: TemplateParams): Promise<void>;
}

/**
 * 基础模板类
 */
export abstract class BaseTemplate implements Template {
  id: string;
  name: string;
  description: string;
  postInstallInstructions?: string;
  
  constructor(id: string, name: string, description: string, postInstallInstructions?: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.postInstallInstructions = postInstallInstructions;
  }
  
  /**
   * 获取模板参数（默认为空）
   */
  async getParameters(): Promise<TemplateParams> {
    return {};
  }
  
  /**
   * 初始化模板（需要子类实现）
   */
  abstract initialize(targetDir: string, projectName: string, params: TemplateParams): Promise<void>;
  
  /**
   * 渲染目录中的所有模板文件
   * @param dir 目标目录
   * @param context 模板上下文
   */
  protected async renderTemplateFiles(dir: string, context: TemplateParams): Promise<void> {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        // 递归处理子目录
        await this.renderTemplateFiles(filePath, context);
      } else if (stats.isFile()) {
        try {
          // 读取文件内容
          const content = await fs.readFile(filePath, 'utf8');
          
          // 使用Handlebars渲染模板
          const template = Handlebars.compile(content);
          const renderedContent = template(context);
          
          // 如果内容有变化，则写回文件
          if (content !== renderedContent) {
            await fs.writeFile(filePath, renderedContent, 'utf8');
            console.log(`已渲染模板文件: ${filePath}`);
          }
        } catch (error) {
          console.warn(`渲染文件 ${filePath} 时出错: ${error}`);
        }
      }
    }
  }
}
