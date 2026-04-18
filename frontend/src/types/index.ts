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
  sunlight: string | null;
  watering: string | null;
  badge: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductListResponse {
  items: Product[];
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
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  product: CartItemProduct;
  line_total: number;
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
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  total_amount: number;
  payment_id: string | null;
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
  payu_form_data: Record<string, string>;
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
