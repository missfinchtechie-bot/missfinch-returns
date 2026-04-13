import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// POST /api/webhooks/shippo — Shippo tracking webhook
// Shippo sends tracking updates here when a return label's status changes
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, event } = body;

  // Only handle track_updated events
  if (event !== 'track_updated' || !data) {
    return NextResponse.json({ ok: true });
  }

  const trackingNumber = data.tracking_number;
  const trackingStatus = data.tracking_status?.status; // UNKNOWN, PRE_TRANSIT, TRANSIT, DELIVERED, RETURNED, FAILURE
  const statusDetail = data.tracking_status?.status_details;

  if (!trackingNumber) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getServiceClient();

  // Map Shippo status to readable text
  const statusMap: Record<string, string> = {
    UNKNOWN: 'Unknown',
    PRE_TRANSIT: 'Pre-transit',
    TRANSIT: 'In transit',
    DELIVERED: 'Delivered',
    RETURNED: 'Returned to sender',
    FAILURE: 'Delivery failed',
  };

  const readableStatus = statusMap[trackingStatus] || trackingStatus || 'Unknown';
  const now = new Date().toISOString();

  // Build update
  const update: Record<string, unknown> = {
    tracking_status: readableStatus,
    updated_at: now,
  };

  // If delivered, set delivered_to_us and move to inbox
  if (trackingStatus === 'DELIVERED') {
    update.delivered_to_us = now;
    update.status = 'inbox';
  }

  // If in transit, ensure status is shipping
  if (trackingStatus === 'TRANSIT' || trackingStatus === 'PRE_TRANSIT') {
    update.status = 'shipping';
  }

  // Update by tracking number
  const { data: updated, error } = await supabase
    .from('returns')
    .update(update)
    .eq('tracking_number', trackingNumber)
    .select('id, order_number')
    .maybeSingle();

  if (error) {
    console.error('Shippo webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log timeline event
  if (updated) {
    await supabase.from('timeline_events').insert({
      return_id: updated.id,
      event: `Tracking: ${readableStatus}`,
      detail: statusDetail || `Tracking number: ${trackingNumber}`,
      event_date: now,
    });
  }

  return NextResponse.json({ ok: true, updated: !!updated });
}
