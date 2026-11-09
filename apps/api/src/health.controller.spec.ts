import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('retourne un état sain', () => {
    expect(new HealthController().check()).toEqual({
      service: 'squadpost-api',
      status: 'ok',
    });
  });
});
