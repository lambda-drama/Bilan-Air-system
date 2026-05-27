// Airport
export interface Airport {
  name: string;
  code: string;
  city: string;
  country: string;
}

// Airline
export interface Airline {
  name: string;
  iata_code: string;
}

// Airplane
export interface Airplane {
  name: string;
  registration_number: string;
  airline: string;
  status: 'Active' | 'Closed';
  seat_classes: SeatClass[];
  total_rows: number;
  total_columns: number;
}

// Seat Class
export interface SeatClass {
  name: string;
  class_name: 'First Class' | 'Business' | 'Economy';
  base_price_multiplier: number;
}

// Flight Route
export interface FlightRoute {
  name: string;
  route_name: string;
  origin_airport: string;
  destination_airport: string;
}

// Flight Schedule
export interface FlightSchedule {
  name: string;
  flight_number: string;
  route: string;
  route_name?: string;
  origin_airport?: string;
  origin_code?: string;
  destination_airport?: string;
  destination_code?: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  aircraft: string;
  aircraft_name?: string;
  available_seats: number;
  status: 'Scheduled' | 'Boarding' | 'Departed' | 'Arrived' | 'Cancelled' | 'Delayed';
  base_fare?: number;
}

// Fare Rule
export interface FareRule {
  name: string;
  flight_schedule?: string;
  days_before_departure: number;
  price_increase_percentage: number;
}

// Passenger
export interface Passenger {
  name: string;
  full_name: string;
  id_number: string;
  phone_number: string;
  email: string;
  passenger_type: 'Adult' | 'Child' | 'Infant';
}

// Booking Status
export type BookingStatus = 'Reserved' | 'Paid' | 'Checked In' | 'Boarded' | 'Cancelled';

// Booking (PNR)
export interface Booking {
  name: string;
  pnr: string;
  flight_schedule: string;
  flight_number?: string;
  route_name?: string;
  departure_date?: string;
  departure_time?: string;
  passenger: string;
  passenger_name?: string;
  seat: string;
  seat_class: string;
  fare_amount: number;
  status: BookingStatus;
  payment_status: 'Unpaid' | 'Paid' | 'Refunded';
  created_at: string;
}

// Seat Inventory
export interface SeatInventory {
  name: string;
  seat_number: string;
  seat_class: string;
  status: 'Available' | 'Hold' | 'Booked';
  airplane: string;
  flight_schedule?: string;
}

// Invoice
export interface Invoice {
  name: string;
  booking: string;
  passenger: string;
  line_items: InvoiceLineItem[];
  total_amount: number;
  payment_method?: 'Cash' | 'M-Pesa';
  status: 'Unpaid' | 'Paid';
}

// Invoice Line Item
export interface InvoiceLineItem {
  description: string;
  amount: number;
}

// Payment Entry
export interface PaymentEntry {
  name: string;
  invoice: string;
  amount: number;
  payment_method: 'Cash' | 'M-Pesa';
  transaction_reference?: string;
  date: string;
  confirmed_by?: string;
}

// Baggage Tracking
export interface BaggageTracking {
  name: string;
  tracking_number: string;
  booking: string;
  traveller: string;
  aircraft: string;
  weight_kg: number;
  fee: number;
  status: 'Checked' | 'Loaded' | 'In Transit' | 'Arrived' | 'Claimed';
}

// User Roles
export type UserRole = 'Super Admin' | 'Operations Admin' | 'Booking Agent' | 'Traveller';

// User
export interface User {
  name: string;
  full_name: string;
  email: string;
  phone_number?: string;
  role: UserRole;
}

// Search Flight Params
export interface FlightSearchParams {
  origin: string;
  destination: string;
  departure_date: string;
  passengers: number;
  trip_type: 'one-way' | 'return';
  return_date?: string;
}

// Search Result
export interface FlightSearchResult {
  schedule: FlightSchedule;
  available_seats: number;
  fare: number;
  duration: string;
}

// API Response
export interface ApiResponse<T> {
  message: T;
}

export interface ApiListResponse<T> {
  data: T[];
}
