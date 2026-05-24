import { afterEach, describe, expect, it } from 'vitest';
import { clearAnonId, getAnonId, setAnonId } from '@/api/anon';

const UUID = '11111111-2222-4333-8444-555555555555';

afterEach(() => {
  clearAnonId();
  document.cookie = `am_anon=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
});

describe('anon id', () => {
  it('returns null before any id is established', () => {
    expect(getAnonId()).toBeNull();
  });

  it('persists and reads back a valid id', () => {
    setAnonId(UUID);
    expect(getAnonId()).toBe(UUID);
  });

  it('rejects a non-uuid value', () => {
    setAnonId('not-a-uuid');
    expect(getAnonId()).toBeNull();
  });

  it('recovers from a cookie when localStorage is cleared', () => {
    document.cookie = `am_anon=${UUID}; path=/`;
    expect(localStorage.getItem('am_anon_id')).toBeNull();
    expect(getAnonId()).toBe(UUID);
    // Recovery rehydrates localStorage.
    expect(localStorage.getItem('am_anon_id')).toBe(UUID);
  });
});
