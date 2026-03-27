import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findAddressesFromApi } from '../../src/domains/callerIdService/addressClient.js';
import { config } from '../../src/config/index.js';

describe('Address API Client (getaddress.io)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock config
    config.address.apiKey = 'test-key';
  });

  it('returns null if API key is missing', async () => {
    config.address.apiKey = '';
    const result = await findAddressesFromApi('KEYMISSING');
    expect(result).toBeNull();
  });

  it('returns address list on successful API call', async () => {
    const postcode = 'SUCCESS';
    const mockResponse = {
      latitude: 52.9,
      longitude: -1.2,
      addresses: [{ line_1: '10 High St', line_2: 'Chilwell', town_or_city: 'Nottingham' }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await findAddressesFromApi(postcode);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      line1: '10 High St',
      line2: 'Chilwell',
      town: 'Nottingham',
      latitude: 52.9,
      longitude: -1.2,
    });
  });

  it('returns null on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await findAddressesFromApi('NOTFOUND');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    const result = await findAddressesFromApi('NETWORKFAIL');
    expect(result).toBeNull();
  });

  it('returns null on 429 rate limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await findAddressesFromApi('RATELIMIT');
    expect(result).toBeNull();
  });

  it('normalises postcode before caching — different cases/spaces share one cache entry', async () => {
    // Use a unique postcode not seen by any other test so the cache is cold
    const mockResponse = {
      latitude: 53.0,
      longitude: -1.5,
      addresses: [{ line_1: '1 Test Rd', line_2: '', town_or_city: 'Derby' }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    // First call with lowercase + space
    const r1 = await findAddressesFromApi('de1 1aa');
    // Second call with uppercase + no space — should be a cache hit, no second fetch
    const r2 = await findAddressesFromApi('DE11AA');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });
});
