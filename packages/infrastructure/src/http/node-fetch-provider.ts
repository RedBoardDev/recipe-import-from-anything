import type { FetchProvider, FetchResult } from "@ria/application";

export class NodeFetchProvider implements FetchProvider {
  async fetchHtml(url: string): Promise<FetchResult> {
    const response = await fetch(url, {
      headers: {
        "user-agent": "recipe-import-from-anything/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching ${url}`);
    }

    return {
      url: response.url,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
  }
}
