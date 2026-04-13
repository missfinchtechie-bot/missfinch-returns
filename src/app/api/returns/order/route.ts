import { NextRequest, NextResponse } from 'next/server';
import { shopifyGraphQL } from '@/lib/shopify';

// GET /api/returns/order?order_number=#8657
export async function GET(req: NextRequest) {
  const orderNumber = new URL(req.url).searchParams.get('order_number');
  if (!orderNumber) return NextResponse.json({ error: 'Missing order_number' }, { status: 400 });

  try {
    const query = `
      query GetOrder($q: String!) {
        orders(first: 1, query: $q) {
          edges {
            node {
              id name createdAt
              totalPriceSet { shopMoney { amount } }
              subtotalPriceSet { shopMoney { amount } }
              totalDiscountsSet { shopMoney { amount } }
              totalShippingPriceSet { shopMoney { amount } }
              currentTotalPriceSet { shopMoney { amount } }
              refundable
              discountCodes
              tags
              customer {
                id displayName email phone numberOfOrders
                amountSpent { amount }
              }
              shippingAddress {
                name address1 address2 city provinceCode zip country phone
              }
              lineItems(first: 20) {
                edges {
                  node {
                    id title variantTitle sku quantity
                    originalUnitPriceSet { shopMoney { amount } }
                    discountedUnitPriceSet { shopMoney { amount } }
                    totalDiscountSet { shopMoney { amount } }
                    image { url(transform: {maxWidth: 200}) }
                  }
                }
              }
              fulfillments(first: 10) {
                trackingInfo { number url company }
                deliveredAt createdAt status
                events(first: 30) {
                  edges {
                    node {
                      happenedAt status message city province
                    }
                  }
                }
              }
              transactions(first: 10) {
                kind status gateway
                amountSet { shopMoney { amount } }
                createdAt
              }
              paymentGatewayNames
              channelInformation { channelDefinition { handle channelName } }
              sourceName
            }
          }
        }
      }
    `;

    const data = await shopifyGraphQL(query, { q: `name:${orderNumber}` });
    const order = data.orders.edges[0]?.node;
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Find successful capture transaction
    const capture = order.transactions?.find((t: { kind: string; status: string }) => t.kind === 'CAPTURE' && t.status === 'SUCCESS');

    return NextResponse.json({
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      total: order.totalPriceSet?.shopMoney?.amount,
      subtotal: order.subtotalPriceSet?.shopMoney?.amount,
      totalDiscount: order.totalDiscountsSet?.shopMoney?.amount,
      shipping: order.totalShippingPriceSet?.shopMoney?.amount,
      currentTotal: order.currentTotalPriceSet?.shopMoney?.amount,
      refundable: order.refundable,
      discountCodes: order.discountCodes || [],
      tags: order.tags || [],
      gateway: capture?.gateway || order.paymentGatewayNames?.[0] || null,
      channel: order.channelInformation?.channelDefinition?.channelName || order.sourceName || null,
      customer: order.customer ? {
        id: order.customer.id,
        name: order.customer.displayName,
        email: order.customer.email,
        phone: order.customer.phone,
        orderCount: order.customer.numberOfOrders,
        totalSpent: order.customer.amountSpent?.amount,
      } : null,
      shippingAddress: order.shippingAddress,
      lineItems: order.lineItems?.edges?.map((e: { node: Record<string, unknown> }) => {
        const n = e.node as { id: string; title: string; variantTitle: string; sku: string; quantity: number; originalUnitPriceSet: { shopMoney: { amount: string } }; discountedUnitPriceSet: { shopMoney: { amount: string } }; totalDiscountSet: { shopMoney: { amount: string } }; image: { url: string } | null };
        return {
          id: n.id,
          title: n.title,
          variant: n.variantTitle,
          sku: n.sku,
          quantity: n.quantity,
          retailPrice: n.originalUnitPriceSet?.shopMoney?.amount,
          paidPrice: n.discountedUnitPriceSet?.shopMoney?.amount,
          discount: n.totalDiscountSet?.shopMoney?.amount,
          image: n.image?.url,
        };
      }) || [],
      fulfillments: order.fulfillments?.map((f: { trackingInfo: { number: string; company: string; url: string }[]; deliveredAt: string; createdAt: string; status: string; events: { edges: { node: { happenedAt: string; status: string; message: string; city: string; province: string } }[] } }) => ({
        tracking: f.trackingInfo?.[0] || null,
        deliveredAt: f.deliveredAt,
        shippedAt: f.createdAt,
        status: f.status,
        events: f.events?.edges?.map(e => ({
          date: e.node.happenedAt,
          status: e.node.status,
          message: e.node.message,
          location: [e.node.city, e.node.province].filter(Boolean).join(', ') || null,
        })) || [],
      })) || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
