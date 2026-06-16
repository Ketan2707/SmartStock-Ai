# Implementation Tasks — SmartStock AI Phase 2

## Task 1: Database Migration

- [x] 1.1 Create `supabase/phase2_migration.sql` with all new tables: `bill_scans`, `voice_logs`, `ai_predictions`, `chat_history`, `purchase_orders`, `purchase_order_items`, `feedback`, `bug_reports`, `cookie_consents`, `shop_settings`
- [x] 1.2 Add column additions to `products`: `tags`, `search_keywords`, `default_supplier_id`
- [x] 1.3 Update `notifications` type check constraint to include `purchase_order`
- [x] 1.4 Add RLS policies for all new tables following existing Phase 1 patterns
- [ ] 1.5 Add `updated_at` triggers for `purchase_orders` and `shop_settings`

## Task 2: API Setup

- [~] 2.1 Install API dependencies: `@google/generative-ai`, `tesseract.js`, `multer`, `@supabase/supabase-js`, `@types/multer`
- [~] 2.2 Update `apps/api/.env.example` with `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [~] 2.3 Create `apps/api/src/services/gemini.ts` — Gemini client with typed prompt builders for: bill parsing, voice intent, product metadata, business chat
- [~] 2.4 Create `apps/api/src/services/ocr.ts` — Tesseract.js wrapper returning extracted text from image buffer
- [~] 2.5 Create `apps/api/src/middleware/upload.ts` — multer config: memory storage, 10MB max, accepted MIME types
- [~] 2.6 Create `apps/api/src/routes/bill.ts` — `POST /ai/bill-scan` and `POST /ai/bill-scan/confirm`
- [~] 2.7 Create `apps/api/src/routes/voice.ts` — `POST /ai/voice-command`
- [~] 2.8 Create `apps/api/src/routes/product-ai.ts` — `POST /ai/product-metadata`
- [~] 2.9 Create `apps/api/src/routes/chat.ts` — `POST /ai/chat`
- [~] 2.10 Mount all new routes in `apps/api/src/server.ts`

## Task 3: Shared Schemas

- [~] 3.1 Add `PurchaseOrderItemSchema`, `PurchaseOrderCreateSchema` to `packages/shared/src/index.ts`
- [~] 3.2 Add `ContactUsSchema`, `FeedbackSchema`, `BugReportSchema`
- [~] 3.3 Add `VoiceIntentSchema` (action, product_name, quantity, cost_price?, selling_price?)

## Task 4: Supplier Management (Feature 12)

- [~] 4.1 Create `apps/web/src/views/suppliers/SuppliersPage.tsx` — table with Add/Edit/Delete
- [~] 4.2 Create `apps/web/src/views/suppliers/SupplierForm.tsx` — modal form using `SupplierSchema`
- [~] 4.3 Create `apps/web/src/views/suppliers/SupplierDetailPage.tsx` — shows linked products + purchase history
- [~] 4.4 Add supplier selector to existing `ProductForm.tsx` (`default_supplier_id` field)
- [~] 4.5 Add `/app/suppliers` route to `router.tsx`
- [~] 4.6 Add Suppliers link to AppLayout sidebar

## Task 5: Purchase Orders (Feature 13)

- [~] 5.1 Create `apps/web/src/views/purchase-orders/PurchaseOrdersPage.tsx` — list with status badges
- [~] 5.2 Create `apps/web/src/views/purchase-orders/PurchaseOrderForm.tsx` — supplier select + line items table
- [~] 5.3 Create `apps/web/src/views/purchase-orders/PurchaseOrderDetailPage.tsx` — line items + status controls
- [~] 5.4 Implement "Mark as Received" action: updates status + increments product quantities + inventory_logs entries
- [~] 5.5 Auto-generate order number `PO-{YYYY}-{NNN}` on create
- [~] 5.6 Add `/app/purchase-orders` and `/app/purchase-orders/:id` routes to `router.tsx`
- [~] 5.7 Add Purchase Orders link to AppLayout sidebar

## Task 6: Notification Center (Feature 14)

- [~] 6.1 Create `apps/web/src/lib/notifications.ts` — `useNotifications()` hook (React Query, 60s polling)
- [~] 6.2 Create `apps/web/src/ui/common/NotificationBell.tsx` — bell icon + unread badge + dropdown panel
- [~] 6.3 Add `NotificationBell` to `AppLayout` header
- [~] 6.4 Create `apps/web/src/views/notifications/NotificationsPage.tsx` — full notification history
- [~] 6.5 Implement client-side notification creation after sales (low_stock / out_of_stock checks)
- [~] 6.6 Implement client-side notification creation after inventory adjustments
- [~] 6.7 Implement expiry notification check on app load (localStorage daily cadence)
- [~] 6.8 Add `/app/notifications` route and sidebar link

## Task 7: AI Insights + Predictions on Dashboard (Features 7–10)

- [~] 7.1 Create `apps/web/src/ui/ai/DemandPanel.tsx` — stock-out predictions table with red/amber urgency rows
- [~] 7.2 Create `apps/web/src/ui/ai/DeadStockPanel.tsx` — dead stock list with threshold-based recommendations
- [~] 7.3 Create `apps/web/src/ui/ai/SeasonalPanel.tsx` — seasonal forecast cards (always renders, shows empty state)
- [~] 7.4 Create `apps/web/src/ui/ai/InsightsPanel.tsx` — aggregated panel, up to 10 cards, urgency-sorted
- [~] 7.5 Implement prediction computation logic in a `lib/predictions.ts` util (pure functions, no API needed)
- [~] 7.6 Add all four panels to `DashboardPage.tsx` below existing charts

## Task 8: AI Action Center (Feature 11)

- [~] 8.1 Add expandable action row to each `InsightsPanel` card: "Generate PO", "Contact Supplier", "Ignore"
- [~] 8.2 Implement "Generate PO" — creates purchase_orders + purchase_order_items row, navigates to /app/purchase-orders
- [~] 8.3 Implement "Contact Supplier" — `mailto:` with pre-filled subject/body if supplier linked, else navigate to /app/suppliers
- [~] 8.4 Implement "Ignore" — sets `ignored = true` in `ai_predictions`, removes card from panel for session

## Task 9: Smart Product Creation (Feature 5)

- [~] 9.1 Add "Quick Add" button/tab to `ProductsPage.tsx` alongside existing "Add Product"
- [~] 9.2 Create `apps/web/src/views/products/QuickAddForm.tsx` — 4-field form (name, quantity, cost, selling price)
- [~] 9.3 On submit: call `POST /ai/product-metadata` → show review screen with generated metadata
- [~] 9.4 On confirm: insert product with all fields including tags + search_keywords
- [~] 9.5 Implement fallback: if API fails, generate timestamp-based SKU and save with empty category

## Task 10: AI Business Assistant (Feature 6)

- [~] 10.1 Create `apps/web/src/views/ai/AIAssistantPage.tsx` — chat UI (messages list + input box)
- [~] 10.2 Implement message send: POST to `/ai/chat` with shop context + history
- [~] 10.3 Persist chat turns to `chat_history` table via Supabase client
- [~] 10.4 Load last 20 turns on page open
- [~] 10.5 Add "Clear Chat" button deleting `chat_history` rows for current user + shop
- [~] 10.6 Add loading indicator + error state with retry button
- [~] 10.7 Add `/app/ai/assistant` route

## Task 11: AI Tools Hub Page

- [~] 11.1 Create `apps/web/src/views/ai/AIToolsPage.tsx` — grid of cards linking to: AI Assistant, Scan Bill, Voice Assistant
- [~] 11.2 Replace the existing `/app/ai` stub route with `AIToolsPage`

## Task 12: Bill Scanner (Feature 3)

- [~] 12.1 Create `apps/web/src/views/ai/BillScanPage.tsx` — 3-step wizard: Upload → Processing → Review
- [~] 12.2 Step 1: drag-drop + file picker, validates file type + size (≤10MB)
- [~] 12.3 Step 2: POST to `/ai/bill-scan`, shows spinner with 30s timeout UI
- [~] 12.4 Step 3: editable preview table (matched badge vs "New Product" badge), confirm button
- [~] 12.5 On confirm: POST to `/ai/bill-scan/confirm` → inventory updated → success state
- [~] 12.6 Create `apps/web/src/views/ai/BillHistoryPage.tsx` — list past bill scans with status
- [~] 12.7 Add `/app/ai/bill-scan` and `/app/ai/bill-scan/history` routes

## Task 13: Voice Assistant (Feature 4)

- [~] 13.1 Create `apps/web/src/ui/common/VoiceFab.tsx` — fixed bottom-right mic button
- [~] 13.2 Implement `MediaRecorder` audio capture, 60s auto-stop, send to `/ai/voice-command`
- [~] 13.3 Show transcript + parsed intent confirmation dialog before executing action
- [~] 13.4 Execute: add/remove stock or create product based on intent
- [~] 13.5 Store command in `voice_logs` table
- [~] 13.6 Create `apps/web/src/views/ai/VoiceAssistantPage.tsx` — full voice history + mic interface
- [~] 13.7 Add `VoiceFab` to `AppLayout` (renders inside app routes)
- [~] 13.8 Handle mic permission denial with instructional message
- [~] 13.9 Add `/app/ai/voice` route

## Task 14: Feedback System (Feature 15)

- [~] 14.1 Create `apps/web/src/views/feedback/FeedbackPage.tsx` — 3 tabs: Contact / Feedback / Bug Report
- [~] 14.2 Contact Us tab: name + email + message form, inserts into `feedback` table
- [~] 14.3 Feedback tab: star rating + type select + description, inserts into `feedback` table
- [~] 14.4 Bug Report tab: description + optional screenshot upload to `bug-reports/` Supabase Storage bucket
- [~] 14.5 All forms retain input on failure and show error message
- [~] 14.6 Add "Help / Feedback" link to AppLayout sidebar footer
- [~] 14.7 Add `/app/feedback` route

## Task 15: Legal Pages + Cookie Consent (Feature 16)

- [~] 15.1 Create `apps/web/src/views/legal/PrivacyPolicyPage.tsx` at route `/privacy`
- [~] 15.2 Create `apps/web/src/views/legal/TermsPage.tsx` at route `/terms`
- [~] 15.3 Create `apps/web/src/views/legal/CookiePolicyPage.tsx` at route `/cookies`
- [~] 15.4 Create `apps/web/src/ui/common/CookieConsentBanner.tsx` — Accept / Decline buttons with cookie policy link
- [~] 15.5 Implement consent logic: check localStorage on mount, store explicit decisions to `cookie_consents` table
- [~] 15.6 Mount `CookieConsentBanner` in `main.tsx` outside of AuthProvider (shows for all visitors)
- [~] 15.7 Add public routes to `router.tsx`
- [~] 15.8 Link legal pages from `AuthLayout` footer ("Terms & Conditions · Privacy Policy")

## Task 16: Settings Enhancements (Feature 17)

- [~] 16.1 Create `apps/web/src/lib/i18n.ts` — translation map + `LanguageProvider` context + `useTranslation()` hook
- [~] 16.2 Add translations for all nav labels, common buttons, and page titles (EN + HI)
- [~] 16.3 Add "Notifications" tab to `SettingsPage.tsx` — toggles for 5 notification types, persisted to `shop_settings`
- [~] 16.4 Add "Language" preference to Settings — EN/HI selector, persisted to `shop_settings`
- [~] 16.5 Add "Theme" preference to Settings — Light/Dark/System, replaces localStorage-only ThemeToggle
- [~] 16.6 Wrap `AppLayout` with `LanguageProvider`, load language from `shop_settings` on shop load
- [~] 16.7 Apply translations to sidebar nav items, header, and common buttons

## Task 17: AppLayout Final Updates

- [~] 17.1 Reorganise sidebar with AI section (AI Tools, AI Assistant, Scan Bill, Voice) and Operations section (Suppliers, Purchase Orders)
- [~] 17.2 Add `NotificationBell` to header
- [~] 17.3 Add `VoiceFab` floating button inside main content area
- [~] 17.4 Add "Help" link to sidebar footer → `/app/feedback`
- [~] 17.5 Update footer with links to `/privacy` and `/terms`
