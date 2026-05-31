import { describe, expect, it } from 'vitest';
import { publishPreflight, ROLE_RANK } from '../types';
import type { Study } from '../types';

function makeStudy(overrides: Partial<Study> = {}): Study {
  return {
    id: 'id',
    slug: 'slug',
    title: 'T',
    description: null,
    abstract: null,
    status: 'planning',
    visibility: 'private',
    preregistration_url: null,
    ethics_statement: null,
    funding_sources: [],
    concept_doi: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    investigators: [
      {
        account_id: 'a',
        role: 'pi',
        added_at: '2026-01-01T00:00:00Z',
        display_name: 'PI',
        orcid: '0000-0002-1825-0097',
      },
    ],
    my_role: 'pi',
    ...overrides,
  };
}

describe('publishPreflight', () => {
  it('flags every missing field on a bare study', () => {
    const missing = publishPreflight(
      makeStudy({
        abstract: '',
        ethics_statement: '',
        investigators: [
          {
            account_id: 'a',
            role: 'co-investigator',
            added_at: 'x',
            orcid: null,
          },
        ],
      }),
    );
    expect(missing).toContain('abstract');
    expect(missing).toContain('ethics_statement');
    expect(missing).toContain('principal_investigator');
    expect(missing).toContain('investigator_orcid');
  });

  it('passes when abstract, ethics, a PI, and all ORCIDs are present', () => {
    const missing = publishPreflight(
      makeStudy({ abstract: 'An abstract', ethics_statement: 'IRB approved' }),
    );
    expect(missing).toEqual([]);
  });

  it('flags a missing ORCID on any investigator', () => {
    const missing = publishPreflight(
      makeStudy({
        abstract: 'a',
        ethics_statement: 'e',
        investigators: [
          {
            account_id: 'a',
            role: 'pi',
            added_at: 'x',
            orcid: '0000-0002-1825-0097',
          },
          { account_id: 'b', role: 'analyst', added_at: 'x', orcid: null },
        ],
      }),
    );
    expect(missing).toEqual(['investigator_orcid']);
  });
});

describe('ROLE_RANK', () => {
  it('orders roles viewer < analyst < co-investigator < pi', () => {
    expect(ROLE_RANK.viewer).toBeLessThan(ROLE_RANK.analyst);
    expect(ROLE_RANK.analyst).toBeLessThan(ROLE_RANK['co-investigator']);
    expect(ROLE_RANK['co-investigator']).toBeLessThan(ROLE_RANK.pi);
  });
});
