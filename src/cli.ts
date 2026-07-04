#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  browsePage,
  browsePageHelp,
  browsePageSummary
} from './commands/browsePage.ts';
import {
  browsePageChanges,
  browsePageChangesHelp,
  browsePageChangesSummary
} from './commands/browsePageChanges.ts';
import {
  browseRelatedPages,
  browseRelatedPagesHelp,
  browseRelatedPagesSummary
} from './commands/browseRelatedPages.ts';
import {
  downloadFile,
  downloadFileHelp,
  downloadFileSummary
} from './commands/downloadFile.ts';
import {
  list1hopLinks,
  list1hopLinksHelp,
  list1hopLinksSummary
} from './commands/list1hopLinks.ts';
import {
  list2hopLinks,
  list2hopLinksHelp,
  list2hopLinksSummary
} from './commands/list2hopLinks.ts';
import {
  listPages,
  listPagesHelp,
  listPagesSummary
} from './commands/listPages.ts';
import {
  listProjects,
  listProjectsHelp,
  listProjectsSummary
} from './commands/listProjects.ts';
import { login, loginHelp, loginSummary } from './commands/login.ts';
import {
  previewEdit,
  previewEditHelp,
  previewEditSummary
} from './commands/previewEdit.ts';
import {
  readFileInfo,
  readFileInfoHelp,
  readFileInfoSummary
} from './commands/readFileInfo.ts';
import {
  readPage,
  readPageHelp,
  readPageSummary
} from './commands/readPage.ts';
import {
  readProjectMembers,
  readProjectMembersHelp,
  readProjectMembersSummary
} from './commands/readProjectMembers.ts';
import {
  submitEdit,
  submitEditHelp,
  submitEditSummary
} from './commands/submitEdit.ts';
import {
  search1hopLinks,
  search1hopLinksHelp,
  search1hopLinksSummary
} from './commands/search1hopLinks.ts';
import {
  search2hopLinks,
  search2hopLinksHelp,
  search2hopLinksSummary
} from './commands/search2hopLinks.ts';
import {
  searchFullText,
  searchFullTextHelp,
  searchFullTextSummary
} from './commands/searchFullText.ts';
import {
  searchVector,
  searchVectorHelp,
  searchVectorSummary
} from './commands/searchVector.ts';
import { whoami, whoamiHelp, whoamiSummary } from './commands/whoami.ts';

interface CommandSpec {
  handler: (args: string[]) => Promise<void>;
  summary: string;
  help: string;
}

const packageJsonPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json'
);
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
  version: string;
};

const commands: Record<string, CommandSpec> = {
  login: { handler: login, summary: loginSummary, help: loginHelp },
  whoami: { handler: whoami, summary: whoamiSummary, help: whoamiHelp },
  listProjects: {
    handler: listProjects,
    summary: listProjectsSummary,
    help: listProjectsHelp
  },
  browsePage: {
    handler: browsePage,
    summary: browsePageSummary,
    help: browsePageHelp
  },
  browsePageChanges: {
    handler: browsePageChanges,
    summary: browsePageChangesSummary,
    help: browsePageChangesHelp
  },
  browseRelatedPages: {
    handler: browseRelatedPages,
    summary: browseRelatedPagesSummary,
    help: browseRelatedPagesHelp
  },
  readPage: { handler: readPage, summary: readPageSummary, help: readPageHelp },
  readFileInfo: {
    handler: readFileInfo,
    summary: readFileInfoSummary,
    help: readFileInfoHelp
  },
  downloadFile: {
    handler: downloadFile,
    summary: downloadFileSummary,
    help: downloadFileHelp
  },
  readProjectMembers: {
    handler: readProjectMembers,
    summary: readProjectMembersSummary,
    help: readProjectMembersHelp
  },
  listPages: {
    handler: listPages,
    summary: listPagesSummary,
    help: listPagesHelp
  },
  list1hopLinks: {
    handler: list1hopLinks,
    summary: list1hopLinksSummary,
    help: list1hopLinksHelp
  },
  list2hopLinks: {
    handler: list2hopLinks,
    summary: list2hopLinksSummary,
    help: list2hopLinksHelp
  },
  searchVector: {
    handler: searchVector,
    summary: searchVectorSummary,
    help: searchVectorHelp
  },
  searchFullText: {
    handler: searchFullText,
    summary: searchFullTextSummary,
    help: searchFullTextHelp
  },
  search1hopLinks: {
    handler: search1hopLinks,
    summary: search1hopLinksSummary,
    help: search1hopLinksHelp
  },
  search2hopLinks: {
    handler: search2hopLinks,
    summary: search2hopLinksSummary,
    help: search2hopLinksHelp
  },
  previewEdit: {
    handler: previewEdit,
    summary: previewEditSummary,
    help: previewEditHelp
  },
  submitEdit: {
    handler: submitEdit,
    summary: submitEditSummary,
    help: submitEditHelp
  }
};

const renderTopLevelHelp = (): string => {
  const nameWidth = Math.max(...Object.keys(commands).map(n => n.length));
  const lines = [
    `cosense v${version} - Cosenseのページを読み・調べ・編集するCLI`,
    '',
    'Usage:',
    '  cosense <command> [args...]',
    '  cosense <command> --help    個別コマンドの詳細を表示',
    '  cosense --help              このヘルプを表示',
    '  cosense --version           バージョンを表示',
    '',
    'Commands:'
  ];
  for (const [name, { summary }] of Object.entries(commands)) {
    lines.push(`  ${name.padEnd(nameWidth)}  ${summary}`);
  }
  return lines.join('\n');
};

const [, , command, ...rest] = process.argv;

if (command === '--help') {
  process.stdout.write(`${renderTopLevelHelp()}\n`);
  process.exit(0);
}

if (command === '--version') {
  process.stdout.write(`cosense v${version}\n`);
  process.exit(0);
}

const spec = command ? commands[command] : undefined;
if (!spec) {
  process.stderr.write(
    `invalid command${command ? `: ${command}` : ''}\n` +
      'See `cosense --help` for usage.\n'
  );
  process.exit(2);
}

if (rest.includes('--help')) {
  process.stdout.write(`${spec.help}\n`);
  process.exit(0);
}

try {
  await spec.handler(rest);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
