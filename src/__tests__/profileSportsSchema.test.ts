import {
  changePrimaryProfileSport,
  normalizeProfileSportsSelection,
  toggleProfileSport
} from '@/schemas/profileSportsSchema';

describe('profile sports selection', () => {
  it('preserves secondary sports when unrelated profile fields are saved', () => {
    expect(
      normalizeProfileSportsSelection('Cricket', ['Cricket', 'Running', 'Swimming'])
    ).toEqual({
      primarySport: 'Cricket',
      sports: ['Cricket', 'Running', 'Swimming']
    });
  });

  it('adds a changed primary sport without deleting existing sports', () => {
    expect(
      changePrimaryProfileSport(
        {
          primarySport: 'Cricket',
          sports: ['Cricket', 'Running', 'Swimming']
        },
        'Football'
      )
    ).toEqual({
      primarySport: 'Football',
      sports: ['Football', 'Cricket', 'Running', 'Swimming']
    });
  });

  it('does not allow the primary sport to be removed', () => {
    const selection = {
      primarySport: 'Cricket',
      sports: ['Cricket', 'Running']
    };

    expect(toggleProfileSport(selection, 'Cricket')).toBe(selection);
  });

  it('rejects sports outside the shared supported list', () => {
    expect(() => normalizeProfileSportsSelection('Chess', ['Chess'])).toThrow(
      'Select a valid sport.'
    );
  });
});
