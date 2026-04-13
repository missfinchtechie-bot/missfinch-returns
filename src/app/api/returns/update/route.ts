import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// PATCH /api/returns/update — edit return fields
export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Only allow specific fields to be updated
  const allowed = ['subtotal', 'type', 'reason', 'status', 'item_count', 'fee_per_item', 'total_fees', 'final_amount'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      update[key] = value;
    }
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase.from('returns').update(update).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log the edit
  const changedFields = Object.entries(fields).filter(([k]) => allowed.includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ');
  await supabase.from('timeline_events').insert({
    return_id: id,
    event: 'edited',
    detail: `Fields updated: ${changedFields}`,
    event_date: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
