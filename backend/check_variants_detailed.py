#!/usr/bin/env python3
"""Check current variant options in the database - detailed version."""

import asyncio
import json
from app.db.session import get_db
from app.db.models import Product, Category
from sqlalchemy import select


async def check_variants():
    """Query and display all products with variants."""
    async for db in get_db():
        # Get products with variants
        result = await db.execute(
            select(Product).where(Product.variants.isnot(None)).limit(5)
        )
        products = result.scalars().all()
        
        # Get categories
        cat_result = await db.execute(select(Category))
        categories = cat_result.scalars().all()
        category_map = {c.id: c.name for c in categories}
        
        print('SAMPLE PRODUCTS WITH VARIANTS (First 5):')
        print('=' * 80)
        
        for product in products:
            if product.variants:
                print(f'\nProduct: {product.name} (ID: {product.id})')
                print(f'Category: {category_map.get(product.category_id, "Unknown")}')
                print(f'Variant Structure:')
                print(json.dumps(product.variants, indent=2))
                print('-' * 80)
        
        # Get all products to find unique option names
        all_result = await db.execute(
            select(Product).where(Product.variants.isnot(None))
        )
        all_products = all_result.scalars().all()
        
        # Get unique variant option names across all products
        all_option_names = set()
        category_options = {}
        
        for product in all_products:
            if product.variants and 'options' in product.variants:
                cat_name = category_map.get(product.category_id, "Unknown")
                if cat_name not in category_options:
                    category_options[cat_name] = set()
                
                option_names = list(product.variants['options'].keys())
                all_option_names.update(option_names)
                category_options[cat_name].update(option_names)
        
        print('\n' + '=' * 80)
        print('\nUNIQUE VARIANT OPTION NAMES CURRENTLY USED:')
        for name in sorted(all_option_names):
            print(f'  - {name}')
        
        print('\n' + '=' * 80)
        print('\nVARIANT OPTIONS BY CATEGORY:')
        for cat_name, options in sorted(category_options.items()):
            print(f'\n{cat_name}:')
            for opt in sorted(options):
                print(f'  - {opt}')
        
        print('\n' + '=' * 80)
        print(f'\nTotal products with variants: {len(all_products)}')
        
        break


if __name__ == "__main__":
    asyncio.run(check_variants())
