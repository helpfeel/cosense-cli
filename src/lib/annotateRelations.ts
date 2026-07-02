import { parsePageUrl } from './parseUrl.ts';
import { HttpError, requestJson } from './request.ts';
import { resolveCredential } from './settings.ts';

export type Relation = 'outgoing' | 'incoming' | 'bidirectional';

interface Link1Hop {
  titleLc?: string;
  linksLc?: string[];
  relation?: Relation;
  [key: string]: unknown;
}

interface ReadPageData {
  titleLc?: string;
  title?: string;
  linksLc?: string[];
  links?: string[];
  [key: string]: unknown;
}

interface RelatedPagesData {
  links1hop?: Link1Hop[];
  [key: string]: unknown;
}

const toTitleLc = (title: string): string =>
  title.replace(/ /g, '_').toLowerCase();

const computeRelation = (
  startLinksLcSet: Set<string>,
  startTitleLc: string,
  page: Link1Hop
): Relation => {
  const linksTo = page.titleLc ? startLinksLcSet.has(page.titleLc) : false;
  const linksFrom = page.linksLc?.includes(startTitleLc) ?? false;
  if (linksTo && linksFrom) return 'bidirectional';
  if (linksTo) return 'outgoing';
  return 'incoming';
};

export const fetchRelatedPagesWithRelations = async (
  url: string,
  query?: string,
  or?: boolean
): Promise<RelatedPagesData> => {
  const { origin, projectName, encodedTitle } = parsePageUrl(url);
  let queryParam = query ? `?search=${encodeURIComponent(query)}` : '';
  if (or) queryParam += queryParam ? '&op=or' : '?op=or';
  const startPageUrl = `${origin}/api/pages/v2/${projectName}/${encodedTitle}`;
  const relatedUrl = `${startPageUrl}/links1hop${queryParam}`;
  const credential = resolveCredential(origin, projectName);

  const [startPageResult, relatedResult] = await Promise.allSettled([
    requestJson(startPageUrl, { credential }),
    requestJson(relatedUrl, { credential })
  ]);

  // links1hop endpoint must succeed (it has its own backlinks-only fallback for non-existent pages)
  if (relatedResult.status === 'rejected') {
    throw relatedResult.reason;
  }
  const related = relatedResult.value as RelatedPagesData;

  // readPage returns 404 only when the page is missing and has no backlinks (a page with backlinks
  // is auto-generated as an empty page and returned with 200). Treat that 404 as empty linksLc so
  // all entries are classified as 'incoming'. Other failures (5xx, network, auth) must propagate
  // so we never silently mislabel relations.
  let startTitleLc: string;
  let startLinksLcSet: Set<string>;
  if (startPageResult.status === 'fulfilled') {
    const startPage = startPageResult.value as ReadPageData;
    startTitleLc =
      startPage.titleLc ?? (startPage.title ? toTitleLc(startPage.title) : '');
    startLinksLcSet = new Set<string>(
      startPage.linksLc ?? (startPage.links ?? []).map(toTitleLc)
    );
  } else if (
    startPageResult.reason instanceof HttpError &&
    startPageResult.reason.status === 404
  ) {
    startTitleLc = toTitleLc(decodeURIComponent(encodedTitle));
    startLinksLcSet = new Set<string>();
  } else {
    throw startPageResult.reason;
  }

  if (Array.isArray(related.links1hop)) {
    for (const page of related.links1hop) {
      page.relation = computeRelation(startLinksLcSet, startTitleLc, page);
    }
  }

  return related;
};
