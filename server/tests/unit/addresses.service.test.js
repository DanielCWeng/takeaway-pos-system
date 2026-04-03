import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: {
    address: {
      apiKey: '',
      storeLatitude: 52.9,
      storeLongitude: -1.2,
    },
  },
}));

vi.mock('../../src/shared/postcodes.js', () => ({
  normalisePostcode: vi.fn(),
  findAddressesLocally: vi.fn(),
  saveAddresses: vi.fn(),
}));

vi.mock('../../src/domains/callerIdService/addressClient.js', () => ({
  findAddressesFromApi: vi.fn(),
}));

vi.mock('../../src/domains/customers/customers.service.js', () => ({
  updateCustomerAddress: vi.fn(),
}));

vi.mock('../../src/infrastructure/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as service from '../../src/domains/addresses/addresses.service.js';
import * as postcodes from '../../src/shared/postcodes.js';
import * as addressClient from '../../src/domains/callerIdService/addressClient.js';

describe('addresses.service lookupPostcode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postcodes.normalisePostcode.mockReturnValue('NG1 1AA');
  });

  it('maps ward to town for local rows', async () => {
    postcodes.findAddressesLocally.mockReturnValue([
      {
        postcode: 'NG1 1AA',
        line1: 'Huntingdon Street',
        ward: "St. Ann's",
        latitude: 52.955,
        longitude: -1.146,
      },
    ]);

    const result = await service.lookupPostcode('ng11aa');

    expect(result.source).toBe('local_db');
    expect(result.addresses).toEqual([
      {
        line1: 'Huntingdon Street',
        line2: '',
        town: "St. Ann's",
        postcode: 'NG1 1AA',
        latitude: 52.955,
        longitude: -1.146,
      },
    ]);
    expect(addressClient.findAddressesFromApi).not.toHaveBeenCalled();
  });
});
