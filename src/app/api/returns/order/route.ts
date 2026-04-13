import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/shopify';

// GET /api/returns/order?order_number=#8657
// Fetches live Shopify order data for the detail panel
export async function GET(req: NextRequest) {
  const orderNumber = new URL(req.url).searchParams.get('order_number');
  if (!orderNumber) {
    return NextResponse.json({ error: 'Missing order_number' }, { status: 400 });
  }

  try {
    const order = await getOrder(orderNumber);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Flatten for frontend consumption
    return NextResponse.json({
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      total: order.totalPriceSet?.shopMoney?.amount,
      currentTotal: order.currentTotalPriceSet?.shopMoney?.amount,
      refundable: order.refundable,
      customer: order.customer ? {
        id: order.customer.id,
        name: order.customer.displayName,
        email: order.customer.email,
        phone: order.customer.phone,
        orderCount: order.customer.numberOfOrders,
        totalSpent: order.customer.amountSpent?.amount,
      } : null,
      shippingAddress: order.shippingAddress ? {
        name: order.shippingAddress.name,
        address1: order.shippingAddress.address1,
        address2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        province: order.shippingAddress.provinceCode,
        zip: order.shippingAddress.zip,
        country: order.shippingAddress.country,
        phone: order.shippingAddress.phone,
      } : null,
      lineItems: order.lineItems?.edges?.map((e: { node: { id: string; title: string; variantTitle: string; sku: string; quantity: number; discountedUnitPriceSet: { shopMoney: { amount: string } }; image: { url: string } | null } }) => ({
        id: e.node.id,
        title: e.node.title,
        variant: e.node.variantTitle,
        sku: e.node.sku,
        quantity: e.node.quantity,
        price: e.node.discountedUnitPriceSet?.shopMoney?.amount,
        image: e.node.image?.url,
      })) || [],
      fulfillments: order.fulfillments?.map((f: { trackingInfo: { number: string; company: string; url: string }[]; deliveredAt: string }) => ({
        tracking: f.trackingInfo?.[0],
        deliveredAt: f.deliveredAt,
      })) || [],
      gateways: order.paymentGatewayNames,
      tags: order.tags,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch order';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
