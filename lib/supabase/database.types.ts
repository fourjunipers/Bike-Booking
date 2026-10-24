
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "bike_models": {
                  Row: {
                    "booking_mode": Database["public"]['Enums']["booking_mode"],"buffer_after_h": number | null,"buffer_before_h": number | null,"cc": number,"created_at": string,"downtime_count": number,"downtime_until": string | null,"flagged_for_review": boolean,"id": string,"make": string,"model": string,"photos": (string)[],"qty": number,"ready_today_count": number,"ready_today_on": boolean,"ready_today_updated_at": string | null,"shop_id": string,"transmission": Database["public"]['Enums']["transmission"],"type": Database["public"]['Enums']["bike_type"],"updated_at": string,"visible": boolean,"year_from": number | null,"year_to": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_mode"?: Database["public"]['Enums']["booking_mode"],"buffer_after_h"?: number | null,"buffer_before_h"?: number | null,"cc": number,"created_at"?: string,"downtime_count"?: number,"downtime_until"?: string | null,"flagged_for_review"?: boolean,"id"?: string,"make": string,"model": string,"photos"?: (string)[],"qty": number,"ready_today_count"?: number,"ready_today_on"?: boolean,"ready_today_updated_at"?: string | null,"shop_id": string,"transmission": Database["public"]['Enums']["transmission"],"type": Database["public"]['Enums']["bike_type"],"updated_at"?: string,"visible"?: boolean,"year_from"?: number | null,"year_to"?: number | null
                  }
                  Update: {
                    "booking_mode"?: Database["public"]['Enums']["booking_mode"],"buffer_after_h"?: number | null,"buffer_before_h"?: number | null,"cc"?: number,"created_at"?: string,"downtime_count"?: number,"downtime_until"?: string | null,"flagged_for_review"?: boolean,"id"?: string,"make"?: string,"model"?: string,"photos"?: (string)[],"qty"?: number,"ready_today_count"?: number,"ready_today_on"?: boolean,"ready_today_updated_at"?: string | null,"shop_id"?: string,"transmission"?: Database["public"]['Enums']["transmission"],"type"?: Database["public"]['Enums']["bike_type"],"updated_at"?: string,"visible"?: boolean,"year_from"?: number | null,"year_to"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bike_models_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_events": {
                  Row: {
                    "actor_id": string | null,"actor_type": Database["public"]['Enums']["booking_actor"],"at": string,"booking_id": string,"data": NonNullable<Json>,"event": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_type": Database["public"]['Enums']["booking_actor"],"at"?: string,"booking_id": string,"data"?: NonNullable<Json>,"event": string,"id"?: never
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["booking_actor"],"at"?: string,"booking_id"?: string,"data"?: NonNullable<Json>,"event"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "bike_model_id": string,"cancel_reason": string | null,"cancelled_by": Database["public"]['Enums']["booking_actor"] | null,"code": string,"created_at": string,"customer_id": string,"delivery_address": string | null,"delivery_fee": number,"delivery_location": unknown,"discount": number,"due_at_shop": number,"end_at": string,"fee": number,"id": string,"mode": Database["public"]['Enums']["booking_kind"],"paid_at": string | null,"payment_due_at": string | null,"payment_method": Database["public"]['Enums']["payment_method"] | null,"promo_id": string | null,"qty": number,"rental_after_promo": number,"rental_total": number,"request_expires_at": string | null,"shop_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"],"stripe_customer_id": string | null,"stripe_payment_method_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"cancel_reason"?: string | null,"cancelled_by"?: Database["public"]['Enums']["booking_actor"] | null,"code": string,"created_at"?: string,"customer_id": string,"delivery_address"?: string | null,"delivery_fee"?: number,"delivery_location"?: unknown,"discount"?: number,"due_at_shop": number,"end_at": string,"fee": number,"id"?: string,"mode": Database["public"]['Enums']["booking_kind"],"paid_at"?: string | null,"payment_due_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"promo_id"?: string | null,"qty"?: number,"rental_after_promo": number,"rental_total": number,"request_expires_at"?: string | null,"shop_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"],"stripe_customer_id"?: string | null,"stripe_payment_method_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bike_model_id"?: string,"cancel_reason"?: string | null,"cancelled_by"?: Database["public"]['Enums']["booking_actor"] | null,"code"?: string,"created_at"?: string,"customer_id"?: string,"delivery_address"?: string | null,"delivery_fee"?: number,"delivery_location"?: unknown,"discount"?: number,"due_at_shop"?: number,"end_at"?: string,"fee"?: number,"id"?: string,"mode"?: Database["public"]['Enums']["booking_kind"],"paid_at"?: string | null,"payment_due_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"promo_id"?: string | null,"qty"?: number,"rental_after_promo"?: number,"rental_total"?: number,"request_expires_at"?: string | null,"shop_id"?: string,"start_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"stripe_customer_id"?: string | null,"stripe_payment_method_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: false
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_promo_id_fkey"
      columns: ["promo_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_zones": {
                  Row: {
                    "fee": number,"id": string,"max_km": number,"shop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fee": number,"id"?: string,"max_km": number,"shop_id": string
                  }
                  Update: {
                    "fee"?: number,"id"?: string,"max_km"?: number,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_zones_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"price_days": {
                  Row: {
                    "bike_model_id": string,"day": number,"is_anchor": boolean,"is_manual": boolean,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"day": number,"is_anchor"?: boolean,"is_manual"?: boolean,"total": number
                  }
                  Update: {
                    "bike_model_id"?: string,"day"?: number,"is_anchor"?: boolean,"is_manual"?: boolean,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_days_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: false
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"language": Database["public"]['Enums']["app_language"],"line_user_id": string | null,"name": string | null,"notify_channels": (Database["public"]['Enums']["notify_channel"])[],"role": Database["public"]['Enums']["user_role"],"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id": string,"language"?: Database["public"]['Enums']["app_language"],"line_user_id"?: string | null,"name"?: string | null,"notify_channels"?: (Database["public"]['Enums']["notify_channel"])[],"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"language"?: Database["public"]['Enums']["app_language"],"line_user_id"?: string | null,"name"?: string | null,"notify_channels"?: (Database["public"]['Enums']["notify_channel"])[],"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"promotion_models": {
                  Row: {
                    "bike_model_id": string,"promotion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"promotion_id": string
                  }
                  Update: {
                    "bike_model_id"?: string,"promotion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotion_models_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: false
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_models_promotion_id_fkey"
      columns: ["promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["id"]
    }
                  ]
                },"promotions": {
                  Row: {
                    "active": boolean,"all_models": boolean,"created_at": string,"end_date": string | null,"id": string,"kind": Database["public"]['Enums']["promotion_kind"],"min_days": number | null,"shop_id": string,"start_date": string | null,"updated_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"all_models"?: boolean,"created_at"?: string,"end_date"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["promotion_kind"],"min_days"?: number | null,"shop_id": string,"start_date"?: string | null,"updated_at"?: string,"value": number
                  }
                  Update: {
                    "active"?: boolean,"all_models"?: boolean,"created_at"?: string,"end_date"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["promotion_kind"],"min_days"?: number | null,"shop_id"?: string,"start_date"?: string | null,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "bike_model_id": string,"booking_id": string,"created_at": string,"hidden": boolean,"rating": number,"shop_id": string,"text": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"booking_id": string,"created_at"?: string,"hidden"?: boolean,"rating": number,"shop_id": string,"text"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bike_model_id"?: string,"booking_id"?: string,"created_at"?: string,"hidden"?: boolean,"rating"?: number,"shop_id"?: string,"text"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: false
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_closures": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"note": string | null,"shop_id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"note"?: string | null,"shop_id": string,"start_date": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"note"?: string | null,"shop_id"?: string,"start_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_closures_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_contacts": {
                  Row: {
                    "line_id": string | null,"shop_id": string,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "line_id"?: string | null,"shop_id": string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "line_id"?: string | null,"shop_id"?: string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_contacts_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: true
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_hours": {
                  Row: {
                    "close": string,"open": string,"shop_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "close": string,"open": string,"shop_id": string,"weekday": number
                  }
                  Update: {
                    "close"?: string,"open"?: string,"shop_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_hours_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["shop_member_role"],"shop_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["shop_member_role"],"shop_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["shop_member_role"],"shop_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_members_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_policies": {
                  Row: {
                    "deposit_amount": number | null,"deposit_type": Database["public"]['Enums']["deposit_type"],"helmets": number,"insurance_type": string | null,"licence_required": Database["public"]['Enums']["licence_type"],"notes": string | null,"phone_holder": boolean,"rain_gear": boolean,"shop_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "deposit_amount"?: number | null,"deposit_type": Database["public"]['Enums']["deposit_type"],"helmets"?: number,"insurance_type"?: string | null,"licence_required"?: Database["public"]['Enums']["licence_type"],"notes"?: string | null,"phone_holder"?: boolean,"rain_gear"?: boolean,"shop_id": string,"updated_at"?: string
                  }
                  Update: {
                    "deposit_amount"?: number | null,"deposit_type"?: Database["public"]['Enums']["deposit_type"],"helmets"?: number,"insurance_type"?: string | null,"licence_required"?: Database["public"]['Enums']["licence_type"],"notes"?: string | null,"phone_holder"?: boolean,"rain_gear"?: boolean,"shop_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_policies_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: true
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "about": string | null,"approved_at": string | null,"boost_level": Database["public"]['Enums']["boost_level"],"buffer_after_h": number,"buffer_before_h": number,"created_at": string,"cutoff_minutes": number,"delivery_enabled": boolean,"delivery_radius_km": number | null,"id": string,"location": unknown,"maps_url": string | null,"name": string,"nearest_station": string | null,"photos": (string)[],"request_window_min": number,"review_notes": string | null,"slug": string,"status": Database["public"]['Enums']["shop_status"],"submitted_at": string | null,"terms_accepted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string | null,"approved_at"?: string | null,"boost_level"?: Database["public"]['Enums']["boost_level"],"buffer_after_h"?: number,"buffer_before_h"?: number,"created_at"?: string,"cutoff_minutes"?: number,"delivery_enabled"?: boolean,"delivery_radius_km"?: number | null,"id"?: string,"location"?: unknown,"maps_url"?: string | null,"name": string,"nearest_station"?: string | null,"photos"?: (string)[],"request_window_min"?: number,"review_notes"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["shop_status"],"submitted_at"?: string | null,"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "about"?: string | null,"approved_at"?: string | null,"boost_level"?: Database["public"]['Enums']["boost_level"],"buffer_after_h"?: number,"buffer_before_h"?: number,"created_at"?: string,"cutoff_minutes"?: number,"delivery_enabled"?: boolean,"delivery_radius_km"?: number | null,"id"?: string,"location"?: unknown,"maps_url"?: string | null,"name"?: string,"nearest_station"?: string | null,"photos"?: (string)[],"request_window_min"?: number,"review_notes"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["shop_status"],"submitted_at"?: string | null,"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "bike_model_shop_id":
{ Args: { "p_bike_model_id": string }; Returns: string
                           },
"is_bike_model_public":
{ Args: { "p_bike_model_id": string }; Returns: boolean
                           },
"is_shop_live":
{ Args: { "p_shop_id": string }; Returns: boolean
                           },
"is_shop_member":
{ Args: { "p_shop_id": string }; Returns: boolean
                           },
"is_shop_owner":
{ Args: { "p_shop_id": string }; Returns: boolean
                           },
"promotion_shop_id":
{ Args: { "p_promotion_id": string }; Returns: string
                           }
          }
          Enums: {
            "app_language": "en"|"th","bike_type": "city_scooter"|"touring"|"adventure"|"sport"|"classic"|"off_road","booking_actor": "customer"|"vendor"|"admin"|"system","booking_kind": "instant"|"request"|"now","booking_mode": "instant"|"request","booking_status": "pending_vendor"|"declined"|"expired"|"confirmed_unpaid"|"paid"|"picked_up"|"returned"|"cancelled_customer"|"cancelled_vendor"|"cancelled_unpaid"|"no_show","boost_level": "featured"|"preferred"|"normal","deposit_type": "passport_held"|"cash_deposit"|"passport_copy","licence_type": "none"|"car"|"motorbike"|"international_permit","notify_channel": "email"|"whatsapp","payment_method": "card"|"promptpay","promotion_kind": "pct"|"fixed"|"long_rental"|"new_customer","shop_member_role": "owner"|"staff","shop_status": "draft"|"pending"|"live"|"suspended","transmission": "automatic"|"semi_auto"|"manual","user_role": "customer"|"vendor_staff"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_language": ["en", "th"],"bike_type": ["city_scooter", "touring", "adventure", "sport", "classic", "off_road"],"booking_actor": ["customer", "vendor", "admin", "system"],"booking_kind": ["instant", "request", "now"],"booking_mode": ["instant", "request"],"booking_status": ["pending_vendor", "declined", "expired", "confirmed_unpaid", "paid", "picked_up", "returned", "cancelled_customer", "cancelled_vendor", "cancelled_unpaid", "no_show"],"boost_level": ["featured", "preferred", "normal"],"deposit_type": ["passport_held", "cash_deposit", "passport_copy"],"licence_type": ["none", "car", "motorbike", "international_permit"],"notify_channel": ["email", "whatsapp"],"payment_method": ["card", "promptpay"],"promotion_kind": ["pct", "fixed", "long_rental", "new_customer"],"shop_member_role": ["owner", "staff"],"shop_status": ["draft", "pending", "live", "suspended"],"transmission": ["automatic", "semi_auto", "manual"],"user_role": ["customer", "vendor_staff", "admin"]
          }
        }
} as const
