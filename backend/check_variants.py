#!/usr/bin/env python3
"""Check current variant options in the database."""

import asyncio
import sys
from app.db.session import get_db
from app.db.models import Product, Category
from sqlalchemy import select


async def check_variants():
    """Query and display all products with variants."""
    async for db in get_db():
        # Get products with variants
        result = await db.execute(
            select(Product).where(Product.variants.isnot(None))
        )
        products = result.scalars().all()
        
        # Get categories
        cat_result = await db.execute(select(Category))
        categories = cat_result.scalars().all()
        category_map = {c.id: c.name for c in categories}
        
        print('CURRENT PRODUCTS WITH VARIANTS:')
        print('=' * 80)
        
        for product in products:
            if product.variants:
                print(f'\nProduct: {product.name} (ID: {product.id})')
                print(f'Category: {category_map.get(product.category_id, "Unknown")}')
                
                if 'options' in product.variants:
                    print(f'Variant Options:')
                    for option_name, option_values in product.variants['options'].items():
                        print(f'  - {option_name}: {option_values}')
                
                if 'prices' in product.variants:
                    print(f'Price combinations: {len(product.variants["prices"])}')
                
                if 'stock' in product.variants:
                    print(f'Stock combinations: {len(product.variants["stock"])}')
        
        print('\n' + '=' * 80)
        print(f'\nTotal products with variants: {len(products)}')
        
        # Get unique variant option names across all products
        all_option_names = set()
        for product in products:
            if product.variants and 'options' in product.variants:
                all_option_names.update(product.variants['options'].keys())
        
        print('\nUnique Variant Option Names Currently Used:')
        for name in sorted(all_option_names):
            print(f'  - {name}')
        
        break


if __name__ == "__main__":
    asyncio.run(check_variants())
