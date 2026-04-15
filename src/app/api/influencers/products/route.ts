import { NextRequest, NextResponse } from 'next/server';
import { shopifyGraphQL } from '@/lib/shopify';

const PRODUCT_SEARCH_QUERY = `
  query ProductSearch($q: String!) {
    products(first: 15, query: $q) {
      edges {
        node {
          id title handle
          featuredImage { url(transform: {maxWidth: 120}) }
          variants(first: 20) {
            edges {
              node {
                id title sku
                price
                availableForSale
                inventoryQuantity
                selectedOptions { name value }
              }
            }
          }
        }
      }
    }
  }
`;

type Variant = {
  id: string; title: string; sku: string | null;
  price: string; availableForSale: boolean; inventoryQuantity: number | null;
  selectedOptions: { name: string; value: string }[];
};
type Product = {
  id: string; title: string; handle: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: Variant }[] };
};

export async function GET(req: NextRequest) {
  const search = new URL(req.url).searchParams.get('search') || '';
  if (!search.trim()) return NextResponse.json({ products: [] });

  try {
    const data = await shopifyGraphQL(PRODUCT_SEARCH_QUERY, { q: `title:*${search}*` });
    const products = (data?.products?.edges || []).map(({ node }: { node: Product }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      image: node.featuredImage?.url || null,
      variants: node.variants.edges.map(({ node: v }) => {
        const sizeOpt = v.selectedOptions.find(o => o.name.toLowerCase() === 'size');
        return {
          id: v.id,
          title: v.title,
          sku: v.sku,
          price: parseFloat(v.price) || 0,
          size: sizeOpt?.value || v.title,
          inStock: v.availableForSale,
          inventory: v.inventoryQuantity,
        };
      }),
    }));
    return NextResponse.json({ products });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Shopify error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
