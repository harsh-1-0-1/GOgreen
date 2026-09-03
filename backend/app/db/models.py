import enum
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    addresses: Mapped[list["Address"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    orders: Mapped[list["Order"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    cart: Mapped["Cart | None"] = relationship(back_populates="user", uselist=False)
    reviews: Mapped[list["ProductReview"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    parent: Mapped["Category | None"] = relationship(
        back_populates="children", remote_side="Category.id"
    )
    children: Mapped[list["Category"]] = relationship(back_populates="parent")
    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    original_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    images: Mapped[list | None] = mapped_column(JSON, default=list)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)
    care_tips: Mapped[list | None] = mapped_column(JSON, default=list)
    how_to_guide: Mapped[str | None] = mapped_column(Text, nullable=True)
    sunlight: Mapped[str | None] = mapped_column(String(100), nullable=True)
    watering: Mapped[str | None] = mapped_column(String(100), nullable=True)
    badge: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    variants: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    promise_banner_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    why_plantoga_banner_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    care_card_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    faqs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    display_section: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    category: Mapped["Category"] = relationship(back_populates="products")
    reviews: Mapped[list["ProductReview"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class ReviewStatus(str, enum.Enum):
    PUBLISHED = "published"
    PENDING = "pending"
    REJECTED = "rejected"


class ProductReview(Base):
    __tablename__ = "product_reviews"
    __table_args__ = (
        UniqueConstraint("product_id", "user_id", name="uq_product_reviews_product_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    guest_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(140), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.PUBLISHED, index=True)
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=False)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    reported_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    product: Mapped["Product"] = relationship(back_populates="reviews")
    user: Mapped["User | None"] = relationship(back_populates="reviews")


class Cart(Base):
    __tablename__ = "carts"
    __table_args__ = (
        # Partial unique indexes matching migration a2b3c4d5e6f7.
        # One active cart per user and one per guest session.
        Index("ix_carts_user_id_unique", "user_id", unique=True,
              postgresql_where="user_id IS NOT NULL"),
        Index("ix_carts_session_id_unique", "session_id", unique=True,
              postgresql_where="session_id IS NOT NULL"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    user: Mapped["User | None"] = relationship(back_populates="cart")
    items: Mapped[list["CartItem"]] = relationship(back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cart_id: Mapped[int] = mapped_column(Integer, ForeignKey("carts.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    selected_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    cart: Mapped["Cart"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False, default="razorpay")
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.PENDING
    )
    partial_refund_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    address_id: Mapped[int] = mapped_column(Integer, ForeignKey("addresses.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="orders")
    address: Mapped["Address"] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    refunds: Mapped[list["Refund"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    selected_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    resolved_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class Refund(Base):
    """Tracks each individual refund event from Razorpay (supports partial refunds)."""
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    razorpay_refund_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)  # in rupees
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    order: Mapped["Order"] = relationship(back_populates="refunds")


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    line1: Mapped[str] = mapped_column(String(500), nullable=False)
    line2: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="addresses")


class BlogCategory(str, enum.Enum):
    GROW = "GROW"
    CARE = "CARE"
    DIY = "DIY"
    TIPS = "TIPS"


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    excerpt: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    category: Mapped[BlogCategory] = mapped_column(Enum(BlogCategory), nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cta_text: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cta_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    badge_text: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bg_color: Mapped[str] = mapped_column(String(20), default="#F5F0E8")
    text_color: Mapped[str] = mapped_column(String(20), default="#1B4332")
    position: Mapped[int] = mapped_column(Integer, default=0)
    placement: Mapped[str] = mapped_column(String(20), default="hero")
    target_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=_utcnow, nullable=True
    )


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    razorpay_event_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# Event listeners for Product model
@event.listens_for(Product, "before_insert")
@event.listens_for(Product, "before_update")
def sync_stock_qty(mapper, connection, target):
    """Derive stock_qty from variants.stock before every write.

    This ensures stock_qty is always the sum of variant stocks, even if
    the client sends an incorrect value or the DB is edited directly via ORM.

    Only applies when variants are present and have a stock dict.
    For non-variant products, the client-sent stock_qty is used as-is.
    """
    if target.variants and "stock" in target.variants:
        target.stock_qty = sum(int(v or 0) for v in target.variants["stock"].values())


class DamageClaimStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REPLACEMENT_SHIPPED = "replacement_shipped"
    REFUND_ISSUED = "refund_issued"
    CLOSED = "closed"


class DamageClaim(Base):
    __tablename__ = "damage_claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Human-readable ticket ID generated after insert: PLG-DR-000001
    ticket_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    # Nullable: one claim covers the whole order in v1; reserved for per-item in v2
    order_item_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("order_items.id"), nullable=True)
    issue_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # JSON array of S3 / local storage keys
    photo_keys: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[DamageClaimStatus] = mapped_column(
        # Persist the enum *values* (lowercase), matching the damageclaimstatus
        # enum type created in the e3f4a5b6c7d8 migration.
        Enum(DamageClaimStatus, values_callable=lambda e: [m.value for m in e]),
        default=DamageClaimStatus.SUBMITTED,
        index=True,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user: Mapped["User"] = relationship("User")
    order: Mapped["Order"] = relationship("Order")
    order_item: Mapped["OrderItem | None"] = relationship("OrderItem")


class StoreSettings(Base):
    """Single-row table that holds all mutable store configuration.

    The row is always created with id=1 on first access (upsert).
    """
    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Store info
    store_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Plantoga")
    support_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    support_phone: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    warehouse_address: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Payments
    cod_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Shipping
    free_shipping_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=999)
    flat_shipping_rate: Mapped[int] = mapped_column(Integer, nullable=False, default=75)

    # Notifications
    notify_new_order: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_low_stock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # SEO
    meta_title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    meta_description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Branding
    primary_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#2D6A4F")
    accent_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#52B788")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class DoNotForgetProduct(Base):
    """Curated list of products to show in "Do Not Forget to Buy" section in cart."""
    __tablename__ = "do_not_forget_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    product: Mapped["Product"] = relationship("Product")


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    video: Mapped[str] = mapped_column(String(500), nullable=False)       # storage key
    thumbnail: Mapped[str | None] = mapped_column(String(500), nullable=True)     # poster frame, optional
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)        # e.g. small label overlay, optional
    linked_product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    linked_product: Mapped["Product | None"] = relationship("Product")
