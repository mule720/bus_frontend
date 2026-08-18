import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gql, saveAuth, clearAuth, type AuthUser } from './graphql';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BackendTrip {
  id: string;
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  busNumber: string;
  totalSeats: number;
  availableSeats: number;
  amenities: string[];
  isMultiStop: boolean;
  isRecurring: boolean;
  recurringDays?: string[];
  status: string;
  company: { id: string; name: string };
  stops: { id: string; name: string; order: number; departureTime?: string; arrivalTime?: string }[];
  segmentPrices?: { id: string; price: string; fromStop: { id: string; name: string; order: number }; toStop: { id: string; name: string; order: number } }[];
}

export interface BackendBooking {
  id: string;
  trip: BackendTrip;
  seats: string[];
  totalAmount: string;
  status: string;
  referenceCode: string;
  qrCode: string;
  travelDate: string;
  createdAt: string;
}

export interface RouteOptions {
  origins: string[];
  destinations: string[];
}

// ── GraphQL fragments / queries ────────────────────────────────────────────────

const TRIP_FIELDS = `
  id
  routeFrom
  routeTo
  departureTime
  arrivalTime
  price
  busNumber
  totalSeats
  availableSeats
  amenities
  isMultiStop
  isRecurring
  recurringDays
  status
  company { id name }
  stops { id name order departureTime arrivalTime }
  segmentPrices { id price fromStop { id name order } toStop { id name order } }
`;

const BOOKING_FIELDS = `
  id
  seats
  totalAmount
  status
  referenceCode
  qrCode
  travelDate
  createdAt
  trip {
    id routeFrom routeTo departureTime arrivalTime price
    company { id name }
  }
`;

const AUTH_FIELDS = `
  token
  refreshToken
  user {
    id username email firstName lastName role phone
    company { id name }
  }
`;

// ── Auth ───────────────────────────────────────────────────────────────────────

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const data = await gql<{ login: { token: string; refreshToken: string; user: AuthUser } }>(
        `mutation Login($u: String!, $p: String!) {
           login(username: $u, password: $p) { ${AUTH_FIELDS} }
         }`,
        { u: username, p: password },
        false,
      );
      const user = data.login.user;
      // Persist token first so the permissions fetch can use it
      saveAuth(data.login.token, data.login.refreshToken, user);
      // For employees, immediately fetch their permission list
      if (user.role === 'employee') {
        try {
          const permsData = await gql<{ myPermissions: string[] }>(
            `{ myPermissions }`,
          );
          user.permissions = permsData.myPermissions ?? [];
        } catch {
          user.permissions = [];
        }
        saveAuth(data.login.token, data.login.refreshToken, user);
      }
      return user;
    },
    onSuccess: (user) => {
      qc.setQueryData(['me'], user);
    },
  });
}

export function useMyPermissions() {
  return useQuery<string[]>({
    queryKey: ['myPermissions'],
    queryFn: async () => {
      const data = await gql<{ myPermissions: string[] }>(`{ myPermissions }`);
      return data.myPermissions ?? [];
    },
    // Only run when the user is authenticated — prevents unauthenticated 401s
    enabled: !!localStorage.getItem('bus_jwt'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSignUpCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      username: string; email: string; password: string;
      firstName?: string; lastName?: string; phone?: string;
    }) => {
      const data = await gql<{ signUpCustomer: { token: string; refreshToken: string; user: AuthUser } }>(
        `mutation SignUp($username: String!, $email: String!, $password: String!,
                        $firstName: String, $lastName: String, $phone: String) {
           signUpCustomer(username: $username, email: $email, password: $password,
                          firstName: $firstName, lastName: $lastName, phone: $phone) {
             ${AUTH_FIELDS}
           }
         }`,
        vars,
        false,
      );
      saveAuth(data.signUpCustomer.token, data.signUpCustomer.refreshToken, data.signUpCustomer.user);
      return data.signUpCustomer.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(['me'], user);
    },
  });
}

export function useSignUpCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      username: string; email: string; password: string; companyName: string;
      firstName?: string; lastName?: string; phone?: string;
      companyAddress: string; companyPhone: string; companyEmail: string;
    }) => {
      const data = await gql<{ signUpCompany: { token: string; refreshToken: string; user: AuthUser } }>(
        `mutation SignUpCo(
           $username: String!, $email: String!, $password: String!,
           $companyName: String!, $firstName: String, $lastName: String, $phone: String,
           $companyAddress: String!, $companyPhone: String!, $companyEmail: String!
         ) {
           signUpCompany(username: $username, email: $email, password: $password,
                         companyName: $companyName, firstName: $firstName,
                         lastName: $lastName, phone: $phone,
                         companyAddress: $companyAddress, companyPhone: $companyPhone,
                         companyEmail: $companyEmail) {
             ${AUTH_FIELDS}
           }
         }`,
        vars,
        false,
      );
      saveAuth(data.signUpCompany.token, data.signUpCompany.refreshToken, data.signUpCompany.user);
      return data.signUpCompany.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(['me'], user);
    },
  });
}

export function useMe() {
  return useQuery<AuthUser | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const data = await gql<{ me: AuthUser | null }>(`{ me { id username email firstName lastName role phone company { id name } } }`);
        return data.me;
      } catch {
        clearAuth();
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Route options ──────────────────────────────────────────────────────────────

export function useRouteOptions() {
  return useQuery<RouteOptions>({
    queryKey: ['routeOptions'],
    queryFn: async () => {
      const data = await gql<{ publicRouteOptions: RouteOptions }>(
        `{ publicRouteOptions { origins destinations } }`,
        undefined,
        false,
      );
      return data.publicRouteOptions;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ── Trip search ────────────────────────────────────────────────────────────────

export function useSearchTrips(params: { routeFrom: string; routeTo: string; date: string; passengers: number } | null) {
  return useQuery<BackendTrip[]>({
    queryKey: ['trips', params],
    queryFn: async () => {
      if (!params) return [];
      const data = await gql<{ searchTrips: BackendTrip[] }>(
        `query Search($from: String, $to: String, $date: String, $passengers: Int) {
           searchTrips(routeFrom: $from, routeTo: $to, date: $date, passengers: $passengers) {
             ${TRIP_FIELDS}
           }
         }`,
        { from: params.routeFrom, to: params.routeTo, date: params.date, passengers: params.passengers },
        false,
      );
      return data.searchTrips;
    },
    enabled: !!params,
    staleTime: 30 * 1000,
  });
}

// ── Seat availability ──────────────────────────────────────────────────────────

export function useBookedSeats(tripId: string | null, travelDate?: string) {
  return useQuery<number[]>({
    queryKey: ['bookedSeats', tripId, travelDate],
    queryFn: async () => {
      const data = await gql<{ bookedSeatsSimple: number[] }>(
        `query BookedSeats($tripId: ID!, $date: String) {
           bookedSeatsSimple(tripId: $tripId, travelDate: $date)
         }`,
        { tripId, date: travelDate },
        false,
      );
      return data.bookedSeatsSimple;
    },
    enabled: !!tripId,
    staleTime: 15 * 1000,
  });
}

// ── Bookings ───────────────────────────────────────────────────────────────────

export function useMyBookings() {
  return useQuery<BackendBooking[]>({
    queryKey: ['myBookings'],
    queryFn: async () => {
      const data = await gql<{ myBookings: BackendBooking[] }>(
        `{ myBookings { ${BOOKING_FIELDS} } }`,
      );
      return data.myBookings;
    },
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      tripId: string;
      seats: string[];
      passengerDetails: object;
      paymentMethod: string;
      travelDate?: string;
      fromStopId?: string;
      toStopId?: string;
    }) => {
      const data = await gql<{ createBooking: { bookings: BackendBooking[]; checkoutUrl: string | null } }>(
        `mutation CreateBooking(
           $tripId: ID!, $seats: [String]!, $passengerDetails: JSONString!,
           $paymentMethod: String!, $travelDate: String,
           $fromStopId: ID, $toStopId: ID
         ) {
           createBooking(
             tripId: $tripId, seats: $seats,
             passengerDetails: $passengerDetails,
             paymentMethod: $paymentMethod, travelDate: $travelDate,
             fromStopId: $fromStopId, toStopId: $toStopId
           ) {
             checkoutUrl
             bookings { ${BOOKING_FIELDS} }
           }
         }`,
        {
          ...vars,
          passengerDetails: JSON.stringify(vars.passengerDetails),
        },
      );
      return data.createBooking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myBookings'] });
      qc.invalidateQueries({ queryKey: ['bookedSeats'] });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      await gql(
        `mutation Cancel($id: ID!) { cancelBooking(bookingId: $id) { ok } }`,
        { id: bookingId },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myBookings'] });
    },
  });
}

// ── Admin — company trips ──────────────────────────────────────────────────────

export function useMyTrips(status?: string) {
  return useQuery<BackendTrip[]>({
    queryKey: ['myTrips', status],
    queryFn: async () => {
      const data = await gql<{ myTrips: BackendTrip[] }>(
        `query MyTrips($status: String) {
           myTrips(status: $status) { ${TRIP_FIELDS} }
         }`,
        { status },
      );
      return data.myTrips ?? [];
    },
  });
}

export interface StopInput {
  name: string;
  order: number;
  departureTime?: string | null;
  arrivalTime?: string | null;
}

export interface SegmentPriceInput {
  fromStopOrder: number;
  toStopOrder: number;
  price: number;
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      routeFrom: string; routeTo: string;
      departureTime: string; arrivalTime: string;
      price: number; busNumber?: string; totalSeats: number;
      amenities?: string[]; isRecurring?: boolean; recurringDays?: string[];
      stops?: StopInput[]; segmentPrices?: SegmentPriceInput[];
    }) => {
      const data = await gql<{ createTrip: { trip: BackendTrip } }>(
        `mutation CreateTrip(
           $routeFrom: String!, $routeTo: String!,
           $departureTime: DateTime!, $arrivalTime: DateTime!,
           $price: Float!, $busNumber: String, $totalSeats: Int!,
           $amenities: JSONString, $isRecurring: Boolean, $recurringDays: [String],
           $stops: [StopInput], $segmentPrices: [SegmentPriceInput]
         ) {
           createTrip(
             routeFrom: $routeFrom, routeTo: $routeTo,
             departureTime: $departureTime, arrivalTime: $arrivalTime,
             price: $price, busNumber: $busNumber, totalSeats: $totalSeats,
             amenities: $amenities, isRecurring: $isRecurring, recurringDays: $recurringDays,
             stops: $stops, segmentPrices: $segmentPrices
           ) { trip { ${TRIP_FIELDS} } }
         }`,
        { ...vars, amenities: vars.amenities ? JSON.stringify(vars.amenities) : undefined },
      );
      return data.createTrip.trip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myTrips'] }),
  });
}

export function useCancelTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await gql(`mutation DeleteTrip($id: ID!) { deleteTrip(tripId: $id) { success } }`, { id: tripId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myTrips'] }),
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      tripId: string; routeFrom?: string; routeTo?: string;
      departureTime?: string; arrivalTime?: string;
      price?: number; busNumber?: string; totalSeats?: number;
      amenities?: string[]; isRecurring?: boolean; recurringDays?: string[];
      stops?: StopInput[]; segmentPrices?: SegmentPriceInput[];
    }) => {
      const { tripId, amenities, stops, segmentPrices, ...rest } = vars;
      const data = await gql<{ updateTrip: { trip: BackendTrip } }>(
        `mutation UpdateTrip(
           $tripId: ID!, $routeFrom: String, $routeTo: String,
           $departureTime: DateTime, $arrivalTime: DateTime,
           $price: Float, $busNumber: String, $amenities: JSONString,
           $isRecurring: Boolean, $recurringDays: [String],
           $stops: [StopInput], $segmentPrices: [SegmentPriceInput]
         ) {
           updateTrip(
             tripId: $tripId, routeFrom: $routeFrom, routeTo: $routeTo,
             departureTime: $departureTime, arrivalTime: $arrivalTime,
             price: $price, busNumber: $busNumber, amenities: $amenities,
             isRecurring: $isRecurring, recurringDays: $recurringDays,
             stops: $stops, segmentPrices: $segmentPrices
           ) { trip { ${TRIP_FIELDS} } }
         }`,
        { tripId, ...rest, amenities: amenities ? JSON.stringify(amenities) : undefined, stops, segmentPrices },
      );
      return data.updateTrip.trip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myTrips'] }),
  });
}

export function useSetTripStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tripId: string; status: 'active' | 'completed' | 'cancelled' }) => {
      await gql(
        `mutation SetTripStatus($tripId: ID!, $status: String!) {
           setTripStatus(tripId: $tripId, status: $status) { trip { id status } }
         }`,
        vars,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myTrips'] }),
  });
}

// ── Employees ──────────────────────────────────────────────────────────────────

export interface BackendEmployee {
  id: string;
  isActive: boolean;
  permissions: string;
  station: { id: string; name: string } | null;
  user: { id: string; username: string; email: string; firstName: string; lastName: string; phone: string };
}

const EMP_FIELDS = `
  id isActive permissions
  station { id name }
  user { id username email firstName lastName phone }
`;

export function useMyEmployees() {
  return useQuery<BackendEmployee[]>({
    queryKey: ['myEmployees'],
    queryFn: async () => {
      const data = await gql<{ myEmployees: BackendEmployee[] }>(
        `{ myEmployees { ${EMP_FIELDS} } }`,
      );
      return data.myEmployees ?? [];
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      username: string; email: string; password: string;
      firstName?: string; lastName?: string; phone?: string;
      permissions?: string[]; stationId?: string;
    }) => {
      const data = await gql<{ createEmployee: { employee: BackendEmployee } }>(
        `mutation CreateEmployee(
           $username: String!, $email: String!, $password: String!,
           $firstName: String, $lastName: String, $phone: String,
           $permissions: JSONString, $stationId: ID
         ) {
           createEmployee(username: $username, email: $email, password: $password,
             firstName: $firstName, lastName: $lastName, phone: $phone,
             permissions: $permissions, stationId: $stationId) {
             employee { ${EMP_FIELDS} }
           }
         }`,
        { ...vars, permissions: vars.permissions ? JSON.stringify(vars.permissions) : undefined },
      );
      return data.createEmployee.employee;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myEmployees'] }),
  });
}

export function useUpdateEmployeePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { employeeId: string; permissions: string[]; stationId?: string }) => {
      await gql(
        `mutation UpdatePerms($employeeId: ID!, $permissions: JSONString!, $stationId: ID) {
           updateEmployeePermissions(employeeId: $employeeId, permissions: $permissions, stationId: $stationId) {
             employee { id }
           }
         }`,
        { ...vars, permissions: JSON.stringify(vars.permissions) },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myEmployees'] }),
  });
}

// ── Buses ──────────────────────────────────────────────────────────────────────

export interface BackendBus {
  id: string;
  registrationNumber: string;
  busNumber: string;
  busType: string;
  totalSeats: number;
  isActive: boolean;
  amenities: string;
}

const BUS_FIELDS = `id registrationNumber busNumber busType totalSeats isActive amenities`;

export function useMyBuses() {
  return useQuery<BackendBus[]>({
    queryKey: ['myBuses'],
    queryFn: async () => {
      const data = await gql<{ myBuses: BackendBus[] }>(`{ myBuses { ${BUS_FIELDS} } }`);
      return data.myBuses ?? [];
    },
  });
}

export function useRegisterBus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      registrationNumber: string; busNumber: string;
      busType: string; totalSeats: number; amenities?: string[];
    }) => {
      const data = await gql<{ registerBus: { bus: BackendBus } }>(
        `mutation RegisterBus(
           $registrationNumber: String!, $busNumber: String!,
           $busType: String!, $totalSeats: Int!, $amenities: JSONString
         ) {
           registerBus(registrationNumber: $registrationNumber, busNumber: $busNumber,
             busType: $busType, totalSeats: $totalSeats, amenities: $amenities) {
             bus { ${BUS_FIELDS} }
           }
         }`,
        { ...vars, amenities: vars.amenities ? JSON.stringify(vars.amenities) : undefined },
      );
      return data.registerBus.bus;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myBuses'] }),
  });
}

export function useUpdateBus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      busId: string; registrationNumber?: string; busNumber?: string;
      busType?: string; totalSeats?: number; amenities?: string[]; isActive?: boolean;
    }) => {
      await gql(
        `mutation UpdateBus(
           $busId: ID!, $registrationNumber: String, $busNumber: String,
           $busType: String, $totalSeats: Int, $amenities: JSONString, $isActive: Boolean
         ) {
           updateBus(busId: $busId, registrationNumber: $registrationNumber, busNumber: $busNumber,
             busType: $busType, totalSeats: $totalSeats, amenities: $amenities, isActive: $isActive) {
             bus { id }
           }
         }`,
        { ...vars, amenities: vars.amenities ? JSON.stringify(vars.amenities) : undefined },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myBuses'] }),
  });
}

// ── POS — station-aware trip search ──────────────────────────────────────────

export interface POSTripEntry {
  trip: BackendTrip;
  /** "selling" | "bus_left" | "completed" | "no_station" */
  stationStatus: string;
  /** Seats available specifically from the employee's boarding stop */
  availableFromStation: number | null;
  /** Global relay ID of the boarding TripStop, or null */
  boardingStopId: string | null;
  boardingStopName: string | null;
  travelDate: string;
}

export function useEmployeePosTrips(params: { routeFrom?: string; routeTo?: string; date?: string } | null) {
  return useQuery<POSTripEntry[]>({
    queryKey: ['employeePosTrips', params],
    queryFn: async () => {
      const data = await gql<{ employeePosTrips: POSTripEntry[] }>(
        `query EmployeePosTrips($routeFrom: String, $routeTo: String, $date: String) {
           employeePosTrips(routeFrom: $routeFrom, routeTo: $routeTo, date: $date) {
             stationStatus
             availableFromStation
             boardingStopId
             boardingStopName
             travelDate
             trip { ${TRIP_FIELDS} }
           }
         }`,
        params ?? {},
      );
      return data.employeePosTrips ?? [];
    },
    enabled: !!params,
    refetchInterval: 15000, // refresh every 15s so seat counts stay live
  });
}

export function useAvailableSeatsForSegment(
  tripId: string | null,
  fromStopId: string | null,
  toStopId: string | null,
  travelDate?: string,
) {
  return useQuery<number[]>({
    queryKey: ['seatsForSegment', tripId, fromStopId, toStopId, travelDate],
    queryFn: async () => {
      const data = await gql<{ availableSeatsForSegment: number[] }>(
        `query AvailableSeatsForSegment($tripId: ID!, $fromStopId: ID!, $toStopId: ID!, $travelDate: String) {
           availableSeatsForSegment(tripId: $tripId, fromStopId: $fromStopId, toStopId: $toStopId, travelDate: $travelDate)
         }`,
        { tripId, fromStopId, toStopId, travelDate },
      );
      return data.availableSeatsForSegment ?? [];
    },
    enabled: !!(tripId && fromStopId && toStopId),
    refetchInterval: 10000,
  });
}

// ── POS — Walk-in sales (legacy non-station-aware search) ─────────────────────

export function useEmployeeTripSearch(params: { routeFrom?: string; routeTo?: string; date?: string } | null) {
  return useQuery<BackendTrip[]>({
    queryKey: ['employeeTripSearch', params],
    queryFn: async () => {
      const data = await gql<{ employeeTripSearch: BackendTrip[] }>(
        `query EmployeeTripSearch($routeFrom: String, $routeTo: String, $date: String) {
           employeeTripSearch(routeFrom: $routeFrom, routeTo: $routeTo, date: $date) {
             ${TRIP_FIELDS}
           }
         }`,
        params ?? {},
      );
      return data.employeeTripSearch ?? [];
    },
    enabled: !!params,
  });
}

export interface WalkInBookingResult {
  bookings: { id: string; referenceCode: string; qrCode: string; seats: string[]; totalAmount: string }[];
}

export function useCreateWalkInBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      tripId: string; seats: string[]; passengerDetails: object;
      paymentMethod: string; cashCollected?: number;
      discountAmount?: number; discountReason?: string;
      fromStopId?: string; toStopId?: string;
    }) => {
      const data = await gql<{ createWalkInBooking: WalkInBookingResult }>(
        `mutation CreateWalkIn(
           $tripId: ID!, $seats: [String]!, $passengerDetails: JSONString!,
           $paymentMethod: String!, $cashCollected: Float,
           $discountAmount: Float, $discountReason: String,
           $fromStopId: ID, $toStopId: ID
         ) {
           createWalkInBooking(tripId: $tripId, seats: $seats,
             passengerDetails: $passengerDetails, paymentMethod: $paymentMethod,
             cashCollected: $cashCollected, discountAmount: $discountAmount,
             discountReason: $discountReason, fromStopId: $fromStopId, toStopId: $toStopId) {
             bookings { id referenceCode qrCode seats totalAmount }
           }
         }`,
        { ...vars, passengerDetails: JSON.stringify(vars.passengerDetails) },
      );
      qc.invalidateQueries({ queryKey: ['bookedSeats'] });
      return data.createWalkInBooking;
    },
  });
}

// ── Ticket scanner ─────────────────────────────────────────────────────────────

export interface LookupResult {
  found: boolean;
  message: string;
  bookingId: string;
  referenceCode: string;
  passengerName: string;
  seats: string[];
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  status: string;
  isWalkin: boolean;
  boardedAt: string | null;
}

export function useLookupBooking() {
  return useMutation({
    mutationFn: async (referenceCode: string) => {
      const data = await gql<{ lookupBookingByReference: LookupResult }>(
        `query Lookup($ref: String!) {
           lookupBookingByReference(referenceCode: $ref) {
             found message bookingId referenceCode passengerName seats
             routeFrom routeTo departureTime status isWalkin boardedAt
           }
         }`,
        { ref: referenceCode },
      );
      return data.lookupBookingByReference;
    },
  });
}

export function useBoardPassenger() {
  return useMutation({
    mutationFn: async (vars: { bookingId: string; boardingMethod: string }) => {
      const data = await gql<{ boardPassenger: { success: boolean; message: string } }>(
        `mutation Board($bookingId: ID!, $boardingMethod: String!) {
           boardPassenger(bookingId: $bookingId, boardingMethod: $boardingMethod) {
             success message
           }
         }`,
        vars,
      );
      return data.boardPassenger;
    },
  });
}

// ── Company overview ───────────────────────────────────────────────────────────

export interface CompanyOverview {
  myCompany: { id: string; name: string } | null;
  myTrips: BackendTrip[];
  myEmployees: { id: string; isActive: boolean }[];
  myBuses: { id: string; isActive: boolean }[];
}

export function useCompanyOverview() {
  return useQuery<CompanyOverview>({
    queryKey: ['companyOverview'],
    queryFn: async () => {
      const data = await gql<CompanyOverview>(
        `{
           myCompany { id name }
           myTrips(status: "active") {
             id routeFrom routeTo departureTime arrivalTime busNumber
             totalSeats availableSeats price status
           }
           myEmployees { id isActive }
           myBuses { id isActive }
         }`,
      );
      return data;
    },
    staleTime: 60 * 1000,
  });
}

// ── Customer lookup ────────────────────────────────────────────────────────────

export interface CustomerBookingResult {
  bookingId: string;
  referenceCode: string;
  qrCode: string;
  passengerName: string;
  passengerPhone: string;
  seats: string[];
  route: string;
  routeFrom: string;
  routeTo: string;
  busNumber: string;
  departureTime: string;
  arrivalTime: string;
  companyName: string;
  travelDate: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export function useCustomerSearch() {
  return useMutation({
    mutationFn: async (query: string) => {
      const data = await gql<{ customerBookingSearch: CustomerBookingResult[] }>(
        `query CustomerSearch($query: String!) {
           customerBookingSearch(query: $query) {
             bookingId referenceCode qrCode passengerName passengerPhone
             seats route routeFrom routeTo busNumber departureTime arrivalTime
             companyName travelDate totalAmount paymentMethod status createdAt
           }
         }`,
        { query },
      );
      return data.customerBookingSearch ?? [];
    },
  });
}

// ── Stations ────────────────────────────────────────────────────────────────────

export interface CompanyStation {
  id: string;
  name: string;
  address: string;
  employeeCount: number;
}

export function useCompanyStations() {
  return useQuery<CompanyStation[]>({
    queryKey: ['companyStations'],
    queryFn: async () => {
      const data = await gql<{ companyStations: CompanyStation[] }>(
        `{ companyStations { id name address employeeCount } }`,
      );
      return data.companyStations ?? [];
    },
  });
}

export function useEmpCreateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; address?: string }) => {
      await gql(
        `mutation CreateStation($name: String!, $address: String) {
           empCreateStation(name: $name, address: $address) { ok stationId message }
         }`,
        vars,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companyStations'] }),
  });
}

export function useEmpUpdateStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { stationId: string; name?: string; address?: string }) => {
      await gql(
        `mutation UpdateStation($stationId: ID!, $name: String, $address: String) {
           empUpdateStation(stationId: $stationId, name: $name, address: $address) { ok message }
         }`,
        vars,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companyStations'] }),
  });
}

// ── Seat availability / trip seat map ──────────────────────────────────────────

export interface SeatMapData {
  tripId: string;
  route: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  seats: { seatNumber: number; status: string; passenger: string; bookingId: string }[];
}

export function useTripSeatMap(tripId: string | null) {
  return useQuery<SeatMapData | null>({
    queryKey: ['tripSeatMap', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const data = await gql<{ tripSeatMap: SeatMapData }>(
        `query TripSeatMap($tripId: ID!) {
           tripSeatMap(tripId: $tripId) {
             tripId route departureTime totalSeats availableSeats
             seats { seatNumber status passenger bookingId }
           }
         }`,
        { tripId },
      );
      return data.tripSeatMap;
    },
    enabled: !!tripId,
  });
}

export function useTripStaffingData(tripId: string | null, travelDate: string) {
  return useQuery({
    queryKey: ['tripStaffing', tripId, travelDate],
    queryFn: async () => {
      const data = await gql<{ tripStaffing: any }>(
        `query TripStaffing($tripId: ID!, $travelDate: String!) {
           tripStaffing(tripId: $tripId, travelDate: $travelDate) {
             run { busId busNumber driverId driverName conductorId conductorName status departedAt completedAt }
             stationAssignments { id employeeId employeeName stationId stationName }
             closedStationIds
           }
         }`,
        { tripId, travelDate },
      );
      return data.tripStaffing;
    },
    enabled: !!tripId,
  });
}

export function useCloseStationSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tripId: string; travelDate: string }) => {
      await gql(
        `mutation CloseStationSales($tripId: ID!, $travelDate: String!) {
           closeStationSales(tripId: $tripId, travelDate: $travelDate) { success runStatus }
         }`,
        vars,
      );
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['tripStaffing', vars.tripId] }),
  });
}

export function useCompleteTripRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tripId: string; travelDate: string }) => {
      await gql(
        `mutation CompleteTripRun($tripId: ID!, $travelDate: String!) {
           completeTripRun(tripId: $tripId, travelDate: $travelDate) { success }
         }`,
        vars,
      );
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['tripStaffing', vars.tripId] }),
  });
}

// ── Trip staffing assignments ───────────────────────────────────────────────────

export interface CompanyEmployeeFull {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  station: string | null;
  permissions: string;
  isActive: boolean;
  createdAt: string;
}

export function useCompanyEmployees() {
  return useQuery<CompanyEmployeeFull[]>({
    queryKey: ['companyEmployees'],
    queryFn: async () => {
      // company_admin uses myEmployees (company/schema.py); employee uses companyEmployees (employee/schema.py)
      // We always try myEmployees first since it works for both admin and employee with manage_employees perm.
      try {
        const data = await gql<{ myEmployees: BackendEmployee[] }>(
          `{ myEmployees { ${EMP_FIELDS} } }`,
        );
        const emps = data.myEmployees ?? [];
        return emps.map((e) => ({
          id: e.id,
          userId: e.user.id,
          fullName: [e.user.firstName, e.user.lastName].filter(Boolean).join(' ') || e.user.username,
          email: e.user.email,
          station: e.station?.name ?? null,
          permissions: typeof e.permissions === 'string' ? e.permissions : JSON.stringify(e.permissions ?? {}),
          isActive: e.isActive,
          createdAt: '',
        }));
      } catch {
        // fallback: employee with manage_employees perm can use companyEmployees
        const data = await gql<{ companyEmployees: CompanyEmployeeFull[] }>(
          `{ companyEmployees { id userId fullName email station permissions isActive createdAt } }`,
        );
        return data.companyEmployees ?? [];
      }
    },
  });
}

export function useEmpCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      username: string; email: string; password: string; fullName: string;
      permissions?: Record<string, boolean>; stationId?: string;
    }) => {
      const data = await gql<{ empCreateStaff: { ok: boolean; staffId: string; message: string } }>(
        `mutation EmpCreateStaff(
           $username: String!, $email: String!, $password: String!,
           $fullName: String!, $permissions: JSONString, $stationId: ID
         ) {
           empCreateStaff(username: $username, email: $email, password: $password,
             fullName: $fullName, permissions: $permissions, stationId: $stationId) {
             ok staffId message
           }
         }`,
        { ...vars, permissions: vars.permissions ? JSON.stringify(vars.permissions) : undefined },
      );
      if (!data.empCreateStaff.ok) throw new Error(data.empCreateStaff.message);
      return data.empCreateStaff;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companyEmployees'] });
      qc.invalidateQueries({ queryKey: ['myEmployees'] });
    },
  });
}

export function useEmpUpdateStaffPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      staffId: string; permissions: Record<string, boolean>; isActive?: boolean; stationId?: string | null;
    }) => {
      await gql(
        `mutation EmpUpdateStaff($staffId: ID!, $permissions: JSONString!, $isActive: Boolean, $stationId: ID) {
           empUpdateStaffPermissions(staffId: $staffId, permissions: $permissions, isActive: $isActive, stationId: $stationId) {
             ok message
           }
         }`,
        { ...vars, permissions: JSON.stringify(vars.permissions) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companyEmployees'] });
      qc.invalidateQueries({ queryKey: ['myEmployees'] });
    },
  });
}

export function useAssignTripStationStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tripId: string; travelDate: string; employeeIds: string[] }) => {
      await gql(
        `mutation AssignStationStaff($tripId: ID!, $travelDate: String!, $employeeIds: [ID!]!) {
           assignTripStationStaff(tripId: $tripId, travelDate: $travelDate, employeeIds: $employeeIds) { success }
         }`,
        vars,
      );
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['tripStaffing', vars.tripId] }),
  });
}

export function useAssignTripRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      tripId: string; travelDate: string;
      busId?: string | null; driverId?: string | null; conductorId?: string | null;
    }) => {
      await gql(
        `mutation AssignRun($tripId: ID!, $travelDate: String!, $busId: ID, $driverId: ID, $conductorId: ID) {
           assignTripRun(tripId: $tripId, travelDate: $travelDate, busId: $busId, driverId: $driverId, conductorId: $conductorId) { success }
         }`,
        vars,
      );
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['tripStaffing', vars.tripId] }),
  });
}

// ── Sales report ───────────────────────────────────────────────────────────────

export interface SalesReportBooking {
  bookingId: string;
  referenceCode: string;
  passengerName: string;
  passengerPhone: string;
  passengerNationalId: string;
  seats: string[];
  route: string;
  totalAmount: number;
  discountAmount: number;
  discountReason: string;
  paymentMethod: string;
  status: string;
  employeeName: string;
  createdAt: string;
}

export interface SalesReport {
  totalRevenue: number;
  totalTickets: number;
  cashTotal: number;
  mobileTotal: number;
  cardTotal: number;
  bookings: SalesReportBooking[];
}

export function useCompanySalesReport(dateFrom: string, dateTo: string) {
  return useQuery<SalesReport | null>({
    queryKey: ['companySalesReport', dateFrom, dateTo],
    queryFn: async () => {
      const data = await gql<{ companySalesReport: SalesReport }>(
        `query CompanySalesReport($dateFrom: String!, $dateTo: String!) {
           companySalesReport(dateFrom: $dateFrom, dateTo: $dateTo) {
             totalRevenue totalTickets cashTotal mobileTotal cardTotal
             bookings {
               bookingId referenceCode passengerName passengerPhone passengerNationalId
               seats totalAmount discountAmount discountReason paymentMethod
               status employeeName route createdAt
             }
           }
         }`,
        { dateFrom, dateTo },
      );
      return data.companySalesReport ?? null;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}

// ── Trip stops ─────────────────────────────────────────────────────────────────

export function useTripStops(tripId: string | null) {
  return useQuery<{ id: string; name: string; order: number }[]>({
    queryKey: ['tripStops', tripId],
    queryFn: async () => {
      const data = await gql<{ tripStops: { id: string; name: string; order: number }[] }>(
        `query TripStops($tripId: ID!) { tripStops(tripId: $tripId) { id name order } }`,
        { tripId },
        false,
      );
      return data.tripStops ?? [];
    },
    enabled: !!tripId,
  });
}

// ── Employee route autocomplete ────────────────────────────────────────────────

export function useEmployeeRouteOptions() {
  return useQuery<RouteOptions>({
    queryKey: ['employeeRouteOptions'],
    queryFn: async () => {
      const data = await gql<{ employeeRouteOptions: RouteOptions }>(
        `{ employeeRouteOptions { origins destinations } }`,
      );
      return data.employeeRouteOptions ?? { origins: [], destinations: [] };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!localStorage.getItem('bus_jwt'),
  });
}

// ── Walk-in mobile money payment ───────────────────────────────────────────────

export interface WalkInMobileMoneyResult {
  bookingId: string;
  referenceCode: string;
  orderId: string;
  checkoutUrl: string;
  providerReference: string;
  expiresAt: string;
  paymentInitiated: boolean;
  message: string;
}

export function useInitiateWalkInMobileMoney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      tripId: string; seats: string[]; passengerDetails: object;
      customerPhone: string; discountAmount?: number; discountReason?: string;
      fromStopId?: string; toStopId?: string; travelDate?: string;
    }) => {
      const data = await gql<{ initiateWalkInMobileMoney: WalkInMobileMoneyResult }>(
        `mutation InitiateWalkInMM(
           $tripId: ID!, $seats: [String]!, $passengerDetails: JSONString!,
           $customerPhone: String!, $discountAmount: Float, $discountReason: String,
           $fromStopId: ID, $toStopId: ID, $travelDate: String
         ) {
           initiateWalkInMobileMoney(
             tripId: $tripId, seats: $seats, passengerDetails: $passengerDetails,
             customerPhone: $customerPhone, discountAmount: $discountAmount,
             discountReason: $discountReason, fromStopId: $fromStopId,
             toStopId: $toStopId, travelDate: $travelDate
           ) {
             bookingId referenceCode orderId checkoutUrl providerReference
             expiresAt paymentInitiated message
           }
         }`,
        { ...vars, passengerDetails: JSON.stringify(vars.passengerDetails) },
      );
      qc.invalidateQueries({ queryKey: ['bookedSeats'] });
      return data.initiateWalkInMobileMoney;
    },
  });
}

export interface WalkInPaymentStatus {
  orderId: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  bookings: { id: string; referenceCode: string; qrCode: string; seats: string[]; totalAmount: string }[];
  message: string;
}

export function useWalkInPaymentStatus(orderId: string | null) {
  return useQuery<WalkInPaymentStatus | null>({
    queryKey: ['walkInPaymentStatus', orderId],
    queryFn: async () => {
      const data = await gql<{ walkInPaymentStatus: WalkInPaymentStatus }>(
        `query WalkInStatus($orderId: ID!) {
           walkInPaymentStatus(orderId: $orderId) {
             orderId status paymentMethod totalAmount message
             bookings { id referenceCode qrCode seats totalAmount }
           }
         }`,
        { orderId },
      );
      return data.walkInPaymentStatus ?? null;
    },
    enabled: !!orderId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'confirmed' || status === 'cancelled' || status === 'expired') return false;
      return 4000;
    },
  });
}

// ── Company subscription ───────────────────────────────────────────────────────

export interface SubscriptionPlan {
  plan: string;
  monthlyPrice: number;
  annualPrice: number;
  includedBuses: number;
  includedStations: number;
  includedStaff: number;
  unlimitedStaff: boolean;
  extraBusFee: number;
  extraStationFee: number;
  extraStaffFee: number;
  onlineCommissionRate: number;
  walkinCommissionRate: number;
  onlineServiceChargeRate: number;
  setupBaseFee: number;
  setupPerStation: number;
  setupPerStaff: number;
  setupPerBus: number;
  setupTrainingFee: number;
}

export interface ActiveSubscription {
  id: string;
  plan: string;
  billingCycle: string;
  status: string;
  amount: number;
  startsAt: string;
  endsAt: string;
  autoRenew: boolean;
}

export function useMyActiveSubscription() {
  return useQuery<ActiveSubscription | null>({
    queryKey: ['myActiveSubscription'],
    queryFn: async () => {
      const data = await gql<{ myActiveSubscription: ActiveSubscription | null }>(
        `{ myActiveSubscription {
             id plan billingCycle status amount startsAt endsAt autoRenew
           }
         }`,
      );
      return data.myActiveSubscription ?? null;
    },
    staleTime: 60 * 1000,
  });
}

export function useMyLatestSubscription() {
  return useQuery<ActiveSubscription | null>({
    queryKey: ['myLatestSubscription'],
    queryFn: async () => {
      const data = await gql<{ myLatestSubscription: ActiveSubscription | null }>(
        `{ myLatestSubscription {
             id plan billingCycle status amount startsAt endsAt autoRenew
           }
         }`,
      );
      return data.myLatestSubscription ?? null;
    },
    enabled: false,
  });
}

export function useAvailableSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => {
      const data = await gql<{ availableSubscriptionPlans: SubscriptionPlan[] }>(
        `{ availableSubscriptionPlans {
             plan monthlyPrice annualPrice
             includedBuses includedStations includedStaff unlimitedStaff
             extraBusFee extraStationFee extraStaffFee
             onlineCommissionRate walkinCommissionRate onlineServiceChargeRate
             setupBaseFee setupPerStation setupPerStaff setupPerBus setupTrainingFee
           } }`,
      );
      return data.availableSubscriptionPlans ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSubscribeCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { plan: string; billingCycle: string; autoRenew?: boolean; actualBuses?: number; actualStations?: number; actualStaff?: number }) => {
      const data = await gql<{ subscribeCompany: { subscription: ActiveSubscription; checkoutUrl: string } }>(
        `mutation SubscribeCompany($plan: String!, $billingCycle: String!, $autoRenew: Boolean, $actualBuses: Int, $actualStations: Int, $actualStaff: Int) {
           subscribeCompany(plan: $plan, billingCycle: $billingCycle, autoRenew: $autoRenew, actualBuses: $actualBuses, actualStations: $actualStations, actualStaff: $actualStaff) {
             checkoutUrl
             subscription { id plan billingCycle status amount startsAt endsAt autoRenew }
           }
         }`,
        vars,
      );
      return data.subscribeCompany;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myActiveSubscription'] });
      qc.invalidateQueries({ queryKey: ['myLatestSubscription'] });
    },
  });
}

// ── Company profile ────────────────────────────────────────────────────────────

export interface CompanyProfile {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  registrationNumber: string;
  isApproved: boolean;
}

export function useMyCompany() {
  return useQuery<CompanyProfile | null>({
    queryKey: ['myCompany'],
    queryFn: async () => {
      const data = await gql<{ myCompany: CompanyProfile | null }>(
        `{ myCompany { id name description address phone email registrationNumber isApproved } }`,
      );
      return data.myCompany ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Delete/toggle bus ──────────────────────────────────────────────────────────

export function useDeleteBus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (busId: string) => {
      await gql(`mutation DeleteBus($busId: ID!) { deleteBus(busId: $busId) { success } }`, { busId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myBuses'] }),
  });
}

// ── Delete/toggle employee ─────────────────────────────────────────────────────

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      await gql(`mutation DeleteEmployee($employeeId: ID!) { deleteEmployee(employeeId: $employeeId) { ok } }`, { employeeId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myEmployees'] });
      qc.invalidateQueries({ queryKey: ['companyEmployees'] });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { employeeId: string; isActive?: boolean; stationId?: string }) => {
      await gql(
        `mutation UpdateEmployee($employeeId: ID!, $isActive: Boolean, $stationId: ID) {
           updateEmployee(employeeId: $employeeId, isActive: $isActive, stationId: $stationId) { ok }
         }`,
        vars,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myEmployees'] });
      qc.invalidateQueries({ queryKey: ['companyEmployees'] });
    },
  });
}

// ── Refund ─────────────────────────────────────────────────────────────────────

export function useRequestRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string; reason: string }) => {
      const data = await gql<{ requestRefund: { ok: boolean; message: string } }>(
        `mutation RequestRefund($bookingId: ID!, $reason: String!) {
           requestRefund(bookingId: $bookingId, reason: $reason) { ok message }
         }`,
        vars,
      );
      return data.requestRefund;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myBookings'] }),
  });
}

// ── Notifications ──────────────────────────────────────────────────────────────

export interface BackendNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  return useQuery<BackendNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const data = await gql<{ notifications: BackendNotification[] }>(
          `{ notifications { id title message isRead createdAt } }`,
        );
        return data.notifications ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!localStorage.getItem('bus_jwt'),
    staleTime: 2 * 60 * 1000,
  });
}

// ── POS Drafts ────────────────────────────────────────────────────────────────

export interface PosDraftPassenger { name: string; phone: string; nationalId: string; }
export interface PosDraftTrip {
  id: string; routeFrom: string; routeTo: string;
  departureTime: string; busNumber: string; isMultiStop: boolean;
}
export interface PosDraftStop { id: string; name: string; }
export interface PosDraft {
  id: string;
  trip: PosDraftTrip;
  seats: number[];
  passengerDetails: PosDraftPassenger[];
  paymentMethod: string;
  fromStop?: PosDraftStop | null;
  toStop?: PosDraftStop | null;
  travelDate?: string | null;
  notes?: string;
  updatedAt: string;
}

const POS_DRAFT_FIELDS = `
  id updatedAt notes paymentMethod travelDate
  trip { id routeFrom routeTo departureTime busNumber isMultiStop }
  seats
  passengerDetails { name phone nationalId }
  fromStop { id name }
  toStop { id name }
`;

export function useMyPosDrafts() {
  return useQuery<PosDraft[]>({
    queryKey: ['my-pos-drafts'],
    queryFn: async () => {
      const data = await gql<{ myPosDrafts: PosDraft[] }>(`{ myPosDrafts { ${POS_DRAFT_FIELDS} } }`);
      return data.myPosDrafts ?? [];
    },
    enabled: !!localStorage.getItem('bus_jwt'),
    staleTime: 30_000,
  });
}

export function useSavePosDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      draftId?: string;
      tripId: string; seats: number[]; passengerDetails: unknown;
      paymentMethod?: string; fromStopId?: string; toStopId?: string;
      travelDate?: string; notes?: string;
    }) => {
      const data = await gql<{ savePosDraft: { ok: boolean; draftId: string } }>(`
        mutation SaveDraft($draftId: ID, $input: SavePosDraftInput!) {
          savePosDraft(draftId: $draftId, input: $input) { ok draftId }
        }
      `, {
        draftId: vars.draftId,
        input: {
          tripId: vars.tripId,
          seats: vars.seats,
          passengerDetails: JSON.stringify(vars.passengerDetails),
          paymentMethod: vars.paymentMethod,
          fromStopId: vars.fromStopId,
          toStopId: vars.toStopId,
          travelDate: vars.travelDate,
          notes: vars.notes,
        },
      });
      return data.savePosDraft;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-pos-drafts'] }),
  });
}

export function useDeletePosDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      await gql(`mutation Del($id: ID!) { deletePosDraft(draftId: $id) { ok } }`, { id: draftId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-pos-drafts'] }),
  });
}

// ── Walk-in customer lookup ───────────────────────────────────────────────────

export interface WalkInCustomer { id: string; name: string; phone: string; nationalId: string; email: string; }

export function useLookupWalkInCustomer() {
  return useMutation({
    mutationFn: async (query: string): Promise<WalkInCustomer | null> => {
      const data = await gql<{ lookupWalkinCustomer: WalkInCustomer | null }>(
        `query Lookup($q: String!) { lookupWalkinCustomer(query: $q) { id name phone nationalId email } }`,
        { q: query },
      );
      return data.lookupWalkinCustomer ?? null;
    },
  });
}

// ── Company Dashboard ─────────────────────────────────────────────────────────

export interface RouteRevenue { routeFrom: string; routeTo: string; revenue: number; ticketCount: number; }
export interface StationRevenue { stationName: string; revenue: number; ticketCount: number; }
export interface SellerStats { employeeName: string; ticketsSold: number; revenue: number; }
export interface DashboardTrip {
  id: string; routeFrom: string; routeTo: string; departureTime: string;
  busNumber: string; status: string; availableSeats: number; totalSeats: number;
  hasBus: boolean; hasDriver: boolean; hasConductor: boolean;
  walkinCount: number; onlineCount: number; runStatus: string;
}
export interface DashboardAlert { severity: string; type: string; message: string; tripId?: string; }
export interface CompanyDashboard {
  revenueToday: number; revenueMonth: number;
  ticketsToday: number; ticketsMonth: number;
  cashToday: number; mobileToday: number; cardToday: number;
  walkinToday: number; onlineToday: number;
  tripsToday: number; tripsDeparted: number; tripsCompleted: number;
  tripsNotStarted: number; tripsCancelled: number; avgOccupancyPct: number;
  activeBuses: number; activeEmployees: number;
  revenueByRoute: RouteRevenue[]; revenueByStation: StationRevenue[];
  topSellers: SellerStats[]; trips: DashboardTrip[]; alerts: DashboardAlert[];
}

const COMPANY_DASHBOARD_QUERY = `
  query CompanyDashboard($date: String) {
    companyDashboard(date: $date) {
      revenueToday revenueMonth ticketsToday ticketsMonth
      cashToday mobileToday cardToday walkinToday onlineToday
      tripsToday tripsDeparted tripsCompleted tripsNotStarted tripsCancelled avgOccupancyPct
      activeBuses activeEmployees
      revenueByRoute { routeFrom routeTo revenue ticketCount }
      revenueByStation { stationName revenue ticketCount }
      topSellers { employeeName ticketsSold revenue }
      trips {
        id routeFrom routeTo departureTime busNumber status
        availableSeats totalSeats hasBus hasDriver hasConductor
        walkinCount onlineCount runStatus
      }
      alerts { severity type message tripId }
    }
  }
`;

export function useCompanyDashboard(date?: string) {
  return useQuery<CompanyDashboard | null>({
    queryKey: ['company-dashboard', date ?? 'today'],
    queryFn: async () => {
      const data = await gql<{ companyDashboard: CompanyDashboard | null }>(
        COMPANY_DASHBOARD_QUERY, { date: date ?? null }
      );
      return data.companyDashboard ?? null;
    },
    staleTime: 60_000,
    enabled: !!localStorage.getItem('bus_jwt'),
  });
}

// ── Station Dashboard ─────────────────────────────────────────────────────────

export interface StationTripEntry {
  tripId: string; routeFrom: string; routeTo: string; departureTime: string;
  ticketsSold: number; revenue: number; isClosed: boolean;
}
export interface StationDashboard {
  stationName: string; revenueToday: number; ticketsToday: number;
  cashToday: number; mobileToday: number; walkinToday: number;
  trips: StationTripEntry[];
  topSellers: { employeeName: string; ticketsSold: number; revenue: number; }[];
}

export function useStationDashboard(date?: string) {
  return useQuery<StationDashboard | null>({
    queryKey: ['station-dashboard', date ?? 'today'],
    queryFn: async () => {
      const data = await gql<{ stationDashboard: StationDashboard | null }>(
        `query StationDash($date: String) {
          stationDashboard(date: $date) {
            stationName revenueToday ticketsToday cashToday mobileToday walkinToday
            trips { tripId routeFrom routeTo departureTime ticketsSold revenue isClosed }
            topSellers { employeeName ticketsSold revenue }
          }
        }`,
        { date: date ?? null }
      );
      return data.stationDashboard ?? null;
    },
    staleTime: 60_000,
    enabled: !!localStorage.getItem('bus_jwt'),
  });
}

// ── Conductor Dashboard ────────────────────────────────────────────────────────

export interface ConductorDashboard {
  tripId: string; routeFrom: string; routeTo: string; departureTime: string;
  busRegistration?: string; runStatus: string; totalSeats: number;
  boardedCount: number; confirmedCount: number; walkinRevenue: number; walkinCount: number;
  passengers: {
    bookingId: string; passengerName: string; fromStop: string; toStop: string;
    seats: string[]; status: string; isWalkin: boolean;
  }[];
}

export function useConductorDashboard(tripId: string | null, travelDate: string | null) {
  return useQuery<ConductorDashboard | null>({
    queryKey: ['conductor-dashboard', tripId, travelDate],
    queryFn: async () => {
      const data = await gql<{ conductorDashboard: ConductorDashboard | null }>(
        `query ConductorDash($tripId: ID!, $travelDate: String!) {
          conductorDashboard(tripId: $tripId, travelDate: $travelDate) {
            tripId routeFrom routeTo departureTime busRegistration runStatus
            totalSeats boardedCount confirmedCount walkinRevenue walkinCount
            passengers { bookingId passengerName fromStop toStop seats status isWalkin }
          }
        }`,
        { tripId, travelDate }
      );
      return data.conductorDashboard ?? null;
    },
    staleTime: 30_000,
    enabled: !!tripId && !!travelDate,
  });
}

// ── Platform Stats (proxy via company schema context) ─────────────────────────

export interface PlatformStats {
  totalCompanies: number; pendingCompanies: number; activeCompanies: number;
  suspendedCompanies: number; totalTrips: number; activeTrips: number;
  totalBookings: number; confirmedBookings: number; revenueTotal: number;
}

export function usePlatformStats() {
  return useQuery<PlatformStats | null>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const data = await gql<{ platformStats: PlatformStats | null }>(
        `{ platformStats {
            totalCompanies pendingCompanies activeCompanies suspendedCompanies
            totalTrips activeTrips totalBookings confirmedBookings revenueTotal
          } }`
      );
      return data.platformStats ?? null;
    },
    staleTime: 120_000,
    enabled: !!localStorage.getItem('bus_jwt'),
  });
}

// ── Station Expenses ───────────────────────────────────────────────────────────

export interface StationExpense {
  id: string;
  expenseType: string;
  amount: number;
  description: string;
  expenseDate: string;
  status: string;
  stationName: string | null;
  loggedByName: string;
  recipientName: string | null;
  recipientConfirmed: boolean;
  recipientConfirmedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string;
  createdAt: string;
}

export interface ShiftSupplement {
  id: string;
  shiftId: string;
  shiftDate: string;
  amount: number;
  notes: string;
  status: string;
  collectedByName: string | null;
  collectedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

const STATION_EXPENSE_FIELDS = `
  id expenseType amount description expenseDate status stationName
  loggedByName recipientName recipientConfirmed recipientConfirmedAt
  approvedAt rejectionReason createdAt
`;

const SUPPLEMENT_FIELDS = `
  id shiftId shiftDate amount notes status
  collectedByName collectedAt approvedAt createdAt
`;

export function useMyStationExpenses(dateFrom?: string, dateTo?: string) {
  return useQuery<StationExpense[]>({
    queryKey: ['myStationExpenses', dateFrom, dateTo],
    queryFn: async () => {
      const data = await gql<{ myStationExpenses: StationExpense[] }>(
        `query MyStationExpenses($dateFrom: String, $dateTo: String) {
           myStationExpenses(dateFrom: $dateFrom, dateTo: $dateTo) { ${STATION_EXPENSE_FIELDS} }
         }`,
        { dateFrom, dateTo },
      );
      return data.myStationExpenses ?? [];
    },
  });
}

export function usePendingStationExpenses() {
  return useQuery<StationExpense[]>({
    queryKey: ['pendingStationExpenses'],
    queryFn: async () => {
      const data = await gql<{ pendingStationExpenses: StationExpense[] }>(
        `{ pendingStationExpenses { ${STATION_EXPENSE_FIELDS} } }`,
      );
      return data.pendingStationExpenses ?? [];
    },
  });
}

export function useMyPendingReceipts() {
  return useQuery<StationExpense[]>({
    queryKey: ['myPendingReceipts'],
    queryFn: async () => {
      const data = await gql<{ myPendingReceipts: StationExpense[] }>(
        `{ myPendingReceipts { ${STATION_EXPENSE_FIELDS} } }`,
      );
      return data.myPendingReceipts ?? [];
    },
  });
}

export function useMyShiftSupplements() {
  return useQuery<ShiftSupplement[]>({
    queryKey: ['myShiftSupplements'],
    queryFn: async () => {
      const data = await gql<{ myShiftSupplements: ShiftSupplement[] }>(
        `{ myShiftSupplements { ${SUPPLEMENT_FIELDS} } }`,
      );
      return data.myShiftSupplements ?? [];
    },
  });
}

export function usePendingShiftSupplements() {
  return useQuery<ShiftSupplement[]>({
    queryKey: ['pendingShiftSupplements'],
    queryFn: async () => {
      const data = await gql<{ pendingShiftSupplements: ShiftSupplement[] }>(
        `{ pendingShiftSupplements { ${SUPPLEMENT_FIELDS} } }`,
      );
      return data.pendingShiftSupplements ?? [];
    },
  });
}

export function useStationPendingSupplements() {
  return useQuery<ShiftSupplement[]>({
    queryKey: ['stationPendingSupplements'],
    queryFn: async () => {
      const data = await gql<{ stationPendingSupplements: ShiftSupplement[] }>(
        `{ stationPendingSupplements { ${SUPPLEMENT_FIELDS} } }`,
      );
      return data.stationPendingSupplements ?? [];
    },
  });
}
