import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';

/**
 * Vue模板参数
 */
interface VueTemplateParams extends TemplateParams {
  version: 'vue2' | 'vue3';
  cssFramework: 'none' | 'tailwind' | 'vuetify';
  stateManagement: 'none' | 'pinia' | 'vuex';
}

/**
 * Vue项目模板
 */
export class VueTemplate extends BaseTemplate {
  constructor() {
    super(
      'vue',
      'Vue',
      'Vue前端项目模板',
      `  npm run dev   # 启动开发服务器
  npm run build # 构建生产版本`
    );
  }
  
  /**
   * 获取Vue模板特定参数
   */
  async getParameters(): Promise<VueTemplateParams> {
    const answers = await inquirer.prompt<VueTemplateParams>([
      {
        type: 'list',
        name: 'version',
        message: '选择Vue版本:',
        choices: [
          { name: 'Vue 3', value: 'vue3' },
          { name: 'Vue 2', value: 'vue2' }
        ],
        default: 'vue3'
      },
      {
        type: 'list',
        name: 'cssFramework',
        message: '选择CSS框架:',
        choices: [
          { name: '不使用CSS框架', value: 'none' },
          { name: 'Tailwind CSS', value: 'tailwind' },
          { name: 'Vuetify', value: 'vuetify' }
        ],
        default: 'tailwind'
      },
      {
        type: 'list',
        name: 'stateManagement',
        message: '选择状态管理库:',
        choices: (answers: { version: 'vue2' | 'vue3' }) => {
          if (answers.version === 'vue3') {
            return [
              { name: '不使用状态管理库', value: 'none' },
              { name: 'Pinia', value: 'pinia' }
            ];
          } else {
            return [
              { name: '不使用状态管理库', value: 'none' },
              { name: 'Vuex', value: 'vuex' }
            ];
          }
        },
        default: (answers: { version: 'vue2' | 'vue3' }) => answers.version === 'vue3' ? 'pinia' : 'vuex'
      }
    ]);
    
    return answers;
  }
  
  /**
   * 初始化Vue模板
   */
  async initialize(targetDir: string, projectName: string, params: VueTemplateParams): Promise<void> {
    const { version, cssFramework, stateManagement } = params;
    
    // 使用Vue CLI创建项目
    let createCommand = '';
    
    if (version === 'vue3') {
      // Vue 3使用create-vue (Vite)
      createCommand = `npm create vue@latest ${projectName} -- --typescript --router --eslint-with-prettier`;
      if (stateManagement === 'pinia') {
        createCommand += ' --pinia';
      }
    } else {
      // Vue 2使用Vue CLI
      createCommand = `npx @vue/cli create ${projectName} -m npm -p typescript,router,vuex,eslint,prettier`;
    }
    
    console.log(`执行: ${createCommand}`);
    
    try {
      // 这里我们不使用targetDir，因为vue cli会自己创建目录
      execSync(createCommand, { stdio: 'inherit', cwd: path.dirname(targetDir) });
    } catch (error) {
      throw new Error(`创建Vue项目失败: ${error}`);
    }
    
    // 安装额外依赖
    const dependencies = [];
    
    // CSS框架
    if (cssFramework === 'tailwind') {
      dependencies.push('tailwindcss', 'postcss', 'autoprefixer');
    } else if (cssFramework === 'vuetify') {
      if (version === 'vue3') {
        dependencies.push('vuetify@next', 'sass');
      } else {
        dependencies.push('vuetify', 'sass', 'sass-loader', 'deepmerge');
      }
    }
    
    // 安装依赖
    if (dependencies.length > 0) {
      console.log(`安装额外依赖: ${dependencies.join(', ')}`);
      execSync(`npm install --save ${dependencies.join(' ')}`, { stdio: 'inherit', cwd: targetDir });
    }
    
    // 配置Tailwind CSS
    if (cssFramework === 'tailwind') {
      execSync('npx tailwindcss init -p', { stdio: 'inherit', cwd: targetDir });
      
      // 创建tailwind配置
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
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
      
      // Vue 3和Vue 2的CSS文件位置可能不同
      const cssFiles = ['src/assets/main.css', 'src/assets/css/main.css', 'src/assets/styles/main.css'];
      for (const cssFile of cssFiles) {
        const fullPath = path.join(targetDir, cssFile);
        if (await fs.pathExists(fullPath)) {
          await fs.writeFile(fullPath, cssContent);
          break;
        }
      }
    }
    
    // 创建/更新README.md
    const readmeContent = `# ${projectName}

这个项目是使用 [cruldra-create-project](https://github.com/cruldra/create-project) 创建的Vue项目。

## 技术栈

- ${version === 'vue3' ? 'Vue 3' : 'Vue 2'} + TypeScript
- ${cssFramework === 'none' ? '无CSS框架' : cssFramework === 'tailwind' ? 'Tailwind CSS' : 'Vuetify'}
- ${stateManagement === 'none' ? '无状态管理库' : stateManagement === 'pinia' ? 'Pinia' : 'Vuex'}

## 推荐的IDE设置

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## 可用脚本

在项目目录中，你可以运行:

### \`npm install\`

安装项目依赖。

### \`npm run dev\`

启动开发服务器。

### \`npm run build\`

构建生产版本。

### \`npm run lint\`

检查并修复代码风格问题。
`;
    
    await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent);
  }
}
