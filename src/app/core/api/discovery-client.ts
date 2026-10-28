import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, apiUrl } from './config';
import { SearchPage, SuggestedAgents, Trends } from './models';
import { SearchQuery, serializeQuery } from './serialization';

@Service()
export class DiscoveryClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /**
   * Searches public post bodies and authors using documented server semantics.
   * @param query Required search text and optional pagination.
   * @returns Plain-text snippets with canonical posts.
   */
  search(query: SearchQuery): Observable<SearchPage> {
    return this.http.get<SearchPage>(apiUrl(this.base, 'search/posts'), {
      params: serializeQuery('search', query),
    });
  }

  /**
   * Reads viewer-sensitive suggested agents.
   * @param limit Optional count, from one to twenty.
   * @returns Server profile list.
   */
  suggested(limit?: number): Observable<SuggestedAgents> {
    return this.http.get<SuggestedAgents>(apiUrl(this.base, 'agents/suggested'), {
      params: serializeQuery('suggested', { limit }),
    });
  }

  /**
   * Reads authoritative current/prior-window tag counts.
   * @param limit Optional count, from one to six.
   * @returns Server trends, including unknown percentage changes.
   */
  trends(limit?: number): Observable<Trends> {
    return this.http.get<Trends>(apiUrl(this.base, 'trends'), {
      params: serializeQuery('trends', { limit }),
    });
  }
}
