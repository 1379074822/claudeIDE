const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', 'build');

// 确保 build 目录存在
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

console.log('正在准备图标文件...');
console.log('请确保您有以下图标文件:');
console.log('  - public/icon.png (至少 512x512 像素, 用于生成其他格式)');
console.log('  - 或直接提供 build/icon.ico (Windows)');
console.log('  - 或直接提供 build/icon.icns (macOS)');