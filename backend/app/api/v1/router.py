from fastapi import APIRouter

from app.api.v1 import (
    addresses,
    admin,
    auth,
    banners,
    blog,
    cart,
    categories,
    health,
    orders,
    payments,
    products,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(addresses.router)
api_router.include_router(orders.router)
api_router.include_router(payments.router)
api_router.include_router(admin.router)
api_router.include_router(blog.router)
api_router.include_router(banners.router)
