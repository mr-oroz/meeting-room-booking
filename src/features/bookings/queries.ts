import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingsApi, type BookingsApi } from '../../api/bookingsApi'
import type { Booking, BookingInput } from '../../domain/booking'

export const bookingKeys = {
  all: ['bookings'] as const,
  byDate: (date: string) => ['bookings', date] as const,
}

export function useBookings(date: string, api: BookingsApi = bookingsApi) {
  return useQuery({
    queryKey: bookingKeys.byDate(date),
    queryFn: ({ signal }) => api.list(date, signal),
  })
}

export interface SaveVariables {
  id?: string
  input: BookingInput
}


export function useSaveBooking(api: BookingsApi = bookingsApi) {
  const queryClient = useQueryClient()
  return useMutation<Booking, Error, SaveVariables>({
    mutationFn: ({ id, input }) => (id ? api.update(id, input) : api.create(input)),
    onSettled: (_data, _error, { input }) =>
      queryClient.invalidateQueries({ queryKey: bookingKeys.byDate(input.date) }),
  })
}

export function useDeleteBooking(api: BookingsApi = bookingsApi) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, Booking>({
    mutationFn: (booking) => api.remove(booking.id),
    onSettled: (_data, _error, booking) =>
      queryClient.invalidateQueries({ queryKey: bookingKeys.byDate(booking.date) }),
  })
}
