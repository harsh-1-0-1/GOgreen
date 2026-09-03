export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_admin: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  children?: Category[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  original_price: number | null;
  stock_qty: number;
  category_id: number;
  images: string[];
  tags: string[];
  care_tips: string[];
  how_to_guide: string | null;
  sunlight: string | null;
  watering: string | null;
  badge: string | null;
  display_section: string | null;
  is_active: boolean;
  created_at: string;
  variants: ProductVariants | null;
  promise_banner_image?: string | null;
  why_plantoga_banner_image?: string | null;
  care_card_image?: string | null;
  faqs?: FAQItem[] | null;
}

// New flexible variant system types
export interface VariantOption {
  id: string;
  name: string;
  price: number;
  /** Legacy per-option stock — no longer used for availability (stock_map is the
   *  source of truth per combination). Retained in the API as the migration source. */
  stock?: number;
  images?: string[];
  color_hex?: string;
}

export interface VariantGroup {
  id: string;
  label: string;
  required?: boolean;
  /** When true, the storefront renders every defined option regardless of stock
   *  (e.g. always show Small/Medium/Large); colour groups without this keep hiding
   *  out-of-stock options. */
  always_show_options?: boolean;
  options: VariantOption[];
}

export interface ProductVariants {
  variant_groups: VariantGroup[];
  default_image?: string;
  /** Per-combination stock, keyed by combo_key (option IDs joined by "__"). Dense: every combo has a row, 0 = out of stock. */
  stock_map?: Record<string, number>;
  /** Per-combination images, keyed by combo_key (admin combinations table). */
  image_map?: Record<string, string[]>;
}

// Old variant types - kept for backward compatibility during migration
export interface ProductVariantColor {
  name: string;
  hex: string;
  slug: string;
  image_url?: string;
}

export interface ProductVariantPotType {
  name: string;
  slug: string;
  price_modifier: number;
  image_url?: string;
}

export interface ProductVariantSize {
  name: string;
  slug: string;
  price_modifier: number;
  description?: string;
}

// Old format - deprecated but kept for backward compatibility
export interface ProductVariantsOld {
  colors: ProductVariantColor[];
  pot_types: ProductVariantPotType[];
  sizes?: ProductVariantSize[];
  image_map: Record<string, string[]>;
  default_image: string;
  stock: Record<string, number>;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface ReviewSummary {
  average_rating: number;
  review_count: number;
  rating_counts: Record<number, number>;
}

export interface ProductReview {
  id: number;
  product_id: number;
  user_id: number | null;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  media_url: string | null;
  youtube_url: string | null;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewListResponse {
  items: ProductReview[];
  summary: ReviewSummary;
  total: number;
  page: number;
  pages: number;
  limit: number;
}

// Variant snapshot entry for order history display
export interface VariantSnapshotEntry {
  label: string;
  name: string;
  price: number;
}

// Selected options can be:
// - Old format: { "color": "terracotta", "pot_type": "ceramic" }
// - New format: ["opt_1", "opt_2"]
// - Or with snapshot: { "option_ids": ["opt_1"], "snapshot": [{label, name, price}] }
export type SelectedOptions = 
  | Record<string, string>  // Old format
  | string[]                // New format (list of option IDs)
  | {                       // New format with snapshot (from orders)
      option_ids: string[];
      snapshot: VariantSnapshotEntry[];
    }
  | null;

export interface CartItemProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  images: string[];
  variants: ProductVariants | ProductVariantsOld | null;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  selected_options: SelectedOptions;
  product: CartItemProduct;
  line_total: number;
  resolved_image_url: string;
  unit_price: number;
  available_stock: number;
  stock_warning: boolean;
}

export interface Cart {
  id: number;
  user_id: number | null;
  session_id: string | null;
  items: CartItem[];
  item_count: number;
  subtotal: number;
}

export interface Address {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  selected_options: SelectedOptions;
  resolved_image_url: string | null;
}

export interface OrderUser {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  total_amount: number;
  payment_id: string | null;
  payment_method: string;
  payment_status: string;
  address_id: number;
  created_at: string;
  user: OrderUser | null;
  address: Address | null;
  items: OrderItem[];
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  pages: number;
}

export type DamageClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'replacement_shipped'
  | 'refund_issued'
  | 'closed';

export interface DamageClaim {
  id: number;
  ticket_id: string;
  user_id: number;
  order_id: number;
  order_item_id: number | null;
  issue_type: string;
  description: string;
  photo_urls: string[];
  status: DamageClaimStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user: OrderUser | null;
  order: Order | null;
}

export interface DamageClaimListResponse {
  items: DamageClaim[];
  total: number;
  page: number;
  pages: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CheckoutResponse {
  order_id: number;
  razorpay_order_data?: {
    key_id: string;
    order_id: string | null;
    amount: number;
    currency: string;
    name: string;
    description: string;
    prefill: Record<string, string>;
    notes: Record<string, string>;
  };
}

export type BannerPlacement =
  | 'hero'
  | 'announcement'
  | 'page'
  | 'themed'
  | 'strip'
  | 'highlight'
  | 'mobile_promo'
  | 'corporate_gifting'
  | 'happy_planters'
  | 'trending'
  | 'product_detail'
  | 'product_spec';

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  cta_text?: string;
  cta_link?: string;
  image_url?: string;
  badge_text?: string;
  bg_color: string;
  text_color: string;
  position: number;
  placement: BannerPlacement;
  target_path?: string | null;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  author_name: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export interface BlogListResponse {
  items: BlogPost[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface StoryProductInfo {
  id: number;
  name: string;
  slug: string;
  price: number;
  original_price?: number | null;
  thumbnail?: string | null;
}

export interface Story {
  id: number;
  video: string;
  thumbnail?: string | null;
  caption?: string | null;
  linked_product_id?: number | null;
  display_order: number;
  is_active: boolean;
  linked_product?: StoryProductInfo | null;
}

export interface DoNotForgetProduct {
  id: number;
  product_id: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    original_price: number | null;
    images: string[];
    stock_qty: number;
    is_active: boolean;
  };
}

export interface DoNotForgetListResponse {
  items: DoNotForgetProduct[];
  total: number;
}
