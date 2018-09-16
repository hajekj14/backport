import {
  GithubQuery,
  GithubCommit,
  PullRequest,
  Commit,
  GithubIssue,
  GithubPullRequestPayload,
  GithubIssues,
  GithubApiError
} from '../types/types';

import axios, { AxiosResponse } from 'axios';
import querystring from 'querystring';
import get from 'lodash.get';
import { HandledError } from './errors';

let accessToken: string;
let userName: string;
function getCommitMessage(commit: any) {
  let msg = "";
  if (commit.author.user) {
    msg += commit.author.user.username + "@";
  }
  msg += new Date(Date.parse(commit.date)).toLocaleString() + " - " + commit.message.split('\n')[0].trim() + " - " + commit.hash.substr(0, 7);
  return msg;
}

export async function getCommits(
  owner: string,
  repoName: string,
  author: string | null,
  page?: any
): Promise<any[]> {

  const query: GithubQuery = {
    access_token: accessToken,
    per_page: 20
  };

  if (author) {
    query.author = author;
    query.per_page = 5;
  }

  try {
    /*
      const res: AxiosResponse<GithubCommit[]> = await axios(
        `https://api.github.com/repos/${owner}/${repoName}/commits?${querystring.stringify(
          query
        )}`
      );
      */
    const commitsUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repoName}/commits` + (page ? '?page=' + page : '');
    const res: AxiosResponse<GithubCommit[]> = await axios({
      url: commitsUrl,
      auth: {
        username: userName,
        password: query.access_token
      }
    });

    if (author !== null) {
      res.data.values = (res.data.values as any).filter(commit => {
        if (!commit.author.user) {
          return false;
        } else {
          if (commit.author.user.username === author) {
            return true;
          }
          return false;
        }
      });
    }

    if ((res.data as any).next) {
      (res.data.values as any).push({
        type: 'next',
        page: (res.data as any).next.split('?')[1].split('=')[1]
      });
    }

    const promises = (res.data.values as any).map(async commit => {
      if (commit.type === 'next') {
        return {
          type: 'next',
          message: 'Next page (' + commit.page + ')',
          sha: commit.page,
          // pullRequest: await getPullRequestBySha(owner, repoName, sha)
        };
      }
      const sha = commit.hash;
      return {
        message: getCommitMessage(commit),
        sha,
        merged: commit.parents.length > 1 ? true : false
        // pullRequest: await getPullRequestBySha(owner, repoName, sha)
      };
    });

    return Promise.all(promises);
  } catch (e) {
    throw getError(e);
  }
}

export async function getCommit(
  owner: string,
  repoName: string,
  sha: string
): Promise<Commit> {
  try {
    /*
    const res: AxiosResponse<GithubCommit> = await axios(
      `https://api.github.com/repos/${owner}/${repoName}/commits/${sha}?access_token=${accessToken}`
    );
    */
    const res: any = await axios({
      url: `https://api.bitbucket.org/2.0/repositories/${owner}/${repoName}/commit/${sha}`,
      auth: {
        username: userName,
        password: accessToken
      }
    });

    const fullSha = res.data.hash;
    // const pullRequest = await getPullRequestBySha(owner, repoName, fullSha);

    return {
      message: getCommitMessage(res.data),
      sha: fullSha,
      // pullRequest
    };
  } catch (e) {
    throw getError(e);
  }
}

export async function createPullRequest(
  owner: string,
  repoName: string,
  payload: GithubPullRequestPayload
): Promise<PullRequest> {
  try {
    /*
    const res: AxiosResponse<GithubIssue> = await axios.post(
      `https://api.github.com/repos/${owner}/${repoName}/pulls?access_token=${accessToken}`,
      payload
    );
    */

    const res: any = await axios.post(`https://api.bitbucket.org/2.0/repositories/${owner}/${repoName}/pullrequests`, payload, {
      auth: {
        username: userName,
        password: accessToken
      }
    });
    return {
      html_url: res.data.links.html.href,
      number: res.data.id
    };
  } catch (e) {
    throw getError(e);
  }
}

export async function addLabels(
  owner: string,
  repoName: string,
  pullNumber: number,
  labels: string[]
) {
  try {
    return await axios.post(
      `https://api.github.com/repos/${owner}/${repoName}/issues/${pullNumber}/labels?access_token=${accessToken}`,
      labels
    );
  } catch (e) {
    throw getError(e);
  }
}

async function getPullRequestBySha(
  owner: string,
  repoName: string,
  commitSha: string
): Promise<number> {
  try {
    const res: AxiosResponse<GithubIssues> = await axios(
      `https://api.github.com/search/issues?q=repo:${owner}/${repoName}+${commitSha}+base:master&access_token=${accessToken}`
    );
    return get(res.data.items[0], 'number');
  } catch (e) {
    throw getError(e);
  }
}

export function setAccessToken(token: string) {
  accessToken = token;
}

export function setUserName(user: string) {
  userName = user;
}

function getError(e: GithubApiError) {
  if (e.response && e.response.data) {
    return new HandledError(
      JSON.stringify({ ...e.response.data, axiosUrl: e.config.url }, null, 4)
    );
  }

  return e;
}
