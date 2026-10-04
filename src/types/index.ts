export type Lang = 'fr' | 'en' | 'ar';

export const ORDER_STATUSES = [
  'pending_payment',
  'payment_proof_received',
  'paid',
  'preparing',
  'delivering',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  city: string | null;
  role: 'customer' | 'admin';
  created_at: string;
  /** Langue de l'administration (réservée aux admins) — indépendante de la langue client. */
  admin_language?: Lang | null;
}
export interface Category {
  id: string;
  parent_id: string | null;
  slug: string;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_ar: string | null;
  image_url: string | null;
  is_published: boolean;
  sort_order: number;
}
export interface ProductImage {
  url: string;
  alt: string | null;
  sort_order: number;
}
export interface Variant {
  id: string;
  product_id?: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  shoe_size: string | null;
  stock: number;
  reserved: number;
  price_override: number | null;
  low_stock_threshold: number;
}
export interface Product {
  id: string;
  category_id: string | null;
  slug: string;
  sku: string | null;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_ar: string | null;
  price: number;
  sale_price: number | null;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_popular: boolean;
  is_new: boolean;
  is_on_sale: boolean;
  available_stock: number;
  created_at: string;
  product_images: ProductImage[];
  product_variants: Variant[];
  categories?: { slug: string; name_fr: string; name_en: string | null; name_ar: string | null } | null;
}
export interface ShippingCountry {
  code: string;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  currency: string;
  exchange_rate: number;
  fee: number;
  free_shipping_threshold: number | null;
  eta_min_days: number | null;
  eta_max_days: number | null;
  is_active: boolean;
  sort_order: number;
}
export interface PaymentMethod {
  code: string;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  instructions_fr: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
  account_details: string | null;
  morocco_only: boolean;
  is_active: boolean;
  sort_order: number;
}
export interface Banner {
  id: string;
  title_fr: string;
  title_en: string | null;
  title_ar: string | null;
  subtitle_fr: string | null;
  subtitle_en: string | null;
  subtitle_ar: string | null;
  button_label_fr: string | null;
  button_label_en: string | null;
  button_label_ar: string | null;
  text_fr?: string | null;
  text_en?: string | null;
  text_ar?: string | null;
  button2_label_fr?: string | null;
  button2_label_en?: string | null;
  button2_label_ar?: string | null;
  link2_url?: string | null;
  link_url: string | null;
  image_desktop_url: string | null;
  image_mobile_url: string | null;
  sort_order: number;
  is_active: boolean;
}
export interface OrderItem {
  id: string;
  name: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  shoe_size: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}
export interface Order {
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy?: number | null;
  location_captured_at?: string | null;
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  stock_state: string;
  stock_reserved_until: string | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  country_code: string;
  city: string;
  address: string;
  postal_code: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string | null;
  currency: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total: number;
  discount_code: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  delivery_confirmed: boolean;
  delivery_confirmed_at: string | null;
  delivery_confirmed_by: string | null;
  created_at: string;
  order_items?: OrderItem[];
}
export interface Conversation {
  id: string;
  user_id: string;
  order_id: string | null;
  subject: string;
  status: string;
  last_message_at: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string; email: string | null } | null;
}
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'customer' | 'admin';
  body: string;
  read_at: string | null;
  created_at: string;
}
export interface AppNotification {
  id: string;
  audience: 'user' | 'admin';
  user_id: string | null;
  type: string;
  params: Record<string, unknown>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  country_code: string;
  city: string;
  address: string;
  postal_code: string | null;
  phone: string | null;
  is_default: boolean;
}
export interface ShopSettings {
  shop_name: string;
  slogan: string;
  currency: string;
  email: string;
  whatsapp: string;
  sender_address?: string;
  sender_city?: string;
  sender_country?: string;
  announcement_fr?: string;
  announcement_en?: string;
  announcement_ar?: string;
}

/** Position partagée par le client (consentement explicite). */
export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Précision estimée, en mètres. */
  accuracy: number | null;
  /** Horodatage de la mesure (ms depuis epoch). */
  timestamp: number;
}
export type GeoErrorKind = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout' | 'unknown';
