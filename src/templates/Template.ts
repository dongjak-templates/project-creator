/**
 * 模板参数类型
 */
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
}
