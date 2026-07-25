import { render, screen } from '@testing-library/react-native';

import { SportIcon } from '@/components/ui/SportIcon';
import { allSports } from '@/constants/sports';

describe('SportIcon', () => {
  it.each(allSports)('renders the compact colored asset for %s', async (sport) => {
    await render(<SportIcon sport={sport} size={18} />);

    expect(screen.getByLabelText(`${sport} sport`)).toHaveStyle({
      width: 18,
      height: 18
    });
  });

  it('uses a safe visual fallback for an unknown sport', async () => {
    await render(<SportIcon sport="Pickleball" />);

    expect(screen.getByLabelText('Pickleball sport')).toHaveStyle({
      width: 15,
      height: 15
    });
  });
});
