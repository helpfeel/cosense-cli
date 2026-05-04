#!/usr/bin/env node
import {
  browseRelatedPages,
  browseRelatedPagesHelp,
  browseRelatedPagesSummary
} from './commands/browseRelatedPages.ts';
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

interface CommandSpec {
  handler: (args: string[]) => Promise<void>;
  summary: string;
  help: string;
}

const commands: Record<string, CommandSpec> = {
  browseRelatedPages: {
    handler: browseRelatedPages,
    summary: browseRelatedPagesSummary,
    help: browseRelatedPagesHelp
  },
  readPage: { handler: readPage, summary: readPageSummary, help: readPageHelp },
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
  }
};

const renderTopLevelHelp = (): string => {
  const nameWidth = Math.max(...Object.keys(commands).map(n => n.length));
  const lines = [
    'cosense - Cosense（旧Scrapbox）のページを読み・調べるCLI',
    '',
    'Usage:',
    '  cosense <command> [args...]',
    '  cosense <command> --help    個別コマンドの詳細を表示',
    '  cosense --help              このヘルプを表示',
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

const spec = command ? commands[command] : undefined;
if (!spec) {
  process.stderr.write(
    `Usage: cosense <${Object.keys(commands).join('|')}> ...\n` +
      '       cosense --help\n'
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
