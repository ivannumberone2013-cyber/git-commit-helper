#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

// Цвета для терминала
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Типы коммитов по Conventional Commits
const COMMIT_TYPES = {
  feat: 'новая функциональность',
  fix: 'исправление бага',
  docs: 'изменения в документации',
  style: 'форматирование кода',
  refactor: 'рефакторинг',
  test: 'добавление тестов',
  chore: 'обновление зависимостей, конфигурации'
};

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
}

function getGitStatus() {
  const status = execCommand('git status --porcelain');
  if (!status) {
    console.log(`${colors.red}Нет изменений для коммита${colors.reset}`);
    process.exit(1);
  }
  return status;
}

function analyzeChanges(status) {
  const lines = status.split('\n');
  const changes = {
    added: [],
    modified: [],
    deleted: [],
    renamed: []
  };

  lines.forEach(line => {
    const [statusCode, ...filePathParts] = line.trim().split(/\s+/);
    const filePath = filePathParts.join(' ');

    if (statusCode.includes('A')) changes.added.push(filePath);
    else if (statusCode.includes('M')) changes.modified.push(filePath);
    else if (statusCode.includes('D')) changes.deleted.push(filePath);
    else if (statusCode.includes('R')) changes.renamed.push(filePath);
  });

  return changes;
}

function suggestCommitType(changes) {
  // Простая эвристика для определения типа коммита
  if (changes.added.length > 0) {
    const hasTests = changes.added.some(f => f.includes('test') || f.includes('spec'));
    if (hasTests) return 'test';

    const hasDocs = changes.added.some(f => f.includes('.md') || f.includes('README'));
    if (hasDocs) return 'docs';

    return 'feat';
  }

  if (changes.deleted.length > 0) return 'refactor';

  if (changes.modified.length > 0) {
    const hasDocs = changes.modified.some(f => f.includes('.md') || f.includes('README'));
    if (hasDocs) return 'docs';

    const hasPackage = changes.modified.some(f => f.includes('package.json') || f.includes('package-lock.json'));
    if (hasPackage) return 'chore';

    return 'fix';
  }

  return 'chore';
}

function generateCommitMessage(type, changes) {
  let subject = '';

  // Генерируем краткое описание на основе изменений
  if (type === 'feat') {
    const addedFiles = changes.added.slice(0, 2).join(', ');
    subject = `add ${addedFiles}`;
  } else if (type === 'fix') {
    const modifiedFiles = changes.modified.slice(0, 2).join(', ');
    subject = `fix issues in ${modifiedFiles}`;
  } else if (type === 'docs') {
    subject = 'update documentation';
  } else if (type === 'refactor') {
    subject = 'refactor code structure';
  } else if (type === 'test') {
    subject = 'add tests';
  } else {
    subject = 'update dependencies';
  }

  return `${type}: ${subject}`;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}🚀 Git Commit Helper${colors.reset}\n`);

  // Получаем статус git
  const status = getGitStatus();
  const changes = analyzeChanges(status);

  // Показываем обнаруженные изменения
  console.log(`${colors.bright}Обнаруженные изменения:${colors.reset}`);
  if (changes.added.length > 0) {
    console.log(`  ${colors.green}+ Добавлено: ${changes.added.length} файл(ов)${colors.reset}`);
    changes.added.slice(0, 3).forEach(f => console.log(`    - ${f}`));
  }
  if (changes.modified.length > 0) {
    console.log(`  ${colors.yellow}~ Изменено: ${changes.modified.length} файл(ов)${colors.reset}`);
    changes.modified.slice(0, 3).forEach(f => console.log(`    - ${f}`));
  }
  if (changes.deleted.length > 0) {
    console.log(`  ${colors.red}- Удалено: ${changes.deleted.length} файл(ов)${colors.reset}`);
    changes.deleted.slice(0, 3).forEach(f => console.log(`    - ${f}`));
  }
  console.log();

  // Предлагаем тип коммита
  const suggestedType = suggestCommitType(changes);
  console.log(`${colors.bright}Рекомендуемый тип коммита:${colors.reset} ${colors.green}${suggestedType}${colors.reset} (${COMMIT_TYPES[suggestedType]})`);
  console.log();

  // Показываем все доступные типы
  console.log(`${colors.bright}Доступные типы:${colors.reset}`);
  Object.entries(COMMIT_TYPES).forEach(([key, desc]) => {
    const marker = key === suggestedType ? '→' : ' ';
    console.log(`  ${marker} ${colors.blue}${key}${colors.reset}: ${desc}`);
  });
  console.log();

  // Спрашиваем пользователя
  const typeAnswer = await askQuestion(`Выберите тип (Enter = ${suggestedType}): `);
  const selectedType = typeAnswer || suggestedType;

  if (!COMMIT_TYPES[selectedType]) {
    console.log(`${colors.red}Неверный тип коммита${colors.reset}`);
    process.exit(1);
  }

  // Генерируем сообщение коммита
  const generatedMessage = generateCommitMessage(selectedType, changes);
  console.log();
  console.log(`${colors.bright}Предлагаемое сообщение:${colors.reset}`);
  console.log(`  ${colors.cyan}${generatedMessage}${colors.reset}`);
  console.log();

  // Подтверждение
  const confirmAnswer = await askQuestion('Использовать это сообщение? (y/n/edit): ');

  let finalMessage = generatedMessage;

  if (confirmAnswer === 'edit' || confirmAnswer === 'e') {
    const customMessage = await askQuestion('Введите ваше сообщение: ');
    if (customMessage) {
      finalMessage = `${selectedType}: ${customMessage}`;
    }
  } else if (confirmAnswer !== 'y' && confirmAnswer !== 'yes' && confirmAnswer !== '') {
    console.log(`${colors.yellow}Коммит отменён${colors.reset}`);
    process.exit(0);
  }

  // Выполняем коммит
  try {
    execSync('git add -A', { stdio: 'inherit' });
    execSync(`git commit -m "${finalMessage}"`, { stdio: 'inherit' });
    console.log();
    console.log(`${colors.green}✓ Коммит успешно создан!${colors.reset}`);
    console.log(`${colors.bright}Сообщение:${colors.reset} ${finalMessage}`);
  } catch (error) {
    console.log(`${colors.red}Ошибка при создании коммита${colors.reset}`);
    process.exit(1);
  }
}

main();
