#!/usr/bin/env python3
"""Get all categories and sample variant structures."""

import asyncio
import json
from collections import defaultdict
from app.db.session import get_db
from app.db.models import Product, Category
from sqlalchemy import select


async def main():
    """Query categories and analyze variant structures."""
    async for db in get_db():
        # Get all categories
        cat_result = await db.execute(select(Category))
        categories = cat_result.scalars().all()
        
        print('=' * 80)
        print('ALL CATEGORIES:')
        print('=' * 80)
        for cat in categories:
            parent_info = f" (Parent: {cat.parent.name})" if cat.parent else ""
            print(f'{cat.id}. {cat.name}{parent_info}')
        
        # Get products with variants grouped by category
        result = await db.execute(
            select(Product).where(Product.variants.isnot(None))
        )
        products = result.scalars().all()
        
        category_map = {c.id: c.name for c in categories}
        products_by_category = defaultdict(list)
        
        for product in products:
            cat_name = category_map.get(product.category_id, "Unknown")
            products_by_category[cat_name].append(product)
        
        print('\n' + '=' * 80)
        print('CURRENT VARIANT STRUCTURE BY CATEGORY:')
        print('=' * 80)
        
        for cat_name in sorted(products_by_category.keys()):
            products_list = products_by_category[cat_name]
            print(f'\n{cat_name}:')
            print(f'  Products with variants: {len(products_list)}')
            
            # Get variant keys from first product
            if products_list and products_list[0].variants:
                variant_keys = list(products_list[0].variants.keys())
                print(f'  Variant structure keys: {variant_keys}')
                
                # Show the actual option names used
                if 'colors' in products_list[0].variants:
                    print(f'  ✓ Has "colors" (Pot Colors)')
                if 'pot_types' in products_list[0].variants:
                    print(f'  ✓ Has "pot_types" (Pot Material Types)')
                if 'sizes' in products_list[0].variants:
                    sizes = [s['name'] for s in products_list[0].variants['sizes']]
                    print(f'  ✓ Has "sizes": {sizes}')
        
        print('\n' + '=' * 80)
        print('SUMMARY:')
        print('=' * 80)
        print(f'Total categories: {len(categories)}')
        print(f'Total products with variants: {len(products)}')
        print(f'Categories with variant products: {len(products_by_category)}')
        
        break


if __name__ == "__main__":
    asyncio.run(main())
