import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// POST /api/returns/maintenance — runs on dashboard load
// 1. inbox items delivered 30+ days ago → old (backlog)
// 2. shipping items shipped 45+ days ago → done/lost
export async function POST() {
  const supabase = getServiceClient();
  const now = new Date();

  // ── 1. Inbox → Backlog (30+ days since delivered_to_us) ──
  const backlogCutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
  
  const { data: staleInbox, error: inboxErr } = await supabase
    .from('returns')
    .update({ status: 'old', updated_at: now.toISOString() })
    .eq('status', 'inbox')
    .lt('delivered_to_us', backlogCutoff)
    .select('id, order_number, customer_name');

  if (inboxErr) {
    console.error('Maintenance: inbox→backlog error:', inboxErr);
  }

  // Log timeline events for moved items
  if (staleInbox && staleInbox.length > 0) {
    const events = staleInbox.map(r => ({
      return_id: r.id,
      event: 'Moved to backlog',
      detail: 'Delivered 30+ days ago with no action — auto-moved to backlog',
      event_date: now.toISOString(),
    }));
    await supabase.from('timeline_events').insert(events);
  }

  // ── 2. Shipping → Lost (45+ days since customer_shipped) ──
  const lostCutoff = new Date(now.getTime() - 45 * 86400000).toISOString();
  
  const { data: staleShipping, error: shippingErr } = await supabase
    .from('returns')
    .update({ 
      status: 'done', 
      outcome: 'lost',
      processed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('status', 'shipping')
    .lt('customer_shipped', lostCutoff)
    .select('id, order_number, customer_name');

  if (shippingErr) {
    console.error('Maintenance: shipping→lost error:', shippingErr);
  }

  // Also catch shipping items with no customer_shipped date but return_requested 45+ days ago
  const { data: staleShippingNoDate, error: shippingErr2 } = await supabase
    .from('returns')
    .update({ 
      status: 'done', 
      outcome: 'lost',
      processed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('status', 'shipping')
    .is('customer_shipped', null)
    .lt('return_requested', lostCutoff)
    .select('id, order_number, customer_name');

  if (shippingErr2) {
    console.error('Maintenance: shipping(no date)→lost error:', shippingErr2);
  }

  const allLost = [...(staleShipping || []), ...(staleShippingNoDate || [])];

  if (allLost.length > 0) {
    const events = allLost.map(r => ({
      return_id: r.id,
      event: 'Marked as lost',
      detail: 'In transit 45+ days with no delivery — auto-marked as lost',
      event_date: now.toISOString(),
    }));
    await supabase.from('timeline_events').insert(events);
  }

  return NextResponse.json({
    movedToBacklog: staleInbox?.length || 0,
    markedLost: allLost.length,
  });
}
