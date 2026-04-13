// Shippo API client for generating return labels
// Docs: https://docs.goshippo.com/docs/shipments/returns

const SHIPPO_TOKEN = process.env.SHIPPO_API_KEY || '';
const API_BASE = 'https://api.goshippo.com';

// Miss Finch return address
const RETURN_ADDRESS = {
  name: 'MISSFINCHNYC (RETURNS)',
  street1: '224 W 35th St',
  street2: 'Ste 1400',
  city: 'New York',
  state: 'NY',
  zip: '10001-2530',
  country: 'US',
  phone: '',
  email: 'returns@missfinchnyc.com',
};

async function shippoRequest(endpoint: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `ShippoToken ${SHIPPO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo API error ${res.status}: ${text}`);
  }

  return res.json();
}

// Generate a return label for a customer
// Scan-based: free to generate, only charged when used
export async function createReturnLabel(customerAddress: {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  email?: string;
}) {
  // Step 1: Create shipment with is_return flag
  // For returns: address_from = customer, address_to = us
  // Shippo swaps them automatically for USPS/FedEx/UPS
  const shipment = await shippoRequest('/shipments/', 'POST', {
    address_from: {
      ...customerAddress,
      country: customerAddress.country || 'US',
    },
    address_to: RETURN_ADDRESS,
    parcels: [{
      length: '14',
      width: '10',
      height: '4',
      distance_unit: 'in',
      weight: '1',
      mass_unit: 'lb',
    }],
    extra: {
      is_return: true,
    },
    async: false,
  });

  // Step 2: Find cheapest USPS rate
  const uspsRates = shipment.rates
    ?.filter((r: { provider: string }) => r.provider === 'USPS')
    ?.sort((a: { amount: string }, b: { amount: string }) => parseFloat(a.amount) - parseFloat(b.amount));

  if (!uspsRates || uspsRates.length === 0) {
    throw new Error('No USPS rates available for this shipment');
  }

  const cheapestRate = uspsRates[0];

  // Step 3: Purchase the label (scan-based = only charged on use)
  const transaction = await shippoRequest('/transactions/', 'POST', {
    rate: cheapestRate.object_id,
    label_file_type: 'PDF',
    async: false,
  });

  return {
    labelUrl: transaction.label_url,
    trackingNumber: transaction.tracking_number,
    trackingUrl: transaction.tracking_url_provider,
    carrier: 'USPS',
    service: cheapestRate.servicelevel?.name || 'Ground Advantage',
    cost: parseFloat(cheapestRate.amount),
    shipmentId: shipment.object_id,
    transactionId: transaction.object_id,
  };
}

// Get tracking status for a return
export async function getTrackingStatus(carrier: string, trackingNumber: string) {
  const status = await shippoRequest(
    `/tracks/${carrier}/${trackingNumber}`
  );

  return {
    status: status.tracking_status?.status,
    statusDetail: status.tracking_status?.status_details,
    location: status.tracking_status?.location,
    eta: status.eta,
    events: status.tracking_history?.map((e: {
      status: string;
      status_details: string;
      status_date: string;
      location: { city: string; state: string };
    }) => ({
      status: e.status,
      detail: e.status_details,
      date: e.status_date,
      location: e.location ? `${e.location.city}, ${e.location.state}` : null,
    })),
  };
}
