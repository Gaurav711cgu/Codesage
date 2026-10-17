export interface UserProfile {
  user_id: string;
  email: string;
}

export interface BillingInvoice {
  customer_id: string;
  subtotal: number;
  tax: number;
  total: number;
}

export async function fetchUserProfile(userId: string, token: string): Promise<UserProfile> {
  const response = await fetch(`/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }
  return response.json();
}

export const requestBillingSummary = async (items: Array<{ price: number; qty: number }>, userId: string): Promise<BillingInvoice> => {
  const response = await fetch('/api/billing/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_items: items, user_id: userId }),
  });
  return response.json();
};
