import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';

/**
 * React模板参数
 */
interface ReactTemplateParams extends TemplateParams {
  typescript: boolean;
  cssFramework: 'none' | 'tailwind' | 'mui';
  stateManagement: 'none' | 'redux' | 'zustand';
}

/**
 * React项目模板
 */
export class ReactTemplate extends BaseTemplate {
  constructor() {
    super(
      'react',
      'React',
      'React前端项目模板',
      `  npm start     # 启动开发服务器
  npm run build  # 构建生产版本`
    );
  }
  
  /**
   * 获取React模板特定参数
   */
  async getParameters(): Promise<ReactTemplateParams> {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'typescript',
        message: '是否使用TypeScript?',
        default: true
      },
      {
        type: 'list',
        name: 'cssFramework',
        message: '选择CSS框架:',
        choices: [
          { name: '不使用CSS框架', value: 'none' },
          { name: 'Tailwind CSS', value: 'tailwind' },
          { name: 'Material-UI', value: 'mui' }
        ],
        default: 'tailwind'
      },
      {
        type: 'list',
        name: 'stateManagement',
        message: '选择状态管理库:',
        choices: [
          { name: '不使用状态管理库', value: 'none' },
          { name: 'Redux Toolkit', value: 'redux' },
          { name: 'Zustand', value: 'zustand' }
        ],
        default: 'none'
      }
    ]);
    
    return answers;
  }
  
  /**
   * 初始化React模板
   */
  async initialize(targetDir: string, projectName: string, params: ReactTemplateParams): Promise<void> {
    const { typescript, cssFramework, stateManagement } = params;
    
    // 使用Create React App创建项目
    const createCommand = `npx create-react-app ${projectName} ${typescript ? '--template typescript' : ''}`;
    console.log(`执行: ${createCommand}`);
    
    try {
      // 这里我们不使用targetDir，因为create-react-app会自己创建目录
      execSync(createCommand, { stdio: 'inherit', cwd: path.dirname(targetDir) });
    } catch (error) {
      throw new Error(`创建React项目失败: ${error}`);
    }
    
    // 安装额外依赖
    const dependencies = [];
    
    // CSS框架
    if (cssFramework === 'tailwind') {
      dependencies.push('tailwindcss', 'postcss', 'autoprefixer');
    } else if (cssFramework === 'mui') {
      dependencies.push('@mui/material', '@emotion/react', '@emotion/styled');
    }
    
    // 状态管理
    if (stateManagement === 'redux') {
      dependencies.push('@reduxjs/toolkit', 'react-redux');
    } else if (stateManagement === 'zustand') {
      dependencies.push('zustand');
    }
    
    // 安装依赖
    if (dependencies.length > 0) {
      console.log(`安装额外依赖: ${dependencies.join(', ')}`);
      execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'inherit', cwd: targetDir });
    }
    
    // 配置Tailwind CSS
    if (cssFramework === 'tailwind') {
      execSync('npx tailwindcss init -p', { stdio: 'inherit', cwd: targetDir });
      
      // 创建tailwind配置
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
      
      await fs.writeFile(path.join(targetDir, 'tailwind.config.js'), tailwindConfig);
      
      // 更新CSS文件
      const cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
      
      await fs.writeFile(path.join(targetDir, 'src', 'index.css'), cssContent);
    }
    
    // 创建README.md
    const readmeContent = `# ${projectName}

这个项目是使用 [cruldra-create-project](https://github.com/cruldra/create-project) 创建的React项目。

## 技术栈

- React ${typescript ? '+ TypeScript' : ''}
- ${cssFramework === 'none' ? 'CSS' : cssFramework === 'tailwind' ? 'Tailwind CSS' : 'Material-UI'}
- ${stateManagement === 'none' ? '无状态管理库' : stateManagement === 'redux' ? 'Redux Toolkit' : 'Zustand'}

## 可用脚本

在项目目录中，你可以运行:

### \`npm start\`

在开发模式下运行应用。
打开 [http://localhost:3000](http://localhost:3000) 在浏览器中查看。

### \`npm test\`

在交互式监视模式下启动测试运行器。

### \`npm run build\`

将应用程序构建到 \`build\` 文件夹中。
`;
    
    await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent);
  }
}
