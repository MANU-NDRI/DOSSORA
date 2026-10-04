/* eslint-disable */
// FICHIER GÉNÉRÉ par scripts/gen-db-types.mjs à partir de supabase/schema.sql — ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          country_code: string | null;
          city: string | null;
          role: string;
          admin_language: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          country_code?: string | null;
          city?: string | null;
          role?: string;
          admin_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          country_code?: string | null;
          city?: string | null;
          role?: string;
          admin_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          slug: string;
          name_fr: string;
          name_en?: string | null;
          name_ar?: string | null;
          description_fr?: string | null;
          description_en?: string | null;
          description_ar?: string | null;
          image_url?: string | null;
          is_published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string | null;
          slug?: string;
          name_fr?: string;
          name_en?: string | null;
          name_ar?: string | null;
          description_fr?: string | null;
          description_en?: string | null;
          description_ar?: string | null;
          image_url?: string | null;
          is_published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
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
          status: string;
          is_featured: boolean;
          is_popular: boolean;
          is_new: boolean;
          is_on_sale: boolean;
          available_stock: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          slug: string;
          sku?: string | null;
          name_fr: string;
          name_en?: string | null;
          name_ar?: string | null;
          description_fr?: string | null;
          description_en?: string | null;
          description_ar?: string | null;
          price: number;
          sale_price?: number | null;
          status?: string;
          is_featured?: boolean;
          is_popular?: boolean;
          is_new?: boolean;
          is_on_sale?: boolean;
          available_stock?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          slug?: string;
          sku?: string | null;
          name_fr?: string;
          name_en?: string | null;
          name_ar?: string | null;
          description_fr?: string | null;
          description_en?: string | null;
          description_ar?: string | null;
          price?: number;
          sale_price?: number | null;
          status?: string;
          is_featured?: boolean;
          is_popular?: boolean;
          is_new?: boolean;
          is_on_sale?: boolean;
          available_stock?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string | null;
          color: string | null;
          size: string | null;
          shoe_size: string | null;
          price_override: number | null;
          stock: number;
          reserved: number;
          low_stock_threshold: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku?: string | null;
          color?: string | null;
          size?: string | null;
          shoe_size?: string | null;
          price_override?: number | null;
          stock?: number;
          reserved?: number;
          low_stock_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string | null;
          color?: string | null;
          size?: string | null;
          shoe_size?: string | null;
          price_override?: number | null;
          stock?: number;
          reserved?: number;
          low_stock_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_countries: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name_fr: string;
          name_en?: string | null;
          name_ar?: string | null;
          currency?: string;
          exchange_rate?: number;
          fee?: number;
          free_shipping_threshold?: number | null;
          eta_min_days?: number | null;
          eta_max_days?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name_fr?: string;
          name_en?: string | null;
          name_ar?: string | null;
          currency?: string;
          exchange_rate?: number;
          fee?: number;
          free_shipping_threshold?: number | null;
          eta_min_days?: number | null;
          eta_max_days?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_cities: {
        Row: {
          id: string;
          country_code: string;
          name: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          country_code: string;
          name: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          country_code?: string;
          name?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      shipping_rates: {
        Row: {
          id: string;
          country_code: string;
          city: string;
          fee: number;
        };
        Insert: {
          id?: string;
          country_code: string;
          city: string;
          fee: number;
        };
        Update: {
          id?: string;
          country_code?: string;
          city?: string;
          fee?: number;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
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
        };
        Insert: {
          code: string;
          name_fr: string;
          name_en?: string | null;
          name_ar?: string | null;
          instructions_fr?: string | null;
          instructions_en?: string | null;
          instructions_ar?: string | null;
          account_details?: string | null;
          morocco_only?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          code?: string;
          name_fr?: string;
          name_en?: string | null;
          name_ar?: string | null;
          instructions_fr?: string | null;
          instructions_en?: string | null;
          instructions_ar?: string | null;
          account_details?: string | null;
          morocco_only?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          percent: number | null;
          fixed_amount: number | null;
          min_order: number;
          max_uses: number | null;
          uses_count: number;
          starts_at: string | null;
          expires_at: string | null;
          is_active: boolean;
          target_user_ids: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          percent?: number | null;
          fixed_amount?: number | null;
          min_order?: number;
          max_uses?: number | null;
          uses_count?: number;
          starts_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          target_user_ids?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          percent?: number | null;
          fixed_amount?: number | null;
          min_order?: number;
          max_uses?: number | null;
          uses_count?: number;
          starts_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          target_user_ids?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          status: string;
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
          location_lat: number | null;
          location_lng: number | null;
          location_accuracy: number | null;
          location_captured_at: string | null;
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
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          user_id: string;
          status?: string;
          stock_state?: string;
          stock_reserved_until?: string | null;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          country_code: string;
          city: string;
          address: string;
          postal_code?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          notes?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_accuracy?: number | null;
          location_captured_at?: string | null;
          currency?: string;
          subtotal: number;
          shipping_fee?: number;
          discount_amount?: number;
          total: number;
          discount_code?: string | null;
          paid_at?: string | null;
          delivered_at?: string | null;
          delivery_confirmed?: boolean;
          delivery_confirmed_at?: string | null;
          delivery_confirmed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string;
          status?: string;
          stock_state?: string;
          stock_reserved_until?: string | null;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          country_code?: string;
          city?: string;
          address?: string;
          postal_code?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          notes?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_accuracy?: number | null;
          location_captured_at?: string | null;
          currency?: string;
          subtotal?: number;
          shipping_fee?: number;
          discount_amount?: number;
          total?: number;
          discount_code?: string | null;
          paid_at?: string | null;
          delivered_at?: string | null;
          delivery_confirmed?: boolean;
          delivery_confirmed_at?: string | null;
          delivery_confirmed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          name: string;
          sku: string | null;
          color: string | null;
          size: string | null;
          shoe_size: string | null;
          image_url: string | null;
          unit_price: number;
          quantity: number;
          line_total: number | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          name: string;
          sku?: string | null;
          color?: string | null;
          size?: string | null;
          shoe_size?: string | null;
          image_url?: string | null;
          unit_price: number;
          quantity: number;
          line_total?: number | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          name?: string;
          sku?: string | null;
          color?: string | null;
          size?: string | null;
          shoe_size?: string | null;
          image_url?: string | null;
          unit_price?: number;
          quantity?: number;
          line_total?: number | null;
        };
        Relationships: [];
      };
      discount_usages: {
        Row: {
          id: string;
          discount_id: string;
          user_id: string | null;
          order_id: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          discount_id: string;
          user_id?: string | null;
          order_id?: string | null;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          discount_id?: string;
          user_id?: string | null;
          order_id?: string | null;
          amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          variant_id: string;
          delta: number;
          reason: string;
          order_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          variant_id: string;
          delta: number;
          reason: string;
          order_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          variant_id?: string;
          delta?: number;
          reason?: string;
          order_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          country_code: string;
          city: string;
          address: string;
          postal_code: string | null;
          phone: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          country_code: string;
          city: string;
          address: string;
          postal_code?: string | null;
          phone?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string | null;
          country_code?: string;
          city?: string;
          address?: string;
          postal_code?: string | null;
          phone?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          order_id: string | null;
          subject: string;
          status: string;
          last_message_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id?: string | null;
          subject: string;
          status?: string;
          last_message_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string | null;
          subject?: string;
          status?: string;
          last_message_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          sender_role: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          sender_role?: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          sender_role?: string;
          body?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          audience: string;
          user_id: string | null;
          type: string;
          params: Json;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          audience: string;
          user_id?: string | null;
          type: string;
          params?: Json;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          audience?: string;
          user_id?: string | null;
          type?: string;
          params?: Json;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      return_requests: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          reason: string;
          description: string | null;
          media_urls: string[];
          status: string;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          reason: string;
          description?: string | null;
          media_urls?: string[];
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          reason?: string;
          description?: string | null;
          media_urls?: string[];
          status?: string;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      homepage_banners: {
        Row: {
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
          link_url: string | null;
          text_fr: string | null;
          text_en: string | null;
          text_ar: string | null;
          button2_label_fr: string | null;
          button2_label_en: string | null;
          button2_label_ar: string | null;
          link2_url: string | null;
          image_desktop_url: string | null;
          image_mobile_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title_fr: string;
          title_en?: string | null;
          title_ar?: string | null;
          subtitle_fr?: string | null;
          subtitle_en?: string | null;
          subtitle_ar?: string | null;
          button_label_fr?: string | null;
          button_label_en?: string | null;
          button_label_ar?: string | null;
          link_url?: string | null;
          text_fr?: string | null;
          text_en?: string | null;
          text_ar?: string | null;
          button2_label_fr?: string | null;
          button2_label_en?: string | null;
          button2_label_ar?: string | null;
          link2_url?: string | null;
          image_desktop_url?: string | null;
          image_mobile_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title_fr?: string;
          title_en?: string | null;
          title_ar?: string | null;
          subtitle_fr?: string | null;
          subtitle_en?: string | null;
          subtitle_ar?: string | null;
          button_label_fr?: string | null;
          button_label_en?: string | null;
          button_label_ar?: string | null;
          link_url?: string | null;
          text_fr?: string | null;
          text_en?: string | null;
          text_ar?: string | null;
          button2_label_fr?: string | null;
          button2_label_en?: string | null;
          button2_label_ar?: string | null;
          link2_url?: string | null;
          image_desktop_url?: string | null;
          image_mobile_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      shop_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      customers: {
        Row: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; country_code: string | null; city: string | null; created_at: string; orders_count: number; total_spent: number; last_activity: string | null };
        Relationships: [];
      };
    };
    Functions: {
      ensure_profile: { Args: Record<PropertyKey, never>; Returns: undefined };
      admin_send_promotion: { Args: { p_user_ids: string[]; p_all: boolean; p_title: string; p_message: string; p_code?: string | null }; Returns: number };
      release_expired_reservations: { Args: Record<PropertyKey, never>; Returns: number };
      validate_discount: { Args: { p_code: string; p_subtotal: number }; Returns: Json };
      create_order: { Args: { p: Json }; Returns: Json };
      attach_payment_proof: { Args: { p_order: string; p_path: string }; Returns: undefined };
      attach_order_location: { Args: { p_order: string; p_lat: number; p_lng: number; p_accuracy?: number | null; p_captured_at?: string | null }; Returns: undefined };
      admin_set_order_status: { Args: { p_order: string; p_status: string }; Returns: undefined };
      admin_adjust_stock: { Args: { p_variant: string; p_delta: number; p_reason: string; p_note?: string | null }; Returns: undefined };
      create_return_request: { Args: { p_order: string; p_reason: string; p_description: string; p_media: string[] }; Returns: string };
      mark_conversation_read: { Args: { p_conv: string }; Returns: undefined };
      confirm_order_delivery: { Args: { p_order: string }; Returns: string };
      admin_dashboard: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: { [key: string]: never };
    CompositeTypes: { [key: string]: never };
  };
}

export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type RpcName = keyof Database['public']['Functions'];
