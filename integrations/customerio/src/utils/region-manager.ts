import { RegionUS, RegionEU } from 'customerio-node';

export type CustomerioRegion = 'US' | 'EU';

export class RegionManager {
  private region: CustomerioRegion;

  constructor(region: CustomerioRegion = 'US') {
    this.region = region;
  }

  getRegion(): CustomerioRegion {
    return this.region;
  }

  setRegion(region: CustomerioRegion): void {
    this.region = region;
  }

  getCustomerioRegion() {
    switch (this.region) {
      case 'US':
        return RegionUS;
      case 'EU':
        return RegionEU;
      default:
        return RegionUS;
    }
  }

  getApiUrl(): string {
    switch (this.region) {
      case 'US':
        return 'https://track.customer.io';
      case 'EU':
        return 'https://track-eu.customer.io';
      default:
        return 'https://track.customer.io';
    }
  }

  static fromEnvironment(): CustomerioRegion {
    const envRegion = process.env.CUSTOMERIO_REGION?.toUpperCase();
    return envRegion === 'EU' ? 'EU' : 'US';
  }
}