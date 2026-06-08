export interface PayerContact {
  name: string;
  email: string;
  phone: string;
}

export interface TravelerContact {
  full_name: string;
  email: string;
  phone_number: string;
}

export function payerToTravelerContact(payer: PayerContact): TravelerContact {
  return {
    full_name: payer.name,
    email: payer.email,
    phone_number: payer.phone,
  };
}

export function travelerMatchesPayer(
  traveler: TravelerContact | undefined,
  payer: PayerContact,
): boolean {
  if (!traveler) return false;
  const name = payer.name.trim();
  const email = payer.email.trim().toLowerCase();
  const phone = payer.phone.trim();
  if (!name && !email && !phone) return false;
  return (
    traveler.full_name.trim() === name &&
    traveler.email.trim().toLowerCase() === email &&
    traveler.phone_number.trim() === phone
  );
}

export function applyPayerToFirstTraveler<T extends TravelerContact>(
  passengers: T[],
  payer: PayerContact,
): T[] {
  if (!passengers.length) return passengers;
  const next = [...passengers];
  next[0] = { ...next[0], ...payerToTravelerContact(payer) };
  return next;
}
