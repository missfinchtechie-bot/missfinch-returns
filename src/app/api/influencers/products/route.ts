import { NextRequest, NextResponse } from 'next/server';
import { shopifyGraphQL } from '@/lib/shopify';

const PRODUCT_SEARCH_QUERY = `
  query SearchProducts($q: String!) {
    products(first: 15, query: $q, sortKey: TITLE) {
      edges {
        node {
          id title handle status
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
  id: string; title: string; handle: string; status: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: Variant }[] };
};

export async function GET(req: NextRequest) {
  const search = new URL(req.url).searchParams.get('search') || '';
  if (!search.trim()) return NextResponse.json({ products: [] });

  try {
    const data = await shopifyGraphQL(PRODUCT_SEARCH_QUERY, {
      q: `title:*${search}* AND status:active`,
    });
    const products = (data?.products?.edges || [])
      .map(({ node }: { node: Product }) => node)
      .filter((p: Product) => p.status === 'ACTIVE')
      .map((p: Product) => {
        const activeVariants = p.variants.edges
          .map(({ node: v }) => v)
          .filter(v => v.availableForSale && (v.inventoryQuantity === null || v.inventoryQuantity > 0));
        return {
          id: p.id,
          title: p.title,
          handle: p.handle,
          image: p.featuredImage?.url || null,
          variants: activeVariants.map(v => {
            const sizeOpt = v.selectedOptions.find(o => o.name.toLowerCase() === 'size');
            return {
              id: v.id,
              title: v.title,
              sku: v.sku,
              price: parseFloat(v.price) || 0,
              size: sizeOpt?.value || v.title,
              inStock: true,
              inventory: v.inventoryQuantity,
            };
          }),
        };
      })
      .filter((p: { variants: unknown[] }) => p.variants.length > 0);
    return NextResponse.json({ products });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Shopify error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
