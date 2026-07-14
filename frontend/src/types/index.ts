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
  children?: Category[];
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
  is_active: boolean;
  created_at: string;
  variants: ProductVariants | null;
}

export interface ProductVariantColor {
  name: string;
  hex: string;
  slug: string;
}

export interface ProductVariantPotType {
  name: string;
  slug: string;
  price_modifier: number;
  image_url?: string;
}

export interface ProductVariantSize {
  name: string;        // e.g. "Small", "Medium", "Large"
  slug: string;        // e.g. "small", "medium", "large"
  price_modifier: number;
  description?: string; // e.g. "6–12 inches"
}

export interface ProductVariants {
  colors: ProductVariantColor[];
  pot_types: ProductVariantPotType[];
  sizes?: ProductVariantSize[];
  image_map: Record<string, string>;
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

export interface CartItemProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  images: string[];
  variants: ProductVariants | null;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  selected_options: Record<string, string> | null;
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
  quantity: number;
  unit_price: number;
  selected_options: Record<string, string> | null;
  resolved_image_url: string | null;
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
  items: OrderItem[];
}

export interface OrderListResponse {
  items: Order[];
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
  placement: string;
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
