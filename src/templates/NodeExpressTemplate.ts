import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTemplate, TemplateParams } from './Template.js';

/**
 * Node.js Express模板参数
 */
interface NodeExpressTemplateParams extends TemplateParams {
  typescript: boolean;
  database: 'none' | 'mongodb' | 'mysql' | 'postgresql';
  authentication: boolean;
}

/**
 * Node.js Express项目模板
 */
export class NodeExpressTemplate extends BaseTemplate {
  constructor() {
    super(
      'node-express',
      'Node.js Express',
      'Node.js Express后端项目模板',
      `  npm run dev   # 启动开发服务器
  npm start     # 启动生产服务器
  npm run build # 构建生产版本`
    );
  }
  
  /**
   * 获取Node.js Express模板特定参数
   */
  async getParameters(): Promise<NodeExpressTemplateParams> {
    const answers = await inquirer.prompt<NodeExpressTemplateParams>([
      {
        type: 'confirm',
        name: 'typescript',
        message: '是否使用TypeScript?',
        default: true
      },
      {
        type: 'list',
        name: 'database',
        message: '选择数据库:',
        choices: [
          { name: '不使用数据库', value: 'none' },
          { name: 'MongoDB', value: 'mongodb' },
          { name: 'MySQL', value: 'mysql' },
          { name: 'PostgreSQL', value: 'postgresql' }
        ],
        default: 'mongodb'
      },
      {
        type: 'confirm',
        name: 'authentication',
        message: '是否添加用户认证功能?',
        default: false
      }
    ]);
    
    return answers;
  }
  
  /**
   * 初始化Node.js Express模板
   */
  async initialize(targetDir: string, projectName: string, params: NodeExpressTemplateParams): Promise<void> {
    const { typescript, database, authentication } = params;
    
    // 创建package.json
    const packageJson: Record<string, any> = {
      name: projectName,
      version: '1.0.0',
      description: 'Node.js Express项目',
      main: typescript ? 'dist/index.js' : 'src/index.js',
      scripts: {
        dev: typescript ? 'ts-node-dev --respawn src/index.ts' : 'nodemon src/index.js',
        start: typescript ? 'node dist/index.js' : 'node src/index.js',
        build: typescript ? 'tsc' : 'echo "No build step required"',
        test: 'jest'
      },
      keywords: ['express', 'node', 'api'],
      author: '',
      license: 'ISC',
      dependencies: {
        express: '^4.18.2',
        'cors': '^2.8.5',
        'dotenv': '^16.0.3',
        'helmet': '^6.0.1',
        'morgan': '^1.10.0'
      },
      devDependencies: {
        'jest': '^29.5.0',
        'nodemon': '^2.0.22'
      }
    };
    
    // 添加TypeScript相关依赖
    if (typescript) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'typescript': '^5.0.4',
        '@types/node': '^18.16.0',
        '@types/express': '^4.17.17',
        '@types/cors': '^2.8.13',
        '@types/morgan': '^1.9.4',
        '@types/jest': '^29.5.1',
        'ts-node-dev': '^2.0.0',
        'ts-jest': '^29.1.0'
      };
    }
    
    // 添加数据库相关依赖
    if (database === 'mongodb') {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        'mongoose': '^7.1.0'
      };
      if (typescript) {
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          '@types/mongoose': '^5.11.97'
        };
      }
    } else if (database === 'mysql') {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        'mysql2': '^3.3.0',
        'sequelize': '^6.31.1'
      };
      if (typescript) {
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          '@types/sequelize': '^4.28.15'
        };
      }
    } else if (database === 'postgresql') {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        'pg': '^8.10.0',
        'pg-hstore': '^2.3.4',
        'sequelize': '^6.31.1'
      };
      if (typescript) {
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          '@types/pg': '^8.6.6',
          '@types/sequelize': '^4.28.15'
        };
      }
    }
    
    // 添加认证相关依赖
    if (authentication) {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        'jsonwebtoken': '^9.0.0',
        'bcrypt': '^5.1.0'
      };
      if (typescript) {
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          '@types/jsonwebtoken': '^9.0.2',
          '@types/bcrypt': '^5.0.0'
        };
      }
    }
    
    // 写入package.json
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // 创建目录结构
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'controllers'));
    await fs.ensureDir(path.join(targetDir, 'src', 'routes'));
    await fs.ensureDir(path.join(targetDir, 'src', 'middlewares'));
    
    if (database !== 'none') {
      await fs.ensureDir(path.join(targetDir, 'src', 'models'));
      await fs.ensureDir(path.join(targetDir, 'src', 'config'));
    }
    
    if (authentication) {
      await fs.ensureDir(path.join(targetDir, 'src', 'services'));
    }
    
    // 创建.env文件
    const envContent = `NODE_ENV=development
PORT=3000
${database === 'mongodb' ? 'MONGODB_URI=mongodb://localhost:27017/' + projectName : ''}
${database === 'mysql' ? 'MYSQL_URI=mysql://root:password@localhost:3306/' + projectName : ''}
${database === 'postgresql' ? 'POSTGRES_URI=postgresql://postgres:password@localhost:5432/' + projectName : ''}
${authentication ? 'JWT_SECRET=your-secret-key\nJWT_EXPIRES_IN=90d' : ''}
`;
    
    await fs.writeFile(path.join(targetDir, '.env'), envContent);
    await fs.writeFile(path.join(targetDir, '.env.example'), envContent);
    
    // 创建.gitignore
    const gitignoreContent = `node_modules
.env
dist
coverage
`;
    await fs.writeFile(path.join(targetDir, '.gitignore'), gitignoreContent);
    
    // 创建TypeScript配置文件
    if (typescript) {
      const tsConfigContent = {
        compilerOptions: {
          target: 'es2019',
          module: 'commonjs',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', '**/*.test.ts']
      };
      
      await fs.writeFile(
        path.join(targetDir, 'tsconfig.json'),
        JSON.stringify(tsConfigContent, null, 2)
      );
    }
    
    // 创建主文件
    const indexFileExt = typescript ? 'ts' : 'js';
    const indexContent = `${typescript ? 'import express, { Express, Request, Response } from \'express\';' : 'const express = require(\'express\');'}
${typescript ? 'import dotenv from \'dotenv\';' : 'const dotenv = require(\'dotenv\');'}
${typescript ? 'import cors from \'cors\';' : 'const cors = require(\'cors\');'}
${typescript ? 'import helmet from \'helmet\';' : 'const helmet = require(\'helmet\');'}
${typescript ? 'import morgan from \'morgan\';' : 'const morgan = require(\'morgan\');'}
${database === 'mongodb' && typescript ? 'import mongoose from \'mongoose\';' : database === 'mongodb' ? 'const mongoose = require(\'mongoose\');' : ''}

dotenv.config();

${typescript ? 'const app: Express = express();' : 'const app = express();'}
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

${database === 'mongodb' ? `// 连接MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB连接成功'))
  .catch((err${typescript ? ': Error' : ''}) => console.error('MongoDB连接失败:', err));` : ''}

// 路由
app.get('/', (${typescript ? 'req: Request, res: Response' : 'req, res'}) => {
  res.json({ message: 'API运行正常!' });
});

// 启动服务器
app.listen(port, () => {
  console.log(\`服务器运行在 http://localhost:\${port}\`);
});
`;
    
    await fs.writeFile(path.join(targetDir, 'src', `index.${indexFileExt}`), indexContent);
    
    // 创建README.md
    const readmeContent = `# ${projectName}

这个项目是使用 [cruldra-create-project](https://github.com/cruldra/create-project) 创建的Node.js Express项目。

## 技术栈

- Node.js + Express ${typescript ? '+ TypeScript' : ''}
- ${database === 'none' ? '无数据库' : database === 'mongodb' ? 'MongoDB' : database === 'mysql' ? 'MySQL' : 'PostgreSQL'}
- ${authentication ? '包含用户认证' : '无用户认证'}

## 可用脚本

在项目目录中，你可以运行：

### \`npm run dev\`

在开发模式下运行应用，支持热重载。

### \`npm start\`

在生产模式下运行应用。

### \`npm run build\`

${typescript ? '将TypeScript代码编译为JavaScript。' : '此项目不需要构建步骤。'}

### \`npm test\`

运行测试。
`;
    
    await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent);
    
    // 安装依赖
    console.log('安装依赖...');
    execSync('npm install', { stdio: 'inherit', cwd: targetDir });
  }
}
