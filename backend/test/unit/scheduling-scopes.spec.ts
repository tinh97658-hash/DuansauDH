import { automaticInstitutionScopes, INSTITUTION_PERMISSIONS } from '../../src/auth/scheduling-scopes.js';
describe('Automatic academic scope', () => {
  it('uses institution for every granted academic action', () => {
    const codes = [...INSTITUTION_PERMISSIONS];
    expect(automaticInstitutionScopes(codes)).toEqual(Object.fromEntries(codes.map(code => [code, 'institution'])));
  });
  it('does not grant other actions or change profile scope', () => {
    expect(automaticInstitutionScopes(['gradebook.view', 'scheduling.write', 'masters.view'])).toEqual({
      'gradebook.view': 'institution', 'scheduling.write': 'institution',
    });
  });
});
