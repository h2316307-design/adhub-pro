export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_closures: {
        Row: {
          closure_date: string
          contract_id: number | null
          created_at: string | null
          id: number
          notes: string | null
          remaining_balance: number | null
          total_withdrawn: number | null
        }
        Insert: {
          closure_date: string
          contract_id?: number | null
          created_at?: string | null
          id?: number
          notes?: string | null
          remaining_balance?: number | null
          total_withdrawn?: number | null
        }
        Update: {
          closure_date?: string
          contract_id?: number | null
          created_at?: string | null
          id?: number
          notes?: string | null
          remaining_balance?: number | null
          total_withdrawn?: number | null
        }
        Relationships: []
      }
      billboard_faces: {
        Row: {
          count: number | null
          created_at: string | null
          description: string | null
          face_count: number
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          face_count?: number
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          face_count?: number
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billboard_history: {
        Row: {
          ad_type: string | null
          billboard_id: number
          billboard_rent_price: number | null
          contract_number: number | null
          created_at: string | null
          customer_name: string | null
          design_face_a_url: string | null
          design_face_b_url: string | null
          design_name: string | null
          discount_amount: number | null
          discount_percentage: number | null
          duration_days: number | null
          end_date: string | null
          id: string
          installation_cost: number | null
          installation_date: string | null
          installed_image_face_a_url: string | null
          installed_image_face_b_url: string | null
          notes: string | null
          rent_amount: number | null
          start_date: string | null
          team_name: string | null
          total_before_discount: number | null
          updated_at: string | null
        }
        Insert: {
          ad_type?: string | null
          billboard_id: number
          billboard_rent_price?: number | null
          contract_number?: number | null
          created_at?: string | null
          customer_name?: string | null
          design_face_a_url?: string | null
          design_face_b_url?: string | null
          design_name?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          duration_days?: number | null
          end_date?: string | null
          id?: string
          installation_cost?: number | null
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          notes?: string | null
          rent_amount?: number | null
          start_date?: string | null
          team_name?: string | null
          total_before_discount?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_type?: string | null
          billboard_id?: number
          billboard_rent_price?: number | null
          contract_number?: number | null
          created_at?: string | null
          customer_name?: string | null
          design_face_a_url?: string | null
          design_face_b_url?: string | null
          design_name?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          duration_days?: number | null
          end_date?: string | null
          id?: string
          installation_cost?: number | null
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          notes?: string | null
          rent_amount?: number | null
          start_date?: string | null
          team_name?: string | null
          total_before_discount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billboard_levels: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          level_code: string
          level_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          level_code: string
          level_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          level_code?: string
          level_name?: string
        }
        Relationships: []
      }
      billboard_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billboards: {
        Row: {
          Ad_Type: string | null
          Billboard_Name: string | null
          billboard_type: string | null
          capital: number | null
          capital_remaining: number | null
          Category_Level: string | null
          City: string | null
          Contract_Number: number | null
          created_at: string | null
          Customer_Name: string | null
          Days_Count: string | null
          design_face_a: string | null
          design_face_b: string | null
          District: string | null
          Faces_Count: number | null
          GPS_Coordinates: string | null
          GPS_Link: string | null
          GPS_Link_Click: string | null
          has_cutout: boolean | null
          ID: number
          image_name: string | null
          Image_URL: string | null
          is_partnership: boolean | null
          Level: string | null
          maintenance_cost: number | null
          maintenance_date: string | null
          maintenance_notes: string | null
          maintenance_priority: string | null
          maintenance_status: string | null
          maintenance_type: string | null
          Municipality: string | null
          Nearest_Landmark: string | null
          needs_rephotography: boolean | null
          next_maintenance_date: string | null
          Order_Size: string | null
          partner_companies: string[] | null
          Price: number | null
          Rent_End_Date: string | null
          Rent_Start_Date: string | null
          Review: string | null
          Size: string | null
          size_id: number | null
          Status: string | null
          updated_at: string | null
        }
        Insert: {
          Ad_Type?: string | null
          Billboard_Name?: string | null
          billboard_type?: string | null
          capital?: number | null
          capital_remaining?: number | null
          Category_Level?: string | null
          City?: string | null
          Contract_Number?: number | null
          created_at?: string | null
          Customer_Name?: string | null
          Days_Count?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          District?: string | null
          Faces_Count?: number | null
          GPS_Coordinates?: string | null
          GPS_Link?: string | null
          GPS_Link_Click?: string | null
          has_cutout?: boolean | null
          ID?: number
          image_name?: string | null
          Image_URL?: string | null
          is_partnership?: boolean | null
          Level?: string | null
          maintenance_cost?: number | null
          maintenance_date?: string | null
          maintenance_notes?: string | null
          maintenance_priority?: string | null
          maintenance_status?: string | null
          maintenance_type?: string | null
          Municipality?: string | null
          Nearest_Landmark?: string | null
          needs_rephotography?: boolean | null
          next_maintenance_date?: string | null
          Order_Size?: string | null
          partner_companies?: string[] | null
          Price?: number | null
          Rent_End_Date?: string | null
          Rent_Start_Date?: string | null
          Review?: string | null
          Size?: string | null
          size_id?: number | null
          Status?: string | null
          updated_at?: string | null
        }
        Update: {
          Ad_Type?: string | null
          Billboard_Name?: string | null
          billboard_type?: string | null
          capital?: number | null
          capital_remaining?: number | null
          Category_Level?: string | null
          City?: string | null
          Contract_Number?: number | null
          created_at?: string | null
          Customer_Name?: string | null
          Days_Count?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          District?: string | null
          Faces_Count?: number | null
          GPS_Coordinates?: string | null
          GPS_Link?: string | null
          GPS_Link_Click?: string | null
          has_cutout?: boolean | null
          ID?: number
          image_name?: string | null
          Image_URL?: string | null
          is_partnership?: boolean | null
          Level?: string | null
          maintenance_cost?: number | null
          maintenance_date?: string | null
          maintenance_notes?: string | null
          maintenance_priority?: string | null
          maintenance_status?: string | null
          maintenance_type?: string | null
          Municipality?: string | null
          Nearest_Landmark?: string | null
          needs_rephotography?: boolean | null
          next_maintenance_date?: string | null
          Order_Size?: string | null
          partner_companies?: string[] | null
          Price?: number | null
          Rent_End_Date?: string | null
          Rent_Start_Date?: string | null
          Review?: string | null
          Size?: string | null
          size_id?: number | null
          Status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_billboard_size"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_billboard_size_name"
            columns: ["Size"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "fk_billboards_faces_count"
            columns: ["Faces_Count"]
            isOneToOne: false
            referencedRelation: "billboard_faces"
            referencedColumns: ["face_count"]
          },
          {
            foreignKeyName: "fk_billboards_level"
            columns: ["Level"]
            isOneToOne: false
            referencedRelation: "billboard_levels"
            referencedColumns: ["level_code"]
          },
          {
            foreignKeyName: "fk_contract"
            columns: ["Contract_Number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
        ]
      }
      booking_requests: {
        Row: {
          admin_notes: string | null
          billboard_ids: number[]
          created_at: string | null
          customer_id: string | null
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string | null
          total_price: number
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          billboard_ids: number[]
          created_at?: string | null
          customer_id?: string | null
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string | null
          total_price: number
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          billboard_ids?: number[]
          created_at?: string | null
          customer_id?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string | null
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cleanup_logs: {
        Row: {
          billboard_ids_cleaned: number[] | null
          billboards_cleaned: number
          cleanup_date: string
          cleanup_type: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          billboard_ids_cleaned?: number[] | null
          billboards_cleaned?: number
          cleanup_date?: string
          cleanup_type?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          billboard_ids_cleaned?: number[] | null
          billboards_cleaned?: number
          cleanup_date?: string
          cleanup_type?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      Contract: {
        Row: {
          "Ad Type": string | null
          billboard_id: number | null
          billboard_ids: string | null
          billboard_prices: string | null
          billboards_count: number | null
          billboards_data: string | null
          Company: string | null
          "Contract Date": string | null
          contract_currency: string | null
          Contract_Number: number
          "Customer Name": string | null
          customer_category: string | null
          customer_id: string | null
          design_data: Json | null
          Discount: number | null
          Duration: string | null
          "End Date": string | null
          exchange_rate: string | null
          fee: string | null
          id: number
          installation_cost: number | null
          installation_enabled: boolean | null
          installments_data: string | null
          operating_fee_rate: number | null
          "Payment 1": Json | null
          "Payment 2": string | null
          "Payment 3": string | null
          payment_status: string | null
          Phone: string | null
          "Print Status": string | null
          print_cost: number | null
          print_cost_enabled: string | null
          print_price_per_meter: string | null
          Remaining: string | null
          "Renewal Status": string | null
          Total: number | null
          "Total Paid": string | null
          "Total Rent": number | null
        }
        Insert: {
          "Ad Type"?: string | null
          billboard_id?: number | null
          billboard_ids?: string | null
          billboard_prices?: string | null
          billboards_count?: number | null
          billboards_data?: string | null
          Company?: string | null
          "Contract Date"?: string | null
          contract_currency?: string | null
          Contract_Number?: number
          "Customer Name"?: string | null
          customer_category?: string | null
          customer_id?: string | null
          design_data?: Json | null
          Discount?: number | null
          Duration?: string | null
          "End Date"?: string | null
          exchange_rate?: string | null
          fee?: string | null
          id?: number
          installation_cost?: number | null
          installation_enabled?: boolean | null
          installments_data?: string | null
          operating_fee_rate?: number | null
          "Payment 1"?: Json | null
          "Payment 2"?: string | null
          "Payment 3"?: string | null
          payment_status?: string | null
          Phone?: string | null
          "Print Status"?: string | null
          print_cost?: number | null
          print_cost_enabled?: string | null
          print_price_per_meter?: string | null
          Remaining?: string | null
          "Renewal Status"?: string | null
          Total?: number | null
          "Total Paid"?: string | null
          "Total Rent"?: number | null
        }
        Update: {
          "Ad Type"?: string | null
          billboard_id?: number | null
          billboard_ids?: string | null
          billboard_prices?: string | null
          billboards_count?: number | null
          billboards_data?: string | null
          Company?: string | null
          "Contract Date"?: string | null
          contract_currency?: string | null
          Contract_Number?: number
          "Customer Name"?: string | null
          customer_category?: string | null
          customer_id?: string | null
          design_data?: Json | null
          Discount?: number | null
          Duration?: string | null
          "End Date"?: string | null
          exchange_rate?: string | null
          fee?: string | null
          id?: number
          installation_cost?: number | null
          installation_enabled?: boolean | null
          installments_data?: string | null
          operating_fee_rate?: number | null
          "Payment 1"?: Json | null
          "Payment 2"?: string | null
          "Payment 3"?: string | null
          payment_status?: string | null
          Phone?: string | null
          "Print Status"?: string | null
          print_cost?: number | null
          print_cost_enabled?: string | null
          print_price_per_meter?: string | null
          Remaining?: string | null
          "Renewal Status"?: string | null
          Total?: number | null
          "Total Paid"?: string | null
          "Total Rent"?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_general_discounts: {
        Row: {
          applied_date: string
          created_at: string
          customer_id: string
          discount_type: string
          discount_value: number
          id: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_date?: string
          created_at?: string
          customer_id: string
          discount_type: string
          discount_value?: number
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_date?: string
          created_at?: string
          customer_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_general_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_general_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_general_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          collected_via_intermediary: boolean | null
          collection_date: string | null
          collector_name: string | null
          commission_notes: string | null
          contract_number: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          delivery_location: string | null
          distributed_payment_id: string | null
          entry_type: string | null
          id: string
          intermediary_commission: number | null
          method: string | null
          net_amount: number | null
          notes: string | null
          paid_at: string
          printed_invoice_id: string | null
          purchase_invoice_id: string | null
          receiver_name: string | null
          reference: string | null
          sales_invoice_id: string | null
          transfer_fee: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          collected_via_intermediary?: boolean | null
          collection_date?: string | null
          collector_name?: string | null
          commission_notes?: string | null
          contract_number?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_location?: string | null
          distributed_payment_id?: string | null
          entry_type?: string | null
          id?: string
          intermediary_commission?: number | null
          method?: string | null
          net_amount?: number | null
          notes?: string | null
          paid_at?: string
          printed_invoice_id?: string | null
          purchase_invoice_id?: string | null
          receiver_name?: string | null
          reference?: string | null
          sales_invoice_id?: string | null
          transfer_fee?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_via_intermediary?: boolean | null
          collection_date?: string | null
          collector_name?: string | null
          commission_notes?: string | null
          contract_number?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_location?: string | null
          distributed_payment_id?: string | null
          entry_type?: string | null
          id?: string
          intermediary_commission?: number | null
          method?: string | null
          net_amount?: number | null
          notes?: string | null
          paid_at?: string
          printed_invoice_id?: string | null
          purchase_invoice_id?: string | null
          receiver_name?: string | null
          reference?: string | null
          sales_invoice_id?: string | null
          transfer_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_printed_invoice_id_fkey"
            columns: ["printed_invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchases: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          item_name: string
          notes: string | null
          purchase_date: string
          quantity: number
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          item_name: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company: string | null
          contracts_count: number | null
          created_at: string | null
          email: string | null
          first_contract_date: string | null
          id: string
          is_customer: boolean | null
          is_supplier: boolean | null
          last_contract_date: string | null
          last_payment_date: string | null
          name: string
          phone: string | null
          printer_id: string | null
          supplier_type: string | null
          total_rent: number | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          contracts_count?: number | null
          created_at?: string | null
          email?: string | null
          first_contract_date?: string | null
          id?: string
          is_customer?: boolean | null
          is_supplier?: boolean | null
          last_contract_date?: string | null
          last_payment_date?: string | null
          name: string
          phone?: string | null
          printer_id?: string | null
          supplier_type?: string | null
          total_rent?: number | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          contracts_count?: number | null
          created_at?: string | null
          email?: string | null
          first_contract_date?: string | null
          id?: string
          is_customer?: boolean | null
          is_supplier?: boolean | null
          last_contract_date?: string | null
          last_payment_date?: string | null
          name?: string
          phone?: string | null
          printer_id?: string | null
          supplier_type?: string | null
          total_rent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_advances: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          reason: string | null
          remaining: number
          request_date: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          reason?: string | null
          remaining?: number
          request_date?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string | null
          remaining?: number
          request_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contracts: {
        Row: {
          basic_salary: number
          created_at: string
          employee_id: string
          end_date: string | null
          housing_allowance: number | null
          id: string
          notes: string | null
          other_allowance: number | null
          overtime_rate: number | null
          social_security_pct: number | null
          start_date: string
          status: string
          tax_pct: number | null
          transport_allowance: number | null
          updated_at: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          employee_id: string
          end_date?: string | null
          housing_allowance?: number | null
          id?: string
          notes?: string | null
          other_allowance?: number | null
          overtime_rate?: number | null
          social_security_pct?: number | null
          start_date: string
          status?: string
          tax_pct?: number | null
          transport_allowance?: number | null
          updated_at?: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          employee_id?: string
          end_date?: string | null
          housing_allowance?: number | null
          id?: string
          notes?: string | null
          other_allowance?: number | null
          overtime_rate?: number | null
          social_security_pct?: number | null
          start_date?: string
          status?: string
          tax_pct?: number | null
          transport_allowance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_deductions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          base_salary: number
          code: string | null
          created_at: string
          department: string | null
          email: string | null
          hire_date: string | null
          hourly_rate: number | null
          iban: string | null
          id: string
          name: string
          national_id: string | null
          phone: string | null
          position: string | null
          salary_type: string
          status: string
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          code?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          name: string
          national_id?: string | null
          phone?: string | null
          position?: string | null
          salary_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          code?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          name?: string
          national_id?: string | null
          phone?: string | null
          position?: string | null
          salary_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          code: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          category_id: number | null
          created_at: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_number: string | null
          receiver_name: string | null
          sender_name: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          category_id?: number | null
          created_at?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          category_id?: number | null
          created_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_flags: {
        Row: {
          contract_id: string
          created_at: string | null
          excluded: boolean | null
          id: number
          updated_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          excluded?: boolean | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          excluded?: boolean | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses_withdrawals: {
        Row: {
          amount: number
          contract_id: number | null
          created_at: string | null
          date: string | null
          fee_percentage: number | null
          id: number
          method: string | null
          note: string | null
          notes: string | null
          receiver_name: string | null
          sender_name: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          contract_id?: number | null
          created_at?: string | null
          date?: string | null
          fee_percentage?: number | null
          id?: number
          method?: string | null
          note?: string | null
          notes?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          contract_id?: number | null
          created_at?: string | null
          date?: string | null
          fee_percentage?: number | null
          id?: number
          method?: string | null
          note?: string | null
          notes?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      installation_print_pricing: {
        Row: {
          created_at: string
          id: string
          install_price: number
          print_price: number
          size: string
          size_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          install_price?: number
          print_price?: number
          size: string
          size_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          install_price?: number
          print_price?: number
          size?: string
          size_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_print_pricing_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_task_items: {
        Row: {
          billboard_id: number
          completed_at: string | null
          created_at: string
          design_face_a: string | null
          design_face_b: string | null
          has_cutout: boolean | null
          id: string
          installation_date: string | null
          installed_image_face_a_url: string | null
          installed_image_face_b_url: string | null
          installed_image_url: string | null
          notes: string | null
          selected_design_id: string | null
          status: string
          task_id: string
        }
        Insert: {
          billboard_id: number
          completed_at?: string | null
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          has_cutout?: boolean | null
          id?: string
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          installed_image_url?: string | null
          notes?: string | null
          selected_design_id?: string | null
          status?: string
          task_id: string
        }
        Update: {
          billboard_id?: number
          completed_at?: string | null
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          has_cutout?: boolean | null
          id?: string
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          installed_image_url?: string | null
          notes?: string | null
          selected_design_id?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_task_items_billboard_fk"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "installation_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "installation_task_items_selected_design_id_fkey"
            columns: ["selected_design_id"]
            isOneToOne: false
            referencedRelation: "task_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_tasks: {
        Row: {
          contract_id: number
          contract_ids: number[] | null
          created_at: string
          id: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id: number
          contract_ids?: number[] | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: number
          contract_ids?: number[] | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_tasks_contract_fk"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_teams: {
        Row: {
          created_at: string
          id: string
          sizes: string[]
          team_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          sizes?: string[]
          team_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sizes?: string[]
          team_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          billboard_id: number
          created_at: string | null
          days_count: number | null
          description: string
          end_date: string | null
          id: string
          invoice_id: string | null
          quantity: number | null
          start_date: string | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          billboard_id: number
          created_at?: string | null
          days_count?: number | null
          description: string
          end_date?: string | null
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          start_date?: string | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          billboard_id?: number
          created_at?: string | null
          days_count?: number | null
          description?: string
          end_date?: string | null
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          start_date?: string | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billboard_ids: number[]
          contract_number: number | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          payment_terms: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          billboard_ids: number[]
          contract_number?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          billboard_ids?: number[]
          contract_number?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      maintenance_history: {
        Row: {
          billboard_id: number | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          maintenance_date: string
          maintenance_type: string
          priority: string | null
          status: string | null
          technician_name: string | null
          updated_at: string | null
        }
        Insert: {
          billboard_id?: number | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type: string
          priority?: string | null
          status?: string | null
          technician_name?: string | null
          updated_at?: string | null
        }
        Update: {
          billboard_id?: number | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          priority?: string | null
          status?: string | null
          technician_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
        ]
      }
      management_phones: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          phone_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          phone_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          phone_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      messaging_api_settings: {
        Row: {
          api_key: string | null
          api_secret: string | null
          bot_token: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          phone_number: string | null
          platform: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          bot_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          platform: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          bot_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          platform?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      messaging_settings: {
        Row: {
          id: string
          updated_at: string | null
          updated_by: string | null
          whatsapp_bridge_url: string | null
        }
        Insert: {
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_bridge_url?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_bridge_url?: string | null
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          default_capital_contribution: number
          default_partner_post_pct: number
          default_partner_pre_pct: number
          email: string | null
          id: string
          name: string
          notes: string | null
          partnership_percentage: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          default_capital_contribution?: number
          default_partner_post_pct?: number
          default_partner_pre_pct?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          partnership_percentage?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          default_capital_contribution?: number
          default_partner_post_pct?: number
          default_partner_pre_pct?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          partnership_percentage?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments_salary: {
        Row: {
          amount: number
          employee_id: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string
          payroll_item_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          employee_id: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          payroll_item_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          employee_id?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          payroll_item_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_salary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_salary_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          advances_deduction: number
          allowances: number
          basic_salary: number
          contract_id: string | null
          created_at: string
          deductions: number
          employee_id: string
          id: string
          net_salary: number
          overtime_amount: number | null
          overtime_hours: number | null
          paid: boolean | null
          payment_method: string | null
          payroll_id: string
          social_security: number | null
          tax: number | null
          working_days: number | null
          working_hours: number | null
        }
        Insert: {
          advances_deduction?: number
          allowances?: number
          basic_salary?: number
          contract_id?: string | null
          created_at?: string
          deductions?: number
          employee_id: string
          id?: string
          net_salary?: number
          overtime_amount?: number | null
          overtime_hours?: number | null
          paid?: boolean | null
          payment_method?: string | null
          payroll_id: string
          social_security?: number | null
          tax?: number | null
          working_days?: number | null
          working_hours?: number | null
        }
        Update: {
          advances_deduction?: number
          allowances?: number
          basic_salary?: number
          contract_id?: string | null
          created_at?: string
          deductions?: number
          employee_id?: string
          id?: string
          net_salary?: number
          overtime_amount?: number | null
          overtime_hours?: number | null
          paid?: boolean | null
          payment_method?: string | null
          payroll_id?: string
          social_security?: number | null
          tax?: number | null
          working_days?: number | null
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employee_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_summary"
            referencedColumns: ["payroll_id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: []
      }
      period_closures: {
        Row: {
          closure_date: string
          closure_type: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          id: number
          notes: string | null
          period_end: string | null
          period_start: string | null
          remaining_balance: number | null
          total_amount: number | null
          total_contracts: number | null
          total_withdrawn: number | null
        }
        Insert: {
          closure_date: string
          closure_type?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          id?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          remaining_balance?: number | null
          total_amount?: number | null
          total_contracts?: number | null
          total_withdrawn?: number | null
        }
        Update: {
          closure_date?: string
          closure_type?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          id?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          remaining_balance?: number | null
          total_amount?: number | null
          total_contracts?: number | null
          total_withdrawn?: number | null
        }
        Relationships: []
      }
      pricing: {
        Row: {
          "2_months": number | null
          "3_months": number | null
          "6_months": number | null
          billboard_level: string
          created_at: string | null
          customer_category: string
          full_year: number | null
          id: number
          one_day: number | null
          one_month: number | null
          size: string
          size_id: number | null
        }
        Insert: {
          "2_months"?: number | null
          "3_months"?: number | null
          "6_months"?: number | null
          billboard_level: string
          created_at?: string | null
          customer_category: string
          full_year?: number | null
          id?: number
          one_day?: number | null
          one_month?: number | null
          size: string
          size_id?: number | null
        }
        Update: {
          "2_months"?: number | null
          "3_months"?: number | null
          "6_months"?: number | null
          billboard_level?: string
          created_at?: string | null
          customer_category?: string
          full_year?: number | null
          id?: number
          one_day?: number | null
          one_month?: number | null
          size?: string
          size_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pricing_level"
            columns: ["billboard_level"]
            isOneToOne: false
            referencedRelation: "billboard_levels"
            referencedColumns: ["level_code"]
          },
          {
            foreignKeyName: "fk_pricing_size"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pricing_size_name"
            columns: ["size"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["name"]
          },
        ]
      }
      pricing_categories: {
        Row: {
          created_at: string | null
          id: number
          level: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          level: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          level?: string
          name?: string
        }
        Relationships: []
      }
      print_installation_pricing: {
        Row: {
          billboard_level: string
          created_at: string | null
          customer_category: string
          id: number
          installation_price: number | null
          print_price: number | null
          size: string
        }
        Insert: {
          billboard_level: string
          created_at?: string | null
          customer_category: string
          id?: number
          installation_price?: number | null
          print_price?: number | null
          size: string
        }
        Update: {
          billboard_level?: string
          created_at?: string | null
          customer_category?: string
          id?: number
          installation_price?: number | null
          print_price?: number | null
          size?: string
        }
        Relationships: []
      }
      print_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_invoice_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoice_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoice_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      print_task_items: {
        Row: {
          area: number | null
          billboard_id: number | null
          created_at: string
          cutout_image_url: string | null
          description: string | null
          design_face_a: string | null
          design_face_b: string | null
          height: number | null
          id: string
          quantity: number | null
          status: string
          task_id: string
          total_cost: number | null
          unit_cost: number | null
          width: number | null
        }
        Insert: {
          area?: number | null
          billboard_id?: number | null
          created_at?: string
          cutout_image_url?: string | null
          description?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          height?: number | null
          id?: string
          quantity?: number | null
          status?: string
          task_id: string
          total_cost?: number | null
          unit_cost?: number | null
          width?: number | null
        }
        Update: {
          area?: number | null
          billboard_id?: number | null
          created_at?: string
          cutout_image_url?: string | null
          description?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          height?: number | null
          id?: string
          quantity?: number | null
          status?: string
          task_id?: string
          total_cost?: number | null
          unit_cost?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "print_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "print_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      print_tasks: {
        Row: {
          completed_at: string | null
          contract_id: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          cutout_cost: number | null
          cutout_image_url: string | null
          cutout_printer_id: string | null
          cutout_quantity: number | null
          due_date: string | null
          has_cutouts: boolean | null
          id: string
          invoice_id: string | null
          notes: string | null
          price_per_meter: number | null
          printer_id: string | null
          priority: string | null
          status: string
          total_area: number | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contract_id?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          cutout_cost?: number | null
          cutout_image_url?: string | null
          cutout_printer_id?: string | null
          cutout_quantity?: number | null
          due_date?: string | null
          has_cutouts?: boolean | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          price_per_meter?: number | null
          printer_id?: string | null
          priority?: string | null
          status?: string
          total_area?: number | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contract_id?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          cutout_cost?: number | null
          cutout_image_url?: string | null
          cutout_printer_id?: string | null
          cutout_quantity?: number | null
          due_date?: string | null
          has_cutouts?: boolean | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          price_per_meter?: number | null
          printer_id?: string | null
          priority?: string | null
          status?: string
          total_area?: number | null
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_cutout_printer_id_fkey"
            columns: ["cutout_printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printed_invoices: {
        Row: {
          account_deduction: number | null
          account_payments_deducted: string | null
          contract_number: number
          contract_numbers: string | null
          created_at: string
          currency_code: string | null
          currency_symbol: string | null
          "currency_symbol'": string | null
          customer_id: string | null
          customer_name: string | null
          design_face_a_path: string | null
          design_face_b_path: string | null
          discount: number | null
          discount_amount: number | null
          discount_type: string | null
          id: string
          include_account_balance: boolean | null
          invoice_date: string
          invoice_number: string
          invoice_type: string | null
          items: Json | null
          locked: boolean
          notes: string | null
          paid: boolean | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          print_items: string | null
          printer_cost: number | null
          printer_id: string | null
          printer_name: string
          subtotal: number | null
          total: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          account_deduction?: number | null
          account_payments_deducted?: string | null
          contract_number: number
          contract_numbers?: string | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          "currency_symbol'"?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_face_a_path?: string | null
          design_face_b_path?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          include_account_balance?: boolean | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: string | null
          items?: Json | null
          locked?: boolean
          notes?: string | null
          paid?: boolean | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          print_items?: string | null
          printer_cost?: number | null
          printer_id?: string | null
          printer_name: string
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          account_deduction?: number | null
          account_payments_deducted?: string | null
          contract_number?: number
          contract_numbers?: string | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          "currency_symbol'"?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_face_a_path?: string | null
          design_face_b_path?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          include_account_balance?: boolean | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string | null
          items?: Json | null
          locked?: boolean
          notes?: string | null
          paid?: boolean | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          print_items?: string | null
          printer_cost?: number | null
          printer_id?: string | null
          printer_name?: string
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allowed_clients: string[] | null
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          price_tier: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_clients?: string[] | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          price_tier?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_clients?: string[] | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          price_tier?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          item_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          item_name: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          item_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid: boolean
          paid_amount: number
          remaining_credit: number | null
          selectable_for_payment: boolean | null
          total_amount: number
          updated_at: string
          used_as_payment: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_credit?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
          used_as_payment?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_credit?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
          used_as_payment?: number | null
        }
        Relationships: []
      }
      removal_task_items: {
        Row: {
          billboard_id: number
          completed_at: string | null
          created_at: string
          design_face_a: string | null
          design_face_b: string | null
          id: string
          installed_image_url: string | null
          notes: string | null
          removal_date: string | null
          removed_image_url: string | null
          status: string
          task_id: string
        }
        Insert: {
          billboard_id: number
          completed_at?: string | null
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          id?: string
          installed_image_url?: string | null
          notes?: string | null
          removal_date?: string | null
          removed_image_url?: string | null
          status?: string
          task_id: string
        }
        Update: {
          billboard_id?: number
          completed_at?: string | null
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          id?: string
          installed_image_url?: string | null
          notes?: string | null
          removal_date?: string | null
          removed_image_url?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "removal_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "removal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      removal_tasks: {
        Row: {
          contract_id: number
          contract_ids: number[] | null
          created_at: string
          id: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id: number
          contract_ids?: number[] | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: number
          contract_ids?: number[] | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          item_type: string | null
          notes: string | null
          order_index: number | null
          report_id: string | null
          status: string | null
          task_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_type?: string | null
          notes?: string | null
          order_index?: number | null
          report_id?: string | null
          status?: string | null
          task_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_type?: string | null
          notes?: string | null
          order_index?: number | null
          report_id?: string | null
          status?: string | null
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_date: string | null
          font_family: string | null
          font_weight: string | null
          id: string
          report_date: string
          report_type: string
          start_date: string | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          font_family?: string | null
          font_weight?: string | null
          id?: string
          report_date: string
          report_type: string
          start_date?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          font_family?: string | null
          font_weight?: string | null
          id?: string
          report_date?: string
          report_type?: string
          start_date?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          discount: number | null
          id: string
          invoice_date: string
          invoice_name: string | null
          invoice_number: string
          items: Json
          locked: boolean
          notes: string | null
          paid: boolean
          paid_amount: number
          remaining_amount: number | null
          selectable_for_payment: boolean | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          discount?: number | null
          id?: string
          invoice_date?: string
          invoice_name?: string | null
          invoice_number: string
          items: Json
          locked?: boolean
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_amount?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          discount?: number | null
          id?: string
          invoice_date?: string
          invoice_name?: string | null
          invoice_number?: string
          items?: Json
          locked?: boolean
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_amount?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      shared_billboards: {
        Row: {
          billboard_id: number
          capital_contribution: number
          capital_remaining: number
          created_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          partner_company_id: string | null
          partner_post_pct: number
          partner_pre_pct: number
          partnership_percentage: number
          post_company_pct: number
          pre_capital_pct: number
          pre_company_pct: number
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          billboard_id: number
          capital_contribution?: number
          capital_remaining?: number
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          partner_post_pct?: number
          partner_pre_pct?: number
          partnership_percentage?: number
          post_company_pct?: number
          pre_capital_pct?: number
          pre_company_pct?: number
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          billboard_id?: number
          capital_contribution?: number
          capital_remaining?: number
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          partner_post_pct?: number
          partner_pre_pct?: number
          partnership_percentage?: number
          post_company_pct?: number
          pre_capital_pct?: number
          pre_company_pct?: number
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_billboards_partner_company_id_fkey"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_transactions: {
        Row: {
          amount: number
          beneficiary: string
          billboard_id: number | null
          created_at: string
          id: string
          notes: string | null
          partner_company_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          beneficiary: string
          billboard_id?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          beneficiary?: string
          billboard_id?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_transactions_partner_fk"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      sizes: {
        Row: {
          created_at: string | null
          description: string | null
          height: number | null
          id: number
          installation_price: number | null
          name: string
          sort_order: number | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          height?: number | null
          id: number
          installation_price?: number | null
          name: string
          sort_order?: number | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: number
          installation_price?: number | null
          name?: string
          sort_order?: number | null
          width?: number | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_type: string | null
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_designs: {
        Row: {
          created_at: string
          cutout_image_url: string | null
          design_face_a_url: string
          design_face_b_url: string | null
          design_name: string
          design_order: number | null
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cutout_image_url?: string | null
          design_face_a_url: string
          design_face_b_url?: string | null
          design_name: string
          design_order?: number | null
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cutout_image_url?: string | null
          design_face_a_url?: string
          design_face_b_url?: string | null
          design_name?: string
          design_order?: number | null
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_designs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          cancellation_reason: string | null
          completed_at: string | null
          completion_notes: string | null
          completion_result: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_result?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_result?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      template_settings: {
        Row: {
          background_color: string | null
          body_font: string | null
          created_at: string | null
          font_size_body: number | null
          font_size_header: number | null
          footer_text: string | null
          header_font: string | null
          header_text: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          logo_height: number | null
          logo_url: string | null
          logo_width: number | null
          margin_bottom: number | null
          margin_left: number | null
          margin_right: number | null
          margin_top: number | null
          page_orientation: string | null
          page_size: string | null
          primary_color: string | null
          secondary_color: string | null
          show_footer: boolean | null
          show_header: boolean | null
          show_logo: boolean | null
          show_signature: boolean | null
          signature_label: string | null
          signature_url: string | null
          template_name: string
          template_type: string
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          body_font?: string | null
          created_at?: string | null
          font_size_body?: number | null
          font_size_header?: number | null
          footer_text?: string | null
          header_font?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          logo_height?: number | null
          logo_url?: string | null
          logo_width?: number | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          page_orientation?: string | null
          page_size?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_footer?: boolean | null
          show_header?: boolean | null
          show_logo?: boolean | null
          show_signature?: boolean | null
          signature_label?: string | null
          signature_url?: string | null
          template_name: string
          template_type: string
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          body_font?: string | null
          created_at?: string | null
          font_size_body?: number | null
          font_size_header?: number | null
          footer_text?: string | null
          header_font?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          logo_height?: number | null
          logo_url?: string | null
          logo_width?: number | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          page_orientation?: string | null
          page_size?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_footer?: boolean | null
          show_header?: boolean | null
          show_logo?: boolean | null
          show_signature?: boolean | null
          signature_label?: string | null
          signature_url?: string | null
          template_name?: string
          template_type?: string
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours: number | null
          id: string
          notes: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          hours?: number | null
          id?: string
          notes?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours?: number | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          allowed_customers: string[] | null
          company: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          password: string
          phone: string | null
          pricing_category: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_customers?: string[] | null
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          password: string
          phone?: string | null
          pricing_category?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_customers?: string[] | null
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          password?: string
          phone?: string | null
          pricing_category?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          calculation_method: string
          contract_id: number | null
          created_at: string | null
          fee_percentage: number
          id: number
          notes: string | null
          period_end: string | null
          period_start: string | null
          withdrawal_method: string
        }
        Insert: {
          amount: number
          calculation_method: string
          contract_id?: number | null
          created_at?: string | null
          fee_percentage: number
          id?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          withdrawal_method: string
        }
        Update: {
          amount?: number
          calculation_method?: string
          contract_id?: number | null
          created_at?: string | null
          fee_percentage?: number
          id?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          withdrawal_method?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_financial_summary: {
        Row: {
          balance: number | null
          customer_id: string | null
          customer_name: string | null
          total_contracts: number | null
          total_due: number | null
          total_paid: number | null
          total_printed_invoices: number | null
          total_purchases: number | null
          total_sales_invoices: number | null
        }
        Relationships: []
      }
      customer_financials: {
        Row: {
          contracts_count: number | null
          created_at: string | null
          customer_id: string | null
          last_payment_date: string | null
          name: string | null
          total_contracts_amount: number | null
          total_paid: number | null
          total_remaining: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      payroll_summary: {
        Row: {
          payroll_id: string | null
          period_end: string | null
          period_start: string | null
          total_allowances: number | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      shared_beneficiary_summary: {
        Row: {
          beneficiary: string | null
          total_due: number | null
          total_paid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_billboards: {
        Args: never
        Returns: {
          cleaned_billboard_ids: number[]
          cleaned_count: number
          operation_timestamp: string
        }[]
      }
      cleanup_orphaned_data: { Args: never; Returns: number }
      contracts_by_customer: { Args: { cust_id: string }; Returns: Json }
      create_installation_tasks_for_contract: {
        Args: { p_contract_number: number }
        Returns: Json
      }
      delete_billboard: { Args: { billboard_id: number }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      round: { Args: { digits: number; val: number }; Returns: number }
      safe_delete_billboard: {
        Args: { input_billboard_id: number }
        Returns: boolean
      }
      shared_company_summary: {
        Args: { p_beneficiary: string }
        Returns: {
          total_due: number
          total_paid: number
        }[]
      }
      show_tables_summary: {
        Args: never
        Returns: {
          sample_data: Json
          structure: Json
          table_name: string
        }[]
      }
      sync_billboards_from_contract: {
        Args: { p_contract_number: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      user_role: "user" | "admin" | "manager" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      user_role: ["user", "admin", "manager", "viewer"],
    },
  },
} as const
