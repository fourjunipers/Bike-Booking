
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
        },"platform": {
          Tables: {
            "audit_events": {
                  Row: {
                    "action": string,"actor": string | null,"after": Json | null,"at": string,"before": Json | null,"entity": string,"entity_id": string,"id": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"entity": string,"entity_id": string,"id"?: never,"tenant_id": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"entity"?: string,"entity_id"?: string,"id"?: never,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"location_closures": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"location_id": string,"note": string | null,"repeats_yearly": boolean,"start_date": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"location_id": string,"note"?: string | null,"repeats_yearly"?: boolean,"start_date": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"location_id"?: string,"note"?: string | null,"repeats_yearly"?: boolean,"start_date"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_closures_tenant_id_location_id_fkey"
      columns: ["tenant_id","location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"location_hours": {
                  Row: {
                    "close": string,"location_id": string,"open": string,"tenant_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "close": string,"location_id": string,"open": string,"tenant_id": string,"weekday": number
                  }
                  Update: {
                    "close"?: string,"location_id"?: string,"open"?: string,"tenant_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_hours_tenant_id_location_id_fkey"
      columns: ["tenant_id","location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"created_at": string,"email": string | null,"geo": unknown,"google_place_id": string | null,"id": string,"is_default": boolean,"line_id": string | null,"maps_url": string | null,"market_id": string | null,"name": string,"phone": string | null,"tenant_id": string,"timezone": string,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"geo"?: unknown,"google_place_id"?: string | null,"id"?: string,"is_default"?: boolean,"line_id"?: string | null,"maps_url"?: string | null,"market_id"?: string | null,"name": string,"phone"?: string | null,"tenant_id": string,"timezone": string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"geo"?: unknown,"google_place_id"?: string | null,"id"?: string,"is_default"?: boolean,"line_id"?: string | null,"maps_url"?: string | null,"market_id"?: string | null,"name"?: string,"phone"?: string | null,"tenant_id"?: string,"timezone"?: string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["platform"]['Enums']["platform_role"],"tenant_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": Database["platform"]['Enums']["platform_role"],"tenant_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["platform"]['Enums']["platform_role"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"model_year_bands": {
                  Row: {
                    "created_at": string,"id": string,"model_id": string,"tenant_id": string,"year_from": number,"year_to": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"model_id": string,"tenant_id": string,"year_from": number,"year_to": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"model_id"?: string,"tenant_id"?: string,"year_from"?: number,"year_to"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "model_year_bands_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "model_year_bands_tenant_id_model_id_fkey"
      columns: ["tenant_id","model_id"]
isOneToOne: false
      referencedRelation: "models"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"models": {
                  Row: {
                    "bookable_online": boolean,"buffer_after_minutes": number | null,"buffer_before_minutes": number | null,"catalog_id": string | null,"cc": number | null,"created_at": string,"deposit": number | null,"deposit_currency": string | null,"description": string | null,"id": string,"instant_units": number,"licence_class": string | null,"make": string,"marketplace_listed": boolean,"min_age": number | null,"model": string,"name": string,"photos": (string)[],"ready_now": number,"ready_updated_at": string | null,"request_units": number,"tenant_id": string,"transmission": Database["public"]['Enums']["transmission"] | null,"updated_at": string,"vehicle_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bookable_online"?: boolean,"buffer_after_minutes"?: number | null,"buffer_before_minutes"?: number | null,"catalog_id"?: string | null,"cc"?: number | null,"created_at"?: string,"deposit"?: number | null,"deposit_currency"?: string | null,"description"?: string | null,"id"?: string,"instant_units"?: number,"licence_class"?: string | null,"make": string,"marketplace_listed"?: boolean,"min_age"?: number | null,"model": string,"name": string,"photos"?: (string)[],"ready_now"?: number,"ready_updated_at"?: string | null,"request_units"?: number,"tenant_id": string,"transmission"?: Database["public"]['Enums']["transmission"] | null,"updated_at"?: string,"vehicle_type": string
                  }
                  Update: {
                    "bookable_online"?: boolean,"buffer_after_minutes"?: number | null,"buffer_before_minutes"?: number | null,"catalog_id"?: string | null,"cc"?: number | null,"created_at"?: string,"deposit"?: number | null,"deposit_currency"?: string | null,"description"?: string | null,"id"?: string,"instant_units"?: number,"licence_class"?: string | null,"make"?: string,"marketplace_listed"?: boolean,"min_age"?: number | null,"model"?: string,"name"?: string,"photos"?: (string)[],"ready_now"?: number,"ready_updated_at"?: string | null,"request_units"?: number,"tenant_id"?: string,"transmission"?: Database["public"]['Enums']["transmission"] | null,"updated_at"?: string,"vehicle_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "models_tenant_id_deposit_currency_fkey"
      columns: ["tenant_id","deposit_currency"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id","currency"]
    },{
      foreignKeyName: "models_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "created_at": string,"dedupe_key": string,"id": number,"kind": string,"payload": NonNullable<Json>,"sent_at": string | null,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dedupe_key": string,"id"?: never,"kind": string,"payload": NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string,"id"?: never,"kind"?: string,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tenants": {
                  Row: {
                    "country": string,"created_at": string,"currency": string,"distance_unit": string,"id": string,"locale": string,"name": string,"renewal_digest_day": number | null,"renewal_reminder_days": (number)[],"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country": string,"created_at"?: string,"currency": string,"distance_unit"?: string,"id"?: string,"locale": string,"name": string,"renewal_digest_day"?: number | null,"renewal_reminder_days"?: (number)[],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"currency"?: string,"distance_unit"?: string,"id"?: string,"locale"?: string,"name"?: string,"renewal_digest_day"?: number | null,"renewal_reminder_days"?: (number)[],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"unit_blocks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"kind": string,"note": string | null,"period": unknown,"tenant_id": string,"unit_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind": string,"note"?: string | null,"period": unknown,"tenant_id": string,"unit_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"note"?: string | null,"period"?: unknown,"tenant_id"?: string,"unit_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_blocks_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_blocks_tenant_id_unit_id_fkey"
      columns: ["tenant_id","unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"unit_financials": {
                  Row: {
                    "created_at": string,"currency": string,"purchase_date": string | null,"purchase_price": number | null,"purchased_from": string | null,"sale_price": number | null,"sold_at": string | null,"sold_to": string | null,"tenant_id": string,"unit_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency": string,"purchase_date"?: string | null,"purchase_price"?: number | null,"purchased_from"?: string | null,"sale_price"?: number | null,"sold_at"?: string | null,"sold_to"?: string | null,"tenant_id": string,"unit_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"purchase_date"?: string | null,"purchase_price"?: number | null,"purchased_from"?: string | null,"sale_price"?: number | null,"sold_at"?: string | null,"sold_to"?: string | null,"tenant_id"?: string,"unit_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_financials_tenant_id_currency_fkey"
      columns: ["tenant_id","currency"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id","currency"]
    },{
      foreignKeyName: "unit_financials_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_financials_tenant_id_unit_id_fkey"
      columns: ["tenant_id","unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"unit_renewal_costs": {
                  Row: {
                    "cost": number,"currency": string,"renewal_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost": number,"currency": string,"renewal_id": string,"tenant_id": string
                  }
                  Update: {
                    "cost"?: number,"currency"?: string,"renewal_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_renewal_costs_tenant_id_currency_fkey"
      columns: ["tenant_id","currency"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id","currency"]
    },{
      foreignKeyName: "unit_renewal_costs_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_renewal_costs_tenant_id_renewal_id_fkey"
      columns: ["tenant_id","renewal_id"]
isOneToOne: false
      referencedRelation: "unit_renewals"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"unit_renewals": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"kind": string,"provider": string | null,"recorded_by": string | null,"reference_no": string | null,"starts_at": string | null,"tenant_id": string,"unit_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"kind": string,"provider"?: string | null,"recorded_by"?: string | null,"reference_no"?: string | null,"starts_at"?: string | null,"tenant_id": string,"unit_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"kind"?: string,"provider"?: string | null,"recorded_by"?: string | null,"reference_no"?: string | null,"starts_at"?: string | null,"tenant_id"?: string,"unit_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_renewals_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_renewals_tenant_id_unit_id_fkey"
      columns: ["tenant_id","unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"units": {
                  Row: {
                    "colour": string | null,"created_at": string,"current_odometer_km": number,"engine_number": string | null,"frame_number": string | null,"id": string,"location_id": string,"model_id": string,"model_year": number | null,"notes": string | null,"plate": string | null,"plate_pending": boolean,"qr_token": string,"status": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "colour"?: string | null,"created_at"?: string,"current_odometer_km"?: number,"engine_number"?: string | null,"frame_number"?: string | null,"id"?: string,"location_id": string,"model_id": string,"model_year"?: number | null,"notes"?: string | null,"plate"?: string | null,"plate_pending"?: boolean,"qr_token"?: string,"status"?: string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "colour"?: string | null,"created_at"?: string,"current_odometer_km"?: number,"engine_number"?: string | null,"frame_number"?: string | null,"id"?: string,"location_id"?: string,"model_id"?: string,"model_year"?: number | null,"notes"?: string | null,"plate"?: string | null,"plate_pending"?: boolean,"qr_token"?: string,"status"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "units_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_tenant_id_location_id_fkey"
      columns: ["tenant_id","location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "units_tenant_id_model_id_fkey"
      columns: ["tenant_id","model_id"]
isOneToOne: false
      referencedRelation: "models"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "catalog_requests":
{ Args: Record<PropertyKey, never>; Returns: {
              "cc": number,"created_at": string,"id": string,"make": string,"model": string,"request_note": string,"requested_by_tenant_id": string,"requested_by_tenant_name": string,"slug": string,"status": Database["public"]['Enums']["catalog_status"],"transmission": Database["public"]['Enums']["transmission"],"type": Database["public"]['Enums']["bike_type"],"year_from": number,"year_to": number
            }[]
                           },
"create_tenant":
{ Args: { "p_country": string,"p_currency": string,"p_id"?: string,"p_locale": string,"p_name": string,"p_slug": string,"p_timezone": string }; Returns: string
                           },
"currency_locked":
{ Args: { "p_tenant_id": string }; Returns: boolean
                           },
"import_fleet":
{ Args: { "p_models": Json,"p_tenant_id": string,"p_units": Json }; Returns: Json
                           },
"platform_exposure_report":
{ Args: Record<PropertyKey, never>; Returns: {
              "anon_has_any_privilege": boolean,"authenticated_can_truncate": boolean,"kind": string,"policy_count": number,"relation": string,"rls_enabled": boolean
            }[]
                           },
"platform_open_policies":
{ Args: Record<PropertyKey, never>; Returns: {
              "policy_name": string,"table_name": string
            }[]
                           },
"platform_rls_report":
{ Args: Record<PropertyKey, never>; Returns: {
              "policy_count": number,"rls_enabled": boolean,"table_name": string
            }[]
                           },
"platform_schema_access":
{ Args: Record<PropertyKey, never>; Returns: {
              "anon_usage": boolean,"default_grantees": (string)[]
            }[]
                           },
"queue_renewal_notifications":
{ Args: { "p_now"?: string }; Returns: number
                           },
"remove_member":
{ Args: { "p_membership_id": string }; Returns: undefined
                           },
"review_catalog_request":
{ Args: { "p_approve": boolean,"p_catalog_id": string,"p_merge_into"?: string,"p_notes"?: string }; Returns: Json
                           },
"set_member_role":
{ Args: { "p_membership_id": string,"p_role": Database["platform"]['Enums']["platform_role"] }; Returns: undefined
                           },
"submit_model_to_catalog":
{ Args: { "p_model_id": string,"p_note"?: string,"p_type": Database["public"]['Enums']["bike_type"],"p_year_from"?: number,"p_year_to"?: number }; Returns: string
                           },
"tenant_members":
{ Args: { "p_tenant_id": string }; Returns: {
              "created_at": string,"email": string,"membership_id": string,"name": string,"role": Database["platform"]['Enums']["platform_role"],"user_id": string
            }[]
                           }
          }
          Enums: {
            "platform_role": "owner"|"manager"|"staff"|"mechanic"|"driver"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "bike_catalog": {
                  Row: {
                    "abs": boolean | null,"cc": number,"created_at": string,"description": string | null,"id": string,"key_type": Database["public"]['Enums']["key_type"] | null,"make": string,"model": string,"request_note": string | null,"requested_by_shop_id": string | null,"requested_by_tenant_id": string | null,"review_notes": string | null,"reviewed_at": string | null,"slug": string,"specs": NonNullable<Json>,"status": Database["public"]['Enums']["catalog_status"],"stock_photo": string | null,"transmission": Database["public"]['Enums']["transmission"],"type": Database["public"]['Enums']["bike_type"],"underseat_storage": boolean | null,"updated_at": string,"usb_charger": boolean | null,"vehicle_type": string,"year_from": number | null,"year_to": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abs"?: boolean | null,"cc": number,"created_at"?: string,"description"?: string | null,"id"?: string,"key_type"?: Database["public"]['Enums']["key_type"] | null,"make": string,"model": string,"request_note"?: string | null,"requested_by_shop_id"?: string | null,"requested_by_tenant_id"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"slug"?: string,"specs"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["catalog_status"],"stock_photo"?: string | null,"transmission": Database["public"]['Enums']["transmission"],"type": Database["public"]['Enums']["bike_type"],"underseat_storage"?: boolean | null,"updated_at"?: string,"usb_charger"?: boolean | null,"vehicle_type"?: string,"year_from"?: number | null,"year_to"?: number | null
                  }
                  Update: {
                    "abs"?: boolean | null,"cc"?: number,"created_at"?: string,"description"?: string | null,"id"?: string,"key_type"?: Database["public"]['Enums']["key_type"] | null,"make"?: string,"model"?: string,"request_note"?: string | null,"requested_by_shop_id"?: string | null,"requested_by_tenant_id"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"slug"?: string,"specs"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["catalog_status"],"stock_photo"?: string | null,"transmission"?: Database["public"]['Enums']["transmission"],"type"?: Database["public"]['Enums']["bike_type"],"underseat_storage"?: boolean | null,"updated_at"?: string,"usb_charger"?: boolean | null,"vehicle_type"?: string,"year_from"?: number | null,"year_to"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bike_catalog_requested_by_shop_id_fkey"
      columns: ["requested_by_shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bike_catalog_vehicle_type_fkey"
      columns: ["vehicle_type"]
isOneToOne: false
      referencedRelation: "vehicle_types"
      referencedColumns: ["key"]
    }
                  ]
                },"bike_model_downtime": {
                  Row: {
                    "back_on": string | null,"bike_model_id": string,"created_at": string,"id": string,"note": string | null,"units": number
                  }
                  ComputedFields: never
                  Insert: {
                    "back_on"?: string | null,"bike_model_id": string,"created_at"?: string,"id"?: string,"note"?: string | null,"units": number
                  }
                  Update: {
                    "back_on"?: string | null,"bike_model_id"?: string,"created_at"?: string,"id"?: string,"note"?: string | null,"units"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bike_model_downtime_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: false
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    }
                  ]
                },"bike_model_policies": {
                  Row: {
                    "bike_model_id": string,"deposit_methods": (Database["public"]['Enums']["deposit_method"])[] | null,"experience_required": boolean | null,"gloves": Database["public"]['Enums']["gear_option"] | null,"helmet_types": (Database["public"]['Enums']["helmet_type"])[] | null,"helmets": number | null,"jacket": Database["public"]['Enums']["gear_option"] | null,"km_limit": number | null,"licence_required": Database["public"]['Enums']["licence_type"] | null,"medical_cover": boolean | null,"min_age": number | null,"notes": string | null,"passport": Database["public"]['Enums']["passport_policy"] | null,"phone_holder": boolean | null,"rain_gear": Database["public"]['Enums']["gear_option"] | null,"side_panniers": boolean | null,"top_box": boolean | null,"updated_at": string,"usage_area": Database["public"]['Enums']["usage_area"] | null,"usb_charger": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"deposit_methods"?: (Database["public"]['Enums']["deposit_method"])[] | null,"experience_required"?: boolean | null,"gloves"?: Database["public"]['Enums']["gear_option"] | null,"helmet_types"?: (Database["public"]['Enums']["helmet_type"])[] | null,"helmets"?: number | null,"jacket"?: Database["public"]['Enums']["gear_option"] | null,"km_limit"?: number | null,"licence_required"?: Database["public"]['Enums']["licence_type"] | null,"medical_cover"?: boolean | null,"min_age"?: number | null,"notes"?: string | null,"passport"?: Database["public"]['Enums']["passport_policy"] | null,"phone_holder"?: boolean | null,"rain_gear"?: Database["public"]['Enums']["gear_option"] | null,"side_panniers"?: boolean | null,"top_box"?: boolean | null,"updated_at"?: string,"usage_area"?: Database["public"]['Enums']["usage_area"] | null,"usb_charger"?: boolean | null
                  }
                  Update: {
                    "bike_model_id"?: string,"deposit_methods"?: (Database["public"]['Enums']["deposit_method"])[] | null,"experience_required"?: boolean | null,"gloves"?: Database["public"]['Enums']["gear_option"] | null,"helmet_types"?: (Database["public"]['Enums']["helmet_type"])[] | null,"helmets"?: number | null,"jacket"?: Database["public"]['Enums']["gear_option"] | null,"km_limit"?: number | null,"licence_required"?: Database["public"]['Enums']["licence_type"] | null,"medical_cover"?: boolean | null,"min_age"?: number | null,"notes"?: string | null,"passport"?: Database["public"]['Enums']["passport_policy"] | null,"phone_holder"?: boolean | null,"rain_gear"?: Database["public"]['Enums']["gear_option"] | null,"side_panniers"?: boolean | null,"top_box"?: boolean | null,"updated_at"?: string,"usage_area"?: Database["public"]['Enums']["usage_area"] | null,"usb_charger"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bike_model_policies_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: true
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    }
                  ]
                },"bike_models": {
                  Row: {
                    "buffer_after_h": number | null,"buffer_before_h": number | null,"catalog_id": string,"created_at": string,"deposit_amount": number | null,"flagged_for_review": boolean,"id": string,"instant_qty": number,"min_days_booking": number | null,"min_days_walkin": number | null,"notice_h": number | null,"photos": (string)[],"qty": number,"ready_today_count": number,"ready_today_on": boolean,"ready_today_updated_at": string | null,"request_qty": number,"shop_id": string,"updated_at": string,"visible": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "buffer_after_h"?: number | null,"buffer_before_h"?: number | null,"catalog_id": string,"created_at"?: string,"deposit_amount"?: number | null,"flagged_for_review"?: boolean,"id"?: string,"instant_qty"?: number,"min_days_booking"?: number | null,"min_days_walkin"?: number | null,"notice_h"?: number | null,"photos"?: (string)[],"qty": number,"ready_today_count"?: number,"ready_today_on"?: boolean,"ready_today_updated_at"?: string | null,"request_qty"?: number,"shop_id": string,"updated_at"?: string,"visible"?: boolean
                  }
                  Update: {
                    "buffer_after_h"?: number | null,"buffer_before_h"?: number | null,"catalog_id"?: string,"created_at"?: string,"deposit_amount"?: number | null,"flagged_for_review"?: boolean,"id"?: string,"instant_qty"?: number,"min_days_booking"?: number | null,"min_days_walkin"?: number | null,"notice_h"?: number | null,"photos"?: (string)[],"qty"?: number,"ready_today_count"?: number,"ready_today_on"?: boolean,"ready_today_updated_at"?: string | null,"request_qty"?: number,"shop_id"?: string,"updated_at"?: string,"visible"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "bike_models_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "bike_catalog"
      referencedColumns: ["id"]
    },{
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
                    "bike_model_id": string,"cancel_reason": string | null,"cancelled_by": Database["public"]['Enums']["booking_actor"] | null,"code": string,"created_at": string,"currency": string,"customer_id": string,"delivery_address": string | null,"delivery_fee": number,"delivery_location": unknown,"discount": number,"due_at_shop": number,"end_at": string,"fee": number,"id": string,"mode": Database["public"]['Enums']["booking_kind"],"paid_at": string | null,"payment_due_at": string | null,"payment_method": Database["public"]['Enums']["payment_method"] | null,"promo_id": string | null,"qty": number,"rental_after_promo": number,"rental_total": number,"request_expires_at": string | null,"shop_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"],"stripe_customer_id": string | null,"stripe_payment_method_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"cancel_reason"?: string | null,"cancelled_by"?: Database["public"]['Enums']["booking_actor"] | null,"code": string,"created_at"?: string,"currency"?: string,"customer_id": string,"delivery_address"?: string | null,"delivery_fee"?: number,"delivery_location"?: unknown,"discount"?: number,"due_at_shop": number,"end_at": string,"fee": number,"id"?: string,"mode": Database["public"]['Enums']["booking_kind"],"paid_at"?: string | null,"payment_due_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"promo_id"?: string | null,"qty"?: number,"rental_after_promo": number,"rental_total": number,"request_expires_at"?: string | null,"shop_id": string,"start_at": string,"status": Database["public"]['Enums']["booking_status"],"stripe_customer_id"?: string | null,"stripe_payment_method_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bike_model_id"?: string,"cancel_reason"?: string | null,"cancelled_by"?: Database["public"]['Enums']["booking_actor"] | null,"code"?: string,"created_at"?: string,"currency"?: string,"customer_id"?: string,"delivery_address"?: string | null,"delivery_fee"?: number,"delivery_location"?: unknown,"discount"?: number,"due_at_shop"?: number,"end_at"?: string,"fee"?: number,"id"?: string,"mode"?: Database["public"]['Enums']["booking_kind"],"paid_at"?: string | null,"payment_due_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"promo_id"?: string | null,"qty"?: number,"rental_after_promo"?: number,"rental_total"?: number,"request_expires_at"?: string | null,"shop_id"?: string,"start_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"stripe_customer_id"?: string | null,"stripe_payment_method_id"?: string | null,"updated_at"?: string
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
                },"ranking_settings": {
                  Row: {
                    "boost": number,"cancellation": number,"distance": number,"id": boolean,"rating": number,"response": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "boost"?: number,"cancellation"?: number,"distance"?: number,"id"?: boolean,"rating"?: number,"response"?: number,"updated_at"?: string
                  }
                  Update: {
                    "boost"?: number,"cancellation"?: number,"distance"?: number,"id"?: boolean,"rating"?: number,"response"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
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
                    "created_at": string,"end_date": string,"id": string,"note": string | null,"repeats_yearly": boolean,"shop_id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"note"?: string | null,"repeats_yearly"?: boolean,"shop_id": string,"start_date": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"note"?: string | null,"repeats_yearly"?: boolean,"shop_id"?: string,"start_date"?: string
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
                    "email": string | null,"line_id": string | null,"phone": string | null,"shop_id": string,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "email"?: string | null,"line_id"?: string | null,"phone"?: string | null,"shop_id": string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "email"?: string | null,"line_id"?: string | null,"phone"?: string | null,"shop_id"?: string,"updated_at"?: string,"whatsapp"?: string | null
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
                },"shop_extra_models": {
                  Row: {
                    "bike_model_id": string,"extra_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bike_model_id": string,"extra_id": string
                  }
                  Update: {
                    "bike_model_id"?: string,"extra_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_extra_models_bike_model_id_fkey"
      columns: ["bike_model_id"]
isOneToOne: false
      referencedRelation: "bike_models"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_extra_models_extra_id_fkey"
      columns: ["extra_id"]
isOneToOne: false
      referencedRelation: "shop_extras"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_extras": {
                  Row: {
                    "active": boolean,"all_models": boolean,"created_at": string,"description": string | null,"id": string,"name": string,"price_1d": number | null,"price_30d": number | null,"price_7d": number | null,"price_kind": Database["public"]['Enums']["extra_price_kind"],"price_rental": number | null,"shop_id": string,"sort": number,"terms": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"all_models"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"price_1d"?: number | null,"price_30d"?: number | null,"price_7d"?: number | null,"price_kind": Database["public"]['Enums']["extra_price_kind"],"price_rental"?: number | null,"shop_id": string,"sort"?: number,"terms"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"all_models"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"price_1d"?: number | null,"price_30d"?: number | null,"price_7d"?: number | null,"price_kind"?: Database["public"]['Enums']["extra_price_kind"],"price_rental"?: number | null,"shop_id"?: string,"sort"?: number,"terms"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_extras_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
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
                },"shop_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"id": string,"shop_id": string,"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"shop_id": string,"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"shop_id"?: string,"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_invites_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                    "deposit_amount": number | null,"deposit_methods": (Database["public"]['Enums']["deposit_method"])[],"experience_required": boolean,"gloves": Database["public"]['Enums']["gear_option"],"helmet_types": (Database["public"]['Enums']["helmet_type"])[],"helmets": number,"jacket": Database["public"]['Enums']["gear_option"],"km_limit": number,"licence_required": Database["public"]['Enums']["licence_type"],"medical_cover": boolean,"min_age": number | null,"notes": string | null,"passport": Database["public"]['Enums']["passport_policy"],"phone_holder": boolean,"rain_gear": Database["public"]['Enums']["gear_option"],"shop_id": string,"side_panniers": boolean,"top_box": boolean,"updated_at": string,"usage_area": Database["public"]['Enums']["usage_area"],"usb_charger": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "deposit_amount"?: number | null,"deposit_methods"?: (Database["public"]['Enums']["deposit_method"])[],"experience_required"?: boolean,"gloves"?: Database["public"]['Enums']["gear_option"],"helmet_types"?: (Database["public"]['Enums']["helmet_type"])[],"helmets"?: number,"jacket"?: Database["public"]['Enums']["gear_option"],"km_limit"?: number,"licence_required"?: Database["public"]['Enums']["licence_type"],"medical_cover"?: boolean,"min_age"?: number | null,"notes"?: string | null,"passport"?: Database["public"]['Enums']["passport_policy"],"phone_holder"?: boolean,"rain_gear"?: Database["public"]['Enums']["gear_option"],"shop_id": string,"side_panniers"?: boolean,"top_box"?: boolean,"updated_at"?: string,"usage_area"?: Database["public"]['Enums']["usage_area"],"usb_charger"?: boolean
                  }
                  Update: {
                    "deposit_amount"?: number | null,"deposit_methods"?: (Database["public"]['Enums']["deposit_method"])[],"experience_required"?: boolean,"gloves"?: Database["public"]['Enums']["gear_option"],"helmet_types"?: (Database["public"]['Enums']["helmet_type"])[],"helmets"?: number,"jacket"?: Database["public"]['Enums']["gear_option"],"km_limit"?: number,"licence_required"?: Database["public"]['Enums']["licence_type"],"medical_cover"?: boolean,"min_age"?: number | null,"notes"?: string | null,"passport"?: Database["public"]['Enums']["passport_policy"],"phone_holder"?: boolean,"rain_gear"?: Database["public"]['Enums']["gear_option"],"shop_id"?: string,"side_panniers"?: boolean,"top_box"?: boolean,"updated_at"?: string,"usage_area"?: Database["public"]['Enums']["usage_area"],"usb_charger"?: boolean
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
                    "about": string | null,"approved_at": string | null,"boost_level": Database["public"]['Enums']["boost_level"],"buffer_after_h": number,"buffer_before_h": number,"country": string,"created_at": string,"currency": string,"cutoff_minutes": number,"delivery_enabled": boolean,"delivery_radius_km": number | null,"flagged_for_review": boolean,"google_place_id": string | null,"id": string,"location": unknown,"maps_url": string | null,"min_days_booking": number,"min_days_walkin": number,"name": string,"nearest_station": string | null,"notice_h": number,"photos": (string)[],"request_window_min": number,"review_notes": string | null,"slug": string,"status": Database["public"]['Enums']["shop_status"],"submitted_at": string | null,"terms_accepted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string | null,"approved_at"?: string | null,"boost_level"?: Database["public"]['Enums']["boost_level"],"buffer_after_h"?: number,"buffer_before_h"?: number,"country"?: string,"created_at"?: string,"currency"?: string,"cutoff_minutes"?: number,"delivery_enabled"?: boolean,"delivery_radius_km"?: number | null,"flagged_for_review"?: boolean,"google_place_id"?: string | null,"id"?: string,"location"?: unknown,"maps_url"?: string | null,"min_days_booking"?: number,"min_days_walkin"?: number,"name": string,"nearest_station"?: string | null,"notice_h"?: number,"photos"?: (string)[],"request_window_min"?: number,"review_notes"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["shop_status"],"submitted_at"?: string | null,"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "about"?: string | null,"approved_at"?: string | null,"boost_level"?: Database["public"]['Enums']["boost_level"],"buffer_after_h"?: number,"buffer_before_h"?: number,"country"?: string,"created_at"?: string,"currency"?: string,"cutoff_minutes"?: number,"delivery_enabled"?: boolean,"delivery_radius_km"?: number | null,"flagged_for_review"?: boolean,"google_place_id"?: string | null,"id"?: string,"location"?: unknown,"maps_url"?: string | null,"min_days_booking"?: number,"min_days_walkin"?: number,"name"?: string,"nearest_station"?: string | null,"notice_h"?: number,"photos"?: (string)[],"request_window_min"?: number,"review_notes"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["shop_status"],"submitted_at"?: string | null,"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stations": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"lines": (string)[],"location": unknown,"name_en": string,"name_th": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"lines": (string)[],"location": unknown,"name_en": string,"name_th"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"lines"?: (string)[],"location"?: unknown,"name_en"?: string,"name_th"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vehicle_types": {
                  Row: {
                    "created_at": string,"key": string,"name": string,"spec_schema": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"name": string,"spec_schema"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"name"?: string,"spec_schema"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_shop_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"bike_model_shop_id":
{ Args: { "p_bike_model_id": string }; Returns: string
                           },
"can_use_catalog":
{ Args: { "p_catalog_id": string,"p_shop_id": string }; Returns: boolean
                           },
"create_shop":
{ Args: { "p_name": string }; Returns: string
                           },
"create_shop_invite":
{ Args: { "p_shop_id": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_bike_model_public":
{ Args: { "p_bike_model_id": string }; Returns: boolean
                           },
"is_catalog_approved":
{ Args: { "p_catalog_id": string }; Returns: boolean
                           },
"is_shop_closed_on":
{ Args: { "p_date": string,"p_shop_id": string }; Returns: boolean
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
"longest_walkin":
{ Args: { "p_bike_model_id": string,"p_max_days"?: number,"p_start": string }; Returns: number
                           },
"model_offer":
{ Args: { "p_bike_model_id": string,"p_end": string,"p_start": string }; Returns: {
              "free": number,"mode": string
            }[]
                           },
"promotion_shop_id":
{ Args: { "p_promotion_id": string }; Returns: string
                           },
"rental_days":
{ Args: { "p_end": string,"p_start": string }; Returns: number
                           },
"rental_price":
{ Args: { "p_bike_model_id": string,"p_days": number }; Returns: number
                           },
"repair_conflicts":
{ Args: { "p_bike_model_id": string,"p_from": string }; Returns: {
              "booking_id": string,"code": string,"end_at": string,"start_at": string
            }[]
                           },
"search_offers":
{ Args: { "p_catalog_id"?: string,"p_cc_max"?: number,"p_cc_min"?: number,"p_end"?: string,"p_lat"?: number,"p_lng"?: number,"p_min_rating"?: number,"p_now"?: boolean,"p_passport_not_held"?: boolean,"p_price_max_day"?: number,"p_radius_km"?: number,"p_shop_id"?: string,"p_start"?: string,"p_transmission"?: Database["public"]['Enums']["transmission"],"p_type"?: Database["public"]['Enums']["bike_type"] }; Returns: {
              "bike_model_id": string,"boost": Database["public"]['Enums']["boost_level"],"catalog_id": string,"catalog_slug": string,"cc": number,"days": number,"deposit": number,"distance_km": number,"free_units": number,"make": string,"mode": string,"model": string,"per_day": number,"photo": string,"rating": number,"ready_today": boolean,"ready_updated_at": string,"review_count": number,"score": number,"shop_id": string,"shop_lat": number,"shop_lng": number,"shop_name": string,"shop_slug": string,"stock_photo": string,"total": number,"transmission": Database["public"]['Enums']["transmission"],"type": Database["public"]['Enums']["bike_type"],"walkin_max_days": number,"year_from": number,"year_to": number
            }[]
                           },
"shop_coordinates":
{ Args: { "p_shop_id": string }; Returns: {
              "lat": number,"lng": number
            }[]
                           },
"shop_extra_shop_id":
{ Args: { "p_extra_id": string }; Returns: string
                           },
"shop_open_at":
{ Args: { "p_at": string,"p_shop_id": string }; Returns: boolean
                           },
"shop_readiness":
{ Args: { "p_shop_id": string }; Returns: (string)[]
                           },
"shop_stats":
{ Args: { "p_shop_id": string }; Returns: {
              "cancellation_rate": number,"rating": number,"response_rate": number,"review_count": number
            }[]
                           },
"slugify":
{ Args: { "value": string }; Returns: string
                           },
"station_list":
{ Args: { "p_include_inactive"?: boolean }; Returns: {
              "active": boolean,"id": string,"lat": number,"lines": (string)[],"lng": number,"name_en": string,"name_th": string
            }[]
                           },
"submit_shop":
{ Args: { "p_accept_terms": boolean,"p_shop_id": string }; Returns: (string)[]
                           },
"try_uuid":
{ Args: { "value": string }; Returns: string
                           },
"units_in_repair":
{ Args: { "p_bike_model_id": string,"p_date": string }; Returns: number
                           }
          }
          Enums: {
            "app_language": "en"|"th","bike_type": "city_scooter"|"touring"|"adventure"|"sport"|"classic"|"off_road","booking_actor": "customer"|"vendor"|"admin"|"system","booking_kind": "instant"|"request"|"now","booking_status": "pending_vendor"|"declined"|"expired"|"confirmed_unpaid"|"paid"|"picked_up"|"returned"|"cancelled_customer"|"cancelled_vendor"|"cancelled_unpaid"|"no_show","boost_level": "featured"|"preferred"|"normal","catalog_status": "requested"|"approved"|"rejected","deposit_method": "cash"|"card_authorisation"|"bank_transfer","extra_price_kind": "rental"|"time","gear_option": "included"|"paid_extra"|"not_offered","helmet_type": "full_face"|"three_quarter"|"half","key_type": "keyless"|"keyed","licence_type": "none"|"car"|"motorbike"|"international_permit","notify_channel": "email"|"whatsapp","passport_policy": "held"|"copy_only","payment_method": "card"|"promptpay","promotion_kind": "pct"|"fixed"|"long_rental"|"new_customer","shop_member_role": "owner"|"staff","shop_status": "draft"|"pending"|"live"|"suspended","transmission": "automatic"|"semi_auto"|"manual","usage_area": "bangkok"|"province"|"thailand"|"cross_border","user_role": "customer"|"vendor_staff"|"admin"
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
        },"platform": {
          Enums: {
            "platform_role": ["owner", "manager", "staff", "mechanic", "driver"]
          }
        },"public": {
          Enums: {
            "app_language": ["en", "th"],"bike_type": ["city_scooter", "touring", "adventure", "sport", "classic", "off_road"],"booking_actor": ["customer", "vendor", "admin", "system"],"booking_kind": ["instant", "request", "now"],"booking_status": ["pending_vendor", "declined", "expired", "confirmed_unpaid", "paid", "picked_up", "returned", "cancelled_customer", "cancelled_vendor", "cancelled_unpaid", "no_show"],"boost_level": ["featured", "preferred", "normal"],"catalog_status": ["requested", "approved", "rejected"],"deposit_method": ["cash", "card_authorisation", "bank_transfer"],"extra_price_kind": ["rental", "time"],"gear_option": ["included", "paid_extra", "not_offered"],"helmet_type": ["full_face", "three_quarter", "half"],"key_type": ["keyless", "keyed"],"licence_type": ["none", "car", "motorbike", "international_permit"],"notify_channel": ["email", "whatsapp"],"passport_policy": ["held", "copy_only"],"payment_method": ["card", "promptpay"],"promotion_kind": ["pct", "fixed", "long_rental", "new_customer"],"shop_member_role": ["owner", "staff"],"shop_status": ["draft", "pending", "live", "suspended"],"transmission": ["automatic", "semi_auto", "manual"],"usage_area": ["bangkok", "province", "thailand", "cross_border"],"user_role": ["customer", "vendor_staff", "admin"]
          }
        }
} as const
