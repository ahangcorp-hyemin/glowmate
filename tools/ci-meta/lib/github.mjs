// tools/ci-meta/lib/github.mjs
//
// GitHub REST 클라이언트.
//
// 정책 (오케스트레이터 지시 · F1 REQ-6/REQ-7 acceptance):
//   - CI 컨텍스트(GITHUB_ACTIONS=true)에서 조회 불가 → 호출자가 exit 1 로 판정한다.
//     이 모듈은 절대 "조회 실패 = 통과" 로 만들지 않는다. 실패는 throw 또는 unavailable 로 드러낸다.
//   - 로컬에서는 unavailable 을 반환하고, 호출자가 SKIPPED(local) 로 명시 출력한다.

import { readFileSync } from 'node:fs';

export class GitHubError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export const PLAN_LIMITED_TOKEN = 'PLAN_LIMITED';

/**
 * 플랜 제약으로 **기능 자체가 존재하지 않는** 경우인가.
 *
 * private + free 플랜 리포에서는 브랜치 보호·룰셋 API 가 403 과 함께
 * "Upgrade to GitHub Pro or make this repository public" 를 반환한다.
 * 이것은 "일시적 조회 실패"와 성질이 다르다 — 설정 자체가 불가능하다.
 * ⚠ 구분만 할 뿐 **통과로 바꾸지 않는다.** 계약 요구를 못 지키는 상태이므로 판정은 FAIL 그대로다.
 */
export function isPlanLimited(err) {
  if (!(err instanceof GitHubError) || err.status !== 403) return false;
  const body = String(err.body ?? '');
  return /Upgrade to GitHub Pro|make this repository public|available for repositories in the .* plan/i.test(
    body,
  );
}

class GitHubClient {
  constructor({ token, owner, repo }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  get slug() {
    return `${this.owner}/${this.repo}`;
  }

  async request(pathOrUrl, { raw = false, allow404 = false } = {}) {
    const url = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `https://api.github.com${pathOrUrl}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'glowmate-ci-meta',
      },
      redirect: 'follow',
    });
    if (res.status === 404 && allow404) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new GitHubError(
        `GitHub API ${res.status} ${res.statusText} — ${url}`,
        res.status,
        body.slice(0, 800),
      );
    }
    return raw ? await res.text() : await res.json();
  }

  /** 페이지네이션 전량 수집. */
  async paginate(path, { perPage = 100, max = 1000 } = {}) {
    const out = [];
    let page = 1;
    for (;;) {
      const sep = path.includes('?') ? '&' : '?';
      const chunk = await this.request(`${path}${sep}per_page=${perPage}&page=${page}`);
      const items = Array.isArray(chunk) ? chunk : (chunk.workflow_runs ?? chunk.jobs ?? []);
      out.push(...items);
      if (items.length < perPage || out.length >= max) break;
      page += 1;
    }
    return out;
  }

  /**
   * legacy branch protection. **admin 권한**을 요구하므로 Actions 기본 GITHUB_TOKEN 으로는 403 이다.
   * 2차 원천으로만 쓴다.
   */
  branchProtection(branch) {
    return this.request(
      `/repos/${this.slug}/branches/${encodeURIComponent(branch)}/protection`,
    );
  }

  /**
   * repository ruleset — 브랜치에 적용되는 규칙 목록. **읽기 권한만으로 조회된다.**
   * 보호 설정 판정의 1차 원천이다.
   */
  branchRules(branch) {
    return this.request(
      `/repos/${this.slug}/rules/branches/${encodeURIComponent(branch)}`,
      { allow404: true },
    );
  }

  workflowRunsForBranch(branch) {
    return this.paginate(
      `/repos/${this.slug}/actions/runs?branch=${encodeURIComponent(branch)}`,
      { perPage: 50, max: 200 },
    );
  }

  run(runId) {
    return this.request(`/repos/${this.slug}/actions/runs/${runId}`);
  }

  runJobs(runId) {
    return this.paginate(`/repos/${this.slug}/actions/runs/${runId}/jobs?filter=latest`, {
      perPage: 100,
      max: 300,
    });
  }

  jobLog(jobId) {
    return this.request(`/repos/${this.slug}/actions/jobs/${jobId}/logs`, { raw: true });
  }

  contentSha(path, ref) {
    return this.request(
      `/repos/${this.slug}/contents/${path}?ref=${encodeURIComponent(ref)}`,
      { allow404: true },
    );
  }

  pullReviews(number) {
    return this.paginate(`/repos/${this.slug}/pulls/${number}/reviews`);
  }

  pull(number) {
    return this.request(`/repos/${this.slug}/pulls/${number}`);
  }

  /** 리포지토리 collaborator 전량 (permissions 포함). */
  collaborators() {
    return this.paginate(`/repos/${this.slug}/collaborators?affiliation=all`);
  }

  /** 팀 소유자(@org/team)가 특정 사용자를 포함하는지. null = 비멤버. */
  teamMembership(org, teamSlug, username) {
    return this.request(
      `/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(teamSlug)}/memberships/${encodeURIComponent(username)}`,
      { allow404: true },
    );
  }
}

/**
 * 환경에서 클라이언트를 구성한다.
 * @returns {{available:true, client:GitHubClient}|{available:false, reason:string}}
 */
export function createGitHub() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const slug = process.env.GITHUB_REPOSITORY;
  if (!token) {
    return { available: false, reason: 'GITHUB_TOKEN / GH_TOKEN 환경변수가 없다' };
  }
  if (!slug || !slug.includes('/')) {
    return { available: false, reason: 'GITHUB_REPOSITORY 환경변수가 없거나 형식이 아니다' };
  }
  const [owner, repo] = slug.split('/');
  return { available: true, client: new GitHubClient({ token, owner, repo }) };
}

/** Actions 이벤트 페이로드 (없으면 null). */
export function eventPayload() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    // 페이로드가 있는데 못 읽는 것은 환경 이상이다. 조용히 null 로 만들지 않는다.
    throw new GitHubError(`GITHUB_EVENT_PATH(${p}) 를 읽을 수 없다: ${err.message}`, 0, '');
  }
}

/** 현재 PR 번호 (판정 불가 시 null). */
export function currentPullNumber() {
  const payload = eventPayload();
  if (payload?.pull_request?.number) return payload.pull_request.number;
  if (payload?.number) return payload.number;
  const m = /^refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF ?? '');
  return m ? Number(m[1]) : null;
}

/** 현재 PR 작성자 로그인 (판정 불가 시 null). */
export function currentPullAuthor() {
  const payload = eventPayload();
  return (
    payload?.pull_request?.user?.login ??
    process.env.GITHUB_ACTOR ??
    null
  );
}

/** 보호 브랜치 이름. */
export function baseBranchName() {
  return process.env.GITHUB_BASE_REF || 'main';
}
