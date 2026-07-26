import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { teamOfferService, type CreateTeamOfferInput } from '@/services/teamOfferService';

export const teamOfferKeys = {
  all: ['team-offers'] as const,
  incoming: ['team-offers', 'incoming'] as const,
  outgoing: ['team-offers', 'outgoing'] as const,
  detail: (offerId: string) => ['team-offers', 'detail', offerId] as const,
  history: (offerId: string) => ['team-offers', 'history', offerId] as const,
  managedTeams: ['team-offers', 'managed-teams'] as const
};

const useInvalidateOffers = () => {
  const queryClient = useQueryClient();
  return (offerId?: string) => {
    void queryClient.invalidateQueries({ queryKey: teamOfferKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (offerId) {
      void queryClient.invalidateQueries({ queryKey: teamOfferKeys.detail(offerId) });
      void queryClient.invalidateQueries({ queryKey: teamOfferKeys.history(offerId) });
    }
  };
};

export const useManagedTeams = () =>
  useQuery({ queryKey: teamOfferKeys.managedTeams, queryFn: teamOfferService.listManagedTeams });

export const useTeamOffers = (direction: 'incoming' | 'outgoing') =>
  useQuery({
    queryKey: direction === 'incoming' ? teamOfferKeys.incoming : teamOfferKeys.outgoing,
    queryFn: () => teamOfferService.listOffers(direction)
  });

export const useTeamOffer = (offerId: string) =>
  useQuery({
    queryKey: teamOfferKeys.detail(offerId),
    queryFn: () => teamOfferService.getOffer(offerId),
    enabled: Boolean(offerId)
  });

export const useTeamOfferHistory = (offerId: string) =>
  useQuery({
    queryKey: teamOfferKeys.history(offerId),
    queryFn: () => teamOfferService.listHistory(offerId),
    enabled: Boolean(offerId)
  });

export const useCreateTeamOffer = () => {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (input: CreateTeamOfferInput) => teamOfferService.createOffer(input),
    onSuccess: (offer) => invalidate(offer.id)
  });
};

export const useRespondTeamOffer = () => {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: ({ offerId, accept }: { offerId: string; accept: boolean }) =>
      teamOfferService.respondToOffer(offerId, accept),
    onSuccess: (offer) => invalidate(offer.id)
  });
};

export const useSendTeamOffer = () => {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (offerId: string) => teamOfferService.sendOffer(offerId),
    onSuccess: (offer) => invalidate(offer.id)
  });
};

export const useWithdrawTeamOffer = () => {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (offerId: string) => teamOfferService.withdrawOffer(offerId),
    onSuccess: (offer) => invalidate(offer.id)
  });
};
