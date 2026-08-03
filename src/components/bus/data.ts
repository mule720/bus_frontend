export const CITIES = [
  'New York', 'Boston', 'Washington DC', 'Philadelphia', 'Chicago',
  'Los Angeles', 'San Francisco', 'Seattle', 'Miami', 'Atlanta',
  'Dallas', 'Houston', 'Denver', 'Phoenix', 'Las Vegas',
  'Portland', 'San Diego', 'Austin', 'Nashville', 'New Orleans',
];

export const BUS_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529145903_bf61e122.png',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529183907_ed1dd319.png',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529188580_dd6f4840.png',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529151505_e5a7b13a.jpg',
];

export const DESTINATION_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529254719_db6acaba.png',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529213511_d8d79929.png',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529210967_5bd03adc.png',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529206780_1f798982.jpg',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529211467_077bd95a.jpg',
  'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529217913_29cdd9d9.png',
];

export const HERO_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/69e3ae578b94dbe2272b5c0a_1776529128470_c46e8d0e.png';

export type Trip = {
  id: string;
  company: string;
  companyLogo: string;
  rating: number;
  from: string;
  to: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  busType: 'Standard' | 'Luxury' | 'VIP';
  amenities: string[];
  seatsAvailable: number;
  totalSeats: number;
  price: number;
  stops: string[];
  image: string;
  // Populated when trip comes from the backend
  _raw?: import('@/lib/api').BackendTrip;
};

export const POPULAR_ROUTES = [
  { from: 'New York', to: 'Boston', price: 39, duration: '4h 15m', image: DESTINATION_IMAGES[0] },
  { from: 'Los Angeles', to: 'San Francisco', price: 49, duration: '6h 30m', image: DESTINATION_IMAGES[1] },
  { from: 'Chicago', to: 'Detroit', price: 29, duration: '5h 00m', image: DESTINATION_IMAGES[2] },
  { from: 'Miami', to: 'Orlando', price: 25, duration: '3h 45m', image: DESTINATION_IMAGES[3] },
  { from: 'Seattle', to: 'Portland', price: 27, duration: '3h 20m', image: DESTINATION_IMAGES[4] },
  { from: 'Dallas', to: 'Houston', price: 32, duration: '4h 00m', image: DESTINATION_IMAGES[5] },
];

export const SAMPLE_TRIPS: Trip[] = [
  {
    id: 't1', company: 'SwiftLine Express', companyLogo: 'SL', rating: 4.8,
    from: 'New York', to: 'Boston', departTime: '06:30', arriveTime: '10:45',
    duration: '4h 15m', busType: 'Luxury',
    amenities: ['WiFi', 'AC', 'USB', 'Meals'], seatsAvailable: 12, totalSeats: 40,
    price: 45, stops: ['Hartford'], image: BUS_IMAGES[0],
  },
  {
    id: 't2', company: 'BlueCoach Travel', companyLogo: 'BC', rating: 4.6,
    from: 'New York', to: 'Boston', departTime: '08:00', arriveTime: '12:30',
    duration: '4h 30m', busType: 'Standard',
    amenities: ['WiFi', 'AC'], seatsAvailable: 24, totalSeats: 44,
    price: 29, stops: [], image: BUS_IMAGES[1],
  },
  {
    id: 't3', company: 'GoldStar Lines', companyLogo: 'GS', rating: 4.9,
    from: 'New York', to: 'Boston', departTime: '10:15', arriveTime: '14:00',
    duration: '3h 45m', busType: 'VIP',
    amenities: ['WiFi', 'AC', 'USB', 'Meals', 'Entertainment'], seatsAvailable: 6, totalSeats: 28,
    price: 69, stops: [], image: BUS_IMAGES[2],
  },
  {
    id: 't4', company: 'RapidTransit Co', companyLogo: 'RT', rating: 4.3,
    from: 'New York', to: 'Boston', departTime: '13:45', arriveTime: '18:30',
    duration: '4h 45m', busType: 'Standard',
    amenities: ['AC', 'USB'], seatsAvailable: 30, totalSeats: 44,
    price: 22, stops: ['New Haven', 'Providence'], image: BUS_IMAGES[3],
  },
  {
    id: 't5', company: 'SwiftLine Express', companyLogo: 'SL', rating: 4.8,
    from: 'New York', to: 'Boston', departTime: '16:00', arriveTime: '20:15',
    duration: '4h 15m', busType: 'Luxury',
    amenities: ['WiFi', 'AC', 'USB', 'Meals'], seatsAvailable: 18, totalSeats: 40,
    price: 42, stops: ['Hartford'], image: BUS_IMAGES[0],
  },
  {
    id: 't6', company: 'NightRider Express', companyLogo: 'NR', rating: 4.5,
    from: 'New York', to: 'Boston', departTime: '22:30', arriveTime: '02:45',
    duration: '4h 15m', busType: 'VIP',
    amenities: ['WiFi', 'AC', 'USB', 'Meals', 'Blankets'], seatsAvailable: 8, totalSeats: 32,
    price: 55, stops: [], image: BUS_IMAGES[1],
  },
];
