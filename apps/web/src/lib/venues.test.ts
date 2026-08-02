import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findVenueBySlug, listVenueSlugs, listVenues, VENUE_CATEGORY_LABELS } from './venues.ts';

/**
 * 이 테스트가 지키는 것: `/venues/[slug]` 의 generateStaticParams 전제.
 * slug 가 비어 있거나 중복되면 정적 생성 결과가 서로를 덮어써 라우트가 조용히 사라진다.
 */
test('venue slug 는 전역 유일하고 URL 세그먼트로 안전하다', () => {
  const slugs = listVenueSlugs();

  assert.ok(slugs.length >= 2, `정적 생성할 slug 가 ${String(slugs.length)}건이다 (2건 이상 필요)`);
  assert.equal(new Set(slugs).size, slugs.length, `slug 중복: ${slugs.join(', ')}`);

  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `URL 세그먼트로 쓸 수 없는 slug: ${slug}`);
  }
});

test('findVenueBySlug 는 미등록 slug 에 대해 대체값을 만들지 않는다', () => {
  const known = listVenueSlugs()[0];
  assert.ok(known !== undefined, 'listVenueSlugs 가 비어 있다');

  assert.equal(findVenueBySlug(known)?.slug, known);
  assert.equal(findVenueBySlug('존재하지-않는-업체'), undefined);
  assert.equal(findVenueBySlug(''), undefined);
});

test('모든 업체 카테고리에 표시 라벨이 있다', () => {
  for (const venue of listVenues()) {
    assert.equal(
      typeof VENUE_CATEGORY_LABELS[venue.category],
      'string',
      `라벨이 없는 카테고리: ${venue.category}`,
    );
    assert.notEqual(venue.name.trim(), '', `이름이 빈 업체: ${venue.slug}`);
  }
});
