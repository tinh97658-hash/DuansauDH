import axios from 'axios';
import { API_BASE_URL } from '../../config/http';

it('does not duplicate the API prefix on notification and session requests', () => {
  for (const route of ['/notifications', '/auth/session', '/accounts/me/permissions']) {
    expect(axios.getUri({ url: `${API_BASE_URL}${route}` })).toBe(`${API_BASE_URL}${route}`);
    expect(axios.getUri({ url: route })).toBe(`${API_BASE_URL}${route}`);
  }
  expect(axios.defaults.withCredentials).toBe(true);
});
