# Requirements Document

## Introduction

SmartStock AI Phase 2 extends an existing inventory management application for local Indian businesses. The existing app covers authentication, shop management, product CRUD, inventory tracking, billing/sales, dashboard, and settings. Phase 2 adds AI-powered features (bill scanning, voice assistant, smart product creation, business chat, demand prediction, dead stock detection, seasonal forecasting, insights, and action automation) alongside operational modules (supplier management, purchase orders, notifications, feedback, legal pages, and settings enhancements) and the database tables required to support them.

The product philosophy is **PHOTO FIRST, VOICE FIRST, AI FIRST, FORMS LAST**: the system must favour image upload, voice input, and AI-assisted data entry over manual forms wherever possible.

---

## Glossary

- **Bill_Scanner**: The subsystem that accepts a supplier bill image, runs OCR and AI extraction, and produces a list of line items for inventory update.
- **OCR_Engine**: Tesseract OCR library used to extract raw text from uploaded images.
- **AI_Extractor**: The Google Gemini API integration that parses OCR text into structured product line items (name, quantity, cost price).
- **Bill_Processing_History**: The page/view that lists all past scanned bills and their processing status.
- **Voice_Assistant**: The microphone-based subsystem that captures spoken commands, transcribes them, and extracts inventory intents via the AI_Extractor.
- **Intent_Parser**: The Gemini API component that converts transcribed speech into structured inventory actions.
- **Voice_History**: The page/view that lists all past voice commands and their resolved actions.
- **Smart_Creator**: The AI-assisted product creation flow that accepts minimal input and auto-generates metadata.
- **AI_Metadata_Generator**: The Gemini API call that produces SKU, category, brand, tags, reorder threshold, and search keywords from a product name.
- **Business_Assistant**: The chat interface that answers business questions using live shop data.
- **Chat_Context_Builder**: The backend service that assembles a data snapshot (products, inventory, sales, bills, revenue, profit) and injects it into the Gemini conversation.
- **Demand_Engine**: The backend service that analyses sales history and inventory levels to produce stock-out dates and reorder quantities.
- **Dead_Stock_Detector**: The backend service that flags products with zero or negligible sales over a configurable look-back window.
- **Seasonal_Forecaster**: The backend service that correlates calendar seasons and Indian festivals with historical sales to recommend pre-season restocking.
- **Insights_Panel**: The dashboard widget that surfaces AI-generated actionable recommendations.
- **Action_Center**: The UI component that lets users execute a recommended action (generate purchase order, contact supplier, ignore) directly from an insight card.
- **Supplier_Module**: The full CRUD subsystem for managing supplier records.
- **Purchase_Order**: A document recording a request to purchase goods from a supplier, with line items and status lifecycle.
- **Notification_Center**: The in-app notification hub showing alerts, badges, and history.
- **Feedback_Module**: The subsystem accepting contact messages, product feedback ratings, and bug reports.
- **Legal_Pages**: The static pages covering Privacy Policy, Terms & Conditions, and Cookie Policy.
- **Cookie_Consent_Banner**: The banner presented to new visitors requesting consent for cookie/tracking use.
- **Shop_Settings**: Per-shop configuration stored in the `shop_settings` table (notification preferences, language, theme).
- **System**: The SmartStock AI application as a whole unless a subsystem name is used.
- **User**: An authenticated shop owner interacting with the System.

---

## Requirements

---

### Requirement 3: AI Bill Scanner

**User Story:** As a shop owner, I want to photograph or upload a supplier bill so that the System extracts product details automatically and updates my inventory without manual data entry.

#### Acceptance Criteria

1. THE System SHALL provide a dedicated "Scan Stock Bill" page accessible from the main navigation.
2. WHEN the User selects an image file (JPEG, PNG, WEBP, PDF) of up to 10 MB, THE Bill_Scanner SHALL upload the file to Supabase Storage under the `bills/` bucket path scoped to the active shop.
3. WHEN the image is stored, THE OCR_Engine SHALL extract raw text from the uploaded image and return it to the Bill_Scanner within 30 seconds; IF the OCR_Engine does not return a result within 30 seconds, THEN THE Bill_Scanner SHALL cancel the request, record processing_status = 'failed', and surface an error to the User.
4. WHEN raw OCR text is available, THE AI_Extractor SHALL parse the text using the Gemini API and return a structured list of line items each containing: product name, quantity (integer ≥ 1), and cost price (decimal ≥ 0). IF the Gemini API returns an error response (including rate limiting or invalid request), THEN THE Bill_Scanner SHALL treat it as a failure, display a generic error message with a retry option, and record processing_status = 'failed'. WHEN the Gemini API call does not return within 20 seconds, THE Bill_Scanner SHALL display the review screen with any partial data received, or trigger the error fallback if no data is available.
5. THE Bill_Scanner SHALL match each extracted product name against existing products in the active shop's `products` table using case-insensitive substring matching before presenting the preview.
6. WHEN an extracted product name matches an existing product, THE Bill_Scanner SHALL pre-select that product in the preview row.
7. WHEN an extracted product name does not match any existing product, THE Bill_Scanner SHALL mark the row as "New Product" and allow the User to confirm or edit it before saving.
8. THE System SHALL display a preview screen showing all extracted line items with matched/new status, editable quantity, and editable cost price before any inventory change is made.
9. WHEN the User confirms the preview, THE System SHALL update the `quantity` and `cost_price` of each matched product and create new products for unmatched rows, then record an `inventory_logs` entry with `action = 'increase'` for each affected product.
10. IF the OCR_Engine or AI_Extractor returns an error, THEN THE Bill_Scanner SHALL display the error message and allow the User to retry or manually enter the bill details.
11. THE System SHALL store each bill scan as a record in the `bill_scans` table containing: shop_id, user_id, storage_path, processing_status, extracted_items (JSON), and created_at.
12. THE Bill_Processing_History page SHALL list all bill scans for the active shop ordered by created_at descending, showing storage thumbnail, scan date, item count, and processing status.
13. WHEN the User clicks a past bill scan record, THE System SHALL display the extracted items and the storage image side by side.

---

### Requirement 4: Voice Inventory Assistant

**User Story:** As a shop owner, I want to speak inventory commands in English, Hindi, or mixed Hindi-English so that the System updates my stock without typing.

#### Acceptance Criteria

1. THE System SHALL provide a persistent microphone button accessible from within the app that activates the Voice_Assistant.
2. WHEN the User activates the microphone, THE Voice_Assistant SHALL capture audio using the browser's MediaRecorder API and automatically stop recording when the User taps the stop button or when 60 seconds of continuous recording have elapsed, whichever occurs first.
3. WHEN recording stops, THE Voice_Assistant SHALL transmit the audio to the API server for transcription and intent parsing.
4. THE Intent_Parser SHALL accept transcribed text in English, Hindi, or transliterated Hindi-English (Hinglish) and extract a structured intent containing: action (add / remove / create), product name, quantity (integer ≥ 1), and optionally cost price and selling price. IF the Gemini API returns an error response (including rate limiting or invalid request), THEN THE Voice_Assistant SHALL treat it as a failure, display a generic error message with a retry option, and NOT perform any inventory action.
5. WHEN the intent action is `add` and the Intent_Parser has successfully extracted a valid intent, THE System SHALL increase the matched product's quantity by the specified amount and log the change with `action = 'increase'` in `inventory_logs`. IF intent parsing did not succeed, THE System SHALL ignore the command.
6. WHEN the intent action is `remove` and the Intent_Parser has successfully extracted a valid intent, THE System SHALL decrease the matched product's quantity by the specified amount (minimum result: 0) and log the change with `action = 'decrease'` in `inventory_logs`. THE System SHALL require successful parsing before executing any removal.
7. WHEN the intent action is `create` and the Intent_Parser has successfully extracted a valid intent, THE System SHALL create a new product with the extracted name, quantity, cost price, and selling price, and apply Smart_Creator AI metadata generation (per Requirement 5). THE System SHALL require successful parsing before creating any product.
8. WHEN the Intent_Parser cannot extract a clear intent, THE Voice_Assistant SHALL display a confirmation dialog showing the transcribed text and ask the User to clarify or cancel.
9. THE System SHALL store every voice command in the `voice_logs` table containing: shop_id, user_id, raw_transcript, parsed_intent (JSON), action_taken, and created_at.
10. THE Voice_History page SHALL list all voice_logs for the active shop ordered by created_at descending, showing transcript, parsed action, and result status.
11. IF the microphone permission is denied by the browser, THEN THE Voice_Assistant SHALL display an instructional message explaining how to grant microphone access.

---

### Requirement 5: Smart Product Creation

**User Story:** As a shop owner, I want to create a product by entering only its name, quantity, cost price, and selling price so that the System fills in the remaining product fields automatically.

#### Acceptance Criteria

1. THE System SHALL offer a "Quick Add" product creation mode reachable from the Products page and from the Voice_Assistant product creation flow.
2. WHEN the User submits the Quick Add form with a product name, quantity (integer ≥ 0), cost price (decimal ≥ 0), and selling price (decimal ≥ 0), THE AI_Metadata_Generator SHALL be called with the product name and shop context.
3. THE AI_Metadata_Generator SHALL return: SKU (format: 3-letter brand prefix + hyphen + 3-digit number, e.g. MAG-001), category string, brand string, product tags (array of up to 5 strings), reorder threshold (integer ≥ 1), and search keywords (array of up to 10 strings).
4. WHEN the AI_Metadata_Generator response is received, THE System SHALL display a review screen showing the generated metadata alongside the User's input before saving.
5. WHEN the User confirms on the review screen, THE System SHALL insert a new row into the `products` table with all generated and user-supplied fields.
6. WHEN the AI_Metadata_Generator call fails, THE System SHALL fall back to saving the product with a system-generated SKU (timestamp-based) and an empty category, without blocking the save.
7. THE System SHALL ensure the generated SKU is unique within the active shop by appending an incrementing suffix if a conflict exists.

---

### Requirement 6: AI Business Assistant

**User Story:** As a shop owner, I want to ask plain-language questions about my business so that the System answers using my actual products, inventory, sales, and financial data.

#### Acceptance Criteria

1. THE System SHALL provide a dedicated "AI Assistant" page with a chat interface accessible from the main navigation.
2. THE Business_Assistant page SHALL display a conversation history of messages between the User and the assistant, ordered chronologically with the most recent message visible.
3. WHEN the User submits a message, THE Chat_Context_Builder SHALL fetch a data snapshot of the active shop's products, current inventory levels, sales summary (last 30 days), top 10 selling products, revenue total, and gross profit total, then include this snapshot in the Gemini API prompt.
4. WHEN the Gemini API returns a response, THE Business_Assistant SHALL display the response as a formatted assistant message within 10 seconds of submission. IF the Gemini API returns an error response (including rate limiting or invalid request), THEN THE Business_Assistant SHALL treat it as a failure, display a generic error message, and provide a retry button for the last message.
5. THE System SHALL store each conversation turn (user message + assistant response) in the `chat_history` table containing: shop_id, user_id, role ('user' | 'assistant'), message text, and created_at.
6. THE Business_Assistant SHALL load the last 20 conversation turns on page open so the User can continue a prior session.
7. THE System SHALL provide a "Clear Chat" button that deletes all `chat_history` rows for the current User and active shop.

---

### Requirement 7: Demand Prediction Engine

**User Story:** As a shop owner, I want the System to predict when each product will run out of stock so that I can reorder before a stockout occurs.

#### Acceptance Criteria

1. THE Demand_Engine SHALL compute a per-product average daily sales rate using the `sale_items` records for the active shop over the last 30 days.
2. WHEN the average daily sales rate is greater than 0 and the current stock quantity is greater than 0, THE Demand_Engine SHALL calculate the predicted stock-out date as: current_date + floor(quantity / avg_daily_rate) days.
3. THE Demand_Engine SHALL compute a recommended reorder quantity as: ceil(avg_daily_rate × 30) units (30-day replenishment buffer).
4. THE System SHALL expose a prediction dashboard panel on the Dashboard page that lists all products with a predicted stock-out date within 14 days, showing: product name, current quantity, avg daily sales, predicted stock-out date, and recommended reorder quantity.
5. WHEN a product's predicted stock-out date is within 7 days, THE System SHALL display the prediction row with a high-urgency visual indicator (red).
6. WHEN a product's predicted stock-out date is between 8 and 14 days, THE System SHALL display the prediction row with a medium-urgency visual indicator (amber).
7. THE System SHALL store prediction snapshots in the `ai_predictions` table containing: shop_id, product_id, prediction_type ('demand'), predicted_stockout_date, avg_daily_rate, recommended_qty, and created_at, refreshed at most once per hour per shop.
8. WHEN a product has zero sales in the last 30 days, THE Demand_Engine SHALL exclude that product from stock-out predictions and instead flag it for the Dead_Stock_Detector.

---

### Requirement 8: Dead Stock Detection

**User Story:** As a shop owner, I want the System to identify products that are not selling so that I can make informed decisions about reducing orders or offering discounts.

#### Acceptance Criteria

1. THE Dead_Stock_Detector SHALL identify products in the active shop where no sale has been recorded in `sale_items` for the last 30 days and current quantity is greater than 0.
2. THE System SHALL display a "Dead Stock" section on the Dashboard page listing all flagged products with: product name, current quantity, last sale date (or "Never sold"), and quantity value at cost (quantity × cost_price).
3. FOR each dead stock product, THE System SHALL display one of three system recommendations: "Reduce purchase quantity", "Consider discount promotion", or "Review product listing" — selected based on quantity thresholds (> 100 units: reduce purchases; 20–100 units: discount promotion; < 20 units: review listing).
4. THE System SHALL store dead stock flags in the `ai_predictions` table with prediction_type = 'dead_stock', containing product_id, days_without_sales, quantity_at_cost, and created_at, refreshed at most once per day per shop.
5. WHEN the User clicks a dead stock product row, THE System SHALL navigate to that product's detail view.

---

### Requirement 9: Seasonal Demand Forecasting

**User Story:** As a shop owner, I want the System to warn me about upcoming seasonal demand increases so that I can stock up in advance.

#### Acceptance Criteria

1. THE Seasonal_Forecaster SHALL maintain a hardcoded calendar of recurring Indian seasons and festivals: Summer (Apr–Jun), Monsoon (Jul–Sep), Winter (Oct–Nov), Diwali (Oct–Nov), Holi (Mar), Eid (date varies ±15 days), Christmas (Dec), New Year (Dec–Jan).
2. WHEN a season or festival is within 21 days of the current date, THE Seasonal_Forecaster SHALL analyse the active shop's sales history for the matching period in prior years to calculate a demand multiplier per product category.
3. WHEN the demand multiplier for a category is greater than 1.2 (≥ 20% increase), THE System SHALL generate a seasonal forecast recommendation for that category containing: season name, category, demand multiplier, and suggested reorder action.
4. THE System SHALL display seasonal forecast recommendations in a dedicated "Seasonal Trends" panel on the Dashboard page. WHEN no seasonal recommendations exist (no season within 21 days, or all multipliers below 1.2), THE System SHALL display the panel with a message explaining that no seasonal trends are currently active.
5. THE System SHALL store seasonal forecast records in the `ai_predictions` table with prediction_type = 'seasonal', containing shop_id, season_name, category, demand_multiplier, recommendation_text, and valid_until date.
6. WHEN fewer than 12 months of sales history exist for a shop, THE Seasonal_Forecaster SHALL display a notice that forecasts will improve as more data is collected, and SHALL still surface the recommendation using category-level heuristics.

---

### Requirement 10: AI Insights Center

**User Story:** As a shop owner, I want a single panel on my dashboard that surfaces the most actionable AI recommendations so that I can act on them without navigating between pages.

#### Acceptance Criteria

1. THE System SHALL display an "AI Insights" panel on the Dashboard page that aggregates active recommendations from the Demand_Engine, Dead_Stock_Detector, and Seasonal_Forecaster.
2. THE Insights_Panel SHALL display up to 10 recommendations ordered by urgency: stock-out within 7 days first, then stock-out within 14 days, then dead stock, then seasonal forecasts.
3. EACH recommendation card SHALL display: insight type icon, product or category name, a one-sentence human-readable description (e.g. "Maggi may run out in 4 days"), and an urgency badge.
4. WHEN the User clicks a recommendation card, THE System SHALL expand the card to show detail and available actions (per Requirement 11).
5. THE Insights_Panel SHALL refresh its data when the Dashboard page loads and SHALL display the last-computed predictions if a refresh is not due.

---

### Requirement 11: AI Action Center

**User Story:** As a shop owner, I want to act directly on an AI recommendation with one click so that I do not have to manually create purchase orders or contact suppliers.

#### Acceptance Criteria

1. EACH expanded recommendation card in the Insights_Panel SHALL display the available actions: "Generate Purchase Order", "Contact Supplier", and "Ignore".
2. WHEN the User selects "Generate Purchase Order", THE Action_Center SHALL create a new `purchase_orders` record in Draft status using the recommended_qty from the prediction, linked to the product and any associated supplier if one exists, then navigate the User to the Purchase Orders page with the new draft pre-opened.
3. WHEN the User selects "Contact Supplier" and a supplier is linked to the product, THE Action_Center SHALL open the device's default email client (via `mailto:`) pre-filled with the supplier's email, a subject of "Restock Request — {product name}", and a body summarising the recommended order quantity.
4. WHEN the User selects "Contact Supplier" and no supplier is linked to the product, THE Action_Center SHALL navigate the User to the Supplier Management page with an informational prompt to add a supplier for that product.
5. WHEN the User selects "Ignore", THE System SHALL mark the underlying `ai_predictions` record with `ignored = true` and remove the card from the Insights_Panel for 7 days.
6. WHEN a "Generate Purchase Order" action is triggered, THE System SHALL create a corresponding `purchase_order_items` record containing: product_id, quantity, unit_cost (from current cost_price), and link it to the created purchase order.

---

### Requirement 12: Supplier Management

**User Story:** As a shop owner, I want to manage a list of my suppliers so that I can track who I buy from and quickly contact them when restocking.

#### Acceptance Criteria

1. THE System SHALL provide a "Suppliers" page accessible from the main navigation supporting full CRUD operations on supplier records.
2. WHEN the User creates a supplier, THE Supplier_Module SHALL require: Name (non-empty string). All other fields (contact name, phone, email, address, notes) SHALL be optional.
3. IF the User provides an email address, THEN THE Supplier_Module SHALL validate it as a properly formatted email address before saving.
4. THE Suppliers page SHALL list all suppliers for the active shop in a table showing: name, contact name, phone, email, and an actions column (Edit, Delete).
5. WHEN the User views a supplier detail, THE System SHALL display the supplier's associated products (products that have been linked via purchase orders) and the purchase history (list of purchase orders) for that supplier.
6. WHEN the User deletes a supplier, THE System SHALL require confirmation regardless of whether any purchase orders exist for that supplier, and SHALL retain historical `purchase_orders` records with the supplier_id set to null rather than deleting them.
7. THE System SHALL support linking a product to a supplier by allowing the User to select a default_supplier_id on the product edit form.

---

### Requirement 13: Purchase Order System

**User Story:** As a shop owner, I want to create purchase orders manually or accept AI-generated ones so that I have a formal record of goods I intend to buy from suppliers.

#### Acceptance Criteria

1. THE System SHALL provide a "Purchase Orders" page accessible from the main navigation.
2. WHEN the User creates a purchase order manually, THE System SHALL require: supplier_id (selected from existing suppliers) and at least one line item containing product_id, quantity (integer ≥ 1), and unit_cost (decimal ≥ 0).
3. THE System SHALL support three order status values: `draft`, `sent`, and `received`.
4. WHEN the User marks a purchase order as `received`, THE System SHALL atomically update the order status to `received` and increase each line item's product quantity by the ordered quantity, and record an `inventory_logs` entry with `action = 'increase'` for each product; IF either the status change or the inventory update fails, THEN THE System SHALL roll back both operations.
5. THE Purchase Orders page SHALL list all purchase orders for the active shop showing: order number, supplier name, total value (sum of quantity × unit_cost), status, and created_at date.
6. WHEN the User views a purchase order detail, THE System SHALL display all line items with product name, SKU, quantity, unit cost, and line total.
7. THE System SHALL allow the User to add, edit, or remove line items while an order is in `draft` status.
8. WHEN an order is in `sent` or `received` status, THE System SHALL prevent modification of line items and supplier.
9. THE System SHALL auto-generate a human-readable order number in the format `PO-{YYYY}-{sequential_number}` (e.g. PO-2025-001) scoped per shop per year.

---

### Requirement 14: Notification Center

**User Story:** As a shop owner, I want an in-app notification hub so that I can see all alerts about stock levels, AI recommendations, and order updates in one place.

#### Acceptance Criteria

1. THE System SHALL display a notification bell icon in the top navigation bar with an unread count badge.
2. WHEN the unread count is 0, THE System SHALL hide the badge.
3. WHEN the User clicks the bell icon, THE Notification_Center SHALL open a panel listing the most recent 50 notifications for the current user and active shop, ordered by created_at descending.
4. THE Notification_Center SHALL support the following notification types: `low_stock`, `out_of_stock`, `expiry`, `ai_recommendation`, `purchase_order`, and `system`.
5. WHEN the User clicks a notification, THE System SHALL mark it as read and navigate to the relevant page (e.g. inventory page for stock alerts, purchase orders page for order alerts).
6. WHEN the User clicks "Mark all as read", THE System SHALL set `read = true` on all unread notifications for the current user and active shop.
7. THE System SHALL generate a `low_stock` notification automatically when a product's quantity falls below its `reorder_threshold` (but is still greater than 0) as a result of a sale or inventory adjustment.
8. THE System SHALL generate an `out_of_stock` notification automatically when a product's quantity reaches exactly 0. WHEN a product's `reorder_threshold` is 0 and the quantity reaches 0, THE System SHALL generate only the `out_of_stock` notification, not a `low_stock` notification.
9. WHERE expiry tracking is enabled for the shop, THE System SHALL generate an `expiry` notification for products whose `expiry_date` is within 7 days of the current date, checked once per day.
10. THE Notification_Center SHALL allow the User to delete individual notifications.

---

### Requirement 15: Feedback System

**User Story:** As a shop owner, I want to submit feedback, report bugs, and contact support from within the app so that the development team can improve the product.

#### Acceptance Criteria

1. THE System SHALL provide a "Contact Us" form with fields: name (required), email (required, valid format), and message (required, ≤ 2000 characters).
2. THE System SHALL provide a "Feedback" form with fields: rating (integer 1–5, required), feedback type (enum: 'feature_request' | 'bug' | 'general' | 'complaint', required), and description (required, ≤ 2000 characters).
3. THE System SHALL provide a "Bug Report" form with fields: description (required, ≤ 2000 characters) and an optional screenshot upload (JPEG or PNG, ≤ 5 MB) stored in Supabase Storage under the `bug-reports/` bucket path.
4. WHEN the User submits a Contact Us form, THE System SHALL insert a record into the `feedback` table with type = 'contact' and return a success confirmation message. IF the database insertion fails, THEN THE System SHALL display an error message and retain the User's form input so it is not lost.
5. WHEN the User submits a Feedback form, THE System SHALL insert a record into the `feedback` table with the rating, type, description, user_id, and created_at. IF the database insertion fails, THEN THE System SHALL display an error message and retain the User's form input so it is not lost.
6. WHEN the User submits a Bug Report form, THE System SHALL upload the screenshot (if provided) to Supabase Storage, insert a record into the `bug_reports` table with description, screenshot_url, user_id, and created_at, and return a confirmation message. IF the database insertion fails, THEN THE System SHALL display an error message and retain the User's form input so it is not lost.
7. IF a form submission fails due to a definitive network or server error, THEN THE System SHALL display the error and retain the User's input so it is not lost.
8. THE Feedback_Module forms SHALL be accessible from the Settings page and from a global "Help" menu entry.

---

### Requirement 16: Legal Pages

**User Story:** As a visitor or registered user, I want to read the app's Privacy Policy, Terms & Conditions, and Cookie Policy so that I understand my rights and how my data is used.

#### Acceptance Criteria

1. THE System SHALL provide a Privacy Policy page at route `/privacy` accessible without authentication.
2. THE System SHALL provide a Terms & Conditions page at route `/terms` accessible without authentication.
3. THE System SHALL provide a Cookie Policy page at route `/cookies` accessible without authentication.
4. THE System SHALL display a Cookie Consent Banner to any visitor who has not yet given or declined consent.
5. WHEN the User explicitly accepts cookies via the banner, THE System SHALL store a consent record in the `cookie_consents` table containing user_id (if authenticated) or a browser-local anonymous_id, consent_given = true, and accepted_at timestamp.
6. WHEN the User explicitly declines cookies via the banner, THE System SHALL store a consent record with consent_given = false and declined_at timestamp, and SHALL NOT set any non-essential cookies.
7. WHEN the User has an existing consent record (accepted or declined from an explicit action), THE System SHALL NOT display the Cookie Consent Banner again during the same browser session. THE System SHALL NOT store a consent record when no explicit user action has occurred.
8. THE Cookie Consent Banner SHALL include links to the Cookie Policy page.

---

### Requirement 17: Settings Enhancements

**User Story:** As a shop owner, I want to configure notification preferences, display language, and theme from my Settings page so that the app behaves the way I prefer.

#### Acceptance Criteria

1. THE System SHALL add a "Notification Preferences" section to the Settings page with individual toggle controls for: low stock alerts, out of stock alerts, expiry alerts, AI recommendation notifications, and purchase order status notifications.
2. WHEN the User toggles a notification preference, THE System SHALL upsert the updated preference into the `shop_settings` table for the active shop immediately.
3. THE System SHALL add a "Language" preference to the Settings page with two options: English and Hindi. THE System SHALL persist the selected language in the `shop_settings` table.
4. WHEN the User changes the language preference to Hindi, THE System SHALL switch all UI labels, navigation items, and button text to Hindi using the app's i18n translation layer.
5. THE System SHALL add a "Theme" preference to the Settings page with options: Light, Dark, and System Default. THE System SHALL persist the selected theme in the `shop_settings` table.
6. WHEN the User changes the theme preference, THE System SHALL apply the new theme to the entire application immediately without requiring a page reload.
7. WHEN the User loads the app after setting preferences, THE System SHALL restore language and theme from the `shop_settings` record for the active shop within 500 ms of the shop data loading. IF restoration takes longer than 500 ms, THE System SHALL apply default settings (English language, System Default theme) and continue loading without blocking the UI.

---

### Requirement 18: Database Enhancements

**User Story:** As a developer, I want all new Phase 2 features backed by properly structured, RLS-secured Supabase tables so that data is isolated per shop and per user.

#### Acceptance Criteria

1. THE System SHALL create a `bill_scans` table with columns: id (uuid PK), shop_id (FK → shops), user_id (FK → auth.users), storage_path (text), processing_status (text, values: 'pending' | 'completed' | 'failed'), extracted_items (jsonb), created_at (timestamptz).
2. THE System SHALL create a `voice_logs` table with columns: id (uuid PK), shop_id (FK → shops), user_id (FK → auth.users), raw_transcript (text), parsed_intent (jsonb), action_taken (text), created_at (timestamptz).
3. THE System SHALL create an `ai_predictions` table with columns: id (uuid PK), shop_id (FK → shops), product_id (FK → products, nullable), prediction_type (text, values: 'demand' | 'dead_stock' | 'seasonal'), payload (jsonb), ignored (boolean default false), created_at (timestamptz).
4. THE System SHALL create a `chat_history` table with columns: id (uuid PK), shop_id (FK → shops), user_id (FK → auth.users), role (text, values: 'user' | 'assistant'), message (text), created_at (timestamptz).
5. THE System SHALL create a `purchase_orders` table with columns: id (uuid PK), shop_id (FK → shops), supplier_id (FK → suppliers, nullable), order_number (text, unique per shop), status (text, values: 'draft' | 'sent' | 'received'), total_value (numeric(12,2)), created_at (timestamptz), updated_at (timestamptz).
6. THE System SHALL create a `purchase_order_items` table with columns: id (uuid PK), purchase_order_id (FK → purchase_orders), product_id (FK → products), quantity (integer ≥ 1), unit_cost (numeric(12,2)), line_total (numeric(12,2) generated as quantity × unit_cost).
7. THE System SHALL create a `feedback` table with columns: id (uuid PK), user_id (FK → auth.users, nullable), type (text, values: 'contact' | 'feature_request' | 'bug' | 'general' | 'complaint'), rating (integer 1–5, nullable), description (text), email (text, nullable), name (text, nullable), created_at (timestamptz).
8. THE System SHALL create a `bug_reports` table with columns: id (uuid PK), user_id (FK → auth.users), description (text), screenshot_url (text, nullable), status (text, values: 'open' | 'in_review' | 'resolved', default 'open'), created_at (timestamptz).
9. THE System SHALL create a `cookie_consents` table with columns: id (uuid PK), user_id (FK → auth.users, nullable), anonymous_id (text, nullable), consent_given (boolean), accepted_at (timestamptz, nullable), declined_at (timestamptz, nullable), created_at (timestamptz).
10. THE System SHALL create a `shop_settings` table with columns: shop_id (uuid PK, FK → shops), language (text default 'en'), theme (text default 'system'), notify_low_stock (boolean default true), notify_out_of_stock (boolean default true), notify_expiry (boolean default true), notify_ai_recommendation (boolean default true), notify_purchase_order (boolean default true), created_at (timestamptz), updated_at (timestamptz).
11. THE System SHALL add a `default_supplier_id` column (FK → suppliers, nullable) to the existing `products` table.
12. THE System SHALL add `tags` (text[] default '{}') and `search_keywords` (text[] default '{}') columns to the existing `products` table.
13. ALL new tables SHALL have Row Level Security enabled with policies that restrict data access to the owning user or shop owner, consistent with the existing RLS pattern in Phase 1.
14. THE `notifications` table SHALL add a `purchase_order` value to its `type` check constraint to support purchase order status notifications.
