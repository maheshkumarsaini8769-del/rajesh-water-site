Implement the following complete order flow. Do not change unrelated website functionality.

## Customer Order Flow

When a customer adds products to the cart:

### Step 1 — Cart

Customer opens the cart and sees:

* Product image
* Product name
* Quantity
* Box/bottle quantity
* Price
* Total amount
* Remove button
* Increase/decrease quantity

Add a clear **Proceed to Order** button.

Do NOT open WhatsApp at this stage.

---

## Step 2 — Customer Details

When the customer clicks **Proceed to Order**, open a checkout form.

Ask for:

* Full name
* Mobile number
* Full address
* City
* Pincode
* Optional delivery note

Then show the order summary:

* Products
* Quantity
* Total amount

Add:

**Verify Mobile & Place Order**

button.

---

## Step 3 — Truecaller Verification

Before submitting the order, verify the customer's mobile number using the existing Truecaller verification integration if it is already configured.

Important:

* Do not claim verification succeeded unless the actual verification response confirms it.
* If verification fails, do not create the order.
* Show a clear error message.
* If verification succeeds, continue automatically to order submission.

Do NOT redirect the customer to WhatsApp.

---

## Step 4 — Create Pending Order

After successful verification, create the order with status:

**PENDING**

Save:

* Unique order ID
* Date/time
* Customer name
* Verified mobile number
* Address
* City
* Pincode
* Products
* Quantity
* Box/bottle quantity
* Total amount
* Payment method/status
* Verification status
* Order status

The order must be stored persistently using the existing backend/storage system.

Do NOT rely only on temporary browser state for real orders.

---

# OWNER / ADMIN PANEL

After the customer submits an order, it must appear automatically in the owner's Admin Panel.

Create a prominent:

## Pending Orders

section.

Example:

**New Order #ORD-1024**

Customer: Mahesh
Phone: Verified
Items: Dew 1L × 3 Boxes
Total: ₹1,500
Address: Sikar
Status: PENDING

Buttons:

**View Details**

**Call Customer**

**Confirm Order**

**Reject Order**

---

## Step 5 — Owner Calls Customer

The owner should NOT automatically call the customer.

Add a **Call Customer** button.

When clicked, open the phone dialer using the customer's verified phone number.

Example behavior:

`tel:+91XXXXXXXXXX`

The owner talks to the customer and confirms:

* Product availability
* Quantity
* Price
* Address
* Delivery details
* Payment method
* Any other required information

---

# Step 6 — Confirm Order

After the owner confirms the order on the phone, owner clicks:

**Confirm Order**

Show a confirmation dialog:

> Confirm this order?
>
> The order will move from Pending Orders to Confirmed Orders.

Buttons:

**Cancel**

**Confirm Order**

After confirmation:

Order status becomes:

**CONFIRMED**

Save confirmation date/time.

Move it from the Pending Orders list to the Confirmed Orders section.

---

# Step 7 — Complete Order

After the order has actually been delivered/completed, the owner goes to the order in the Admin Panel and clicks:

**Mark as Completed**

Show confirmation:

> Mark this order as completed?

After confirmation:

Status becomes:

**COMPLETED**

Save:

* Completed date/time
* Final amount
* Final quantity
* Payment status

Only when the order is completed should the sale be counted as a completed sale in business reports.

---

# IMPORTANT SALES / INVENTORY RULE

Do NOT treat every pending order as a completed sale.

Use these statuses:

**PENDING → CONFIRMED → COMPLETED**

Possible cancellation:

**PENDING → REJECTED/CANCELLED**

Only **COMPLETED** orders should contribute to:

* Total sales
* Online sales
* Profit
* Completed order count
* Sales reports

If stock is reserved when an order is confirmed, handle that separately from completed sales.

Do not double-deduct inventory.

---

# Rejected / Cancelled Orders

If the owner decides not to accept an order:

Click:

**Reject Order**

Ask for optional reason:

* Out of stock
* Customer unavailable
* Wrong address
* Price issue
* Customer cancelled
* Other

Then change status to:

**CANCELLED**

or

**REJECTED**

Remove it from the active Pending Orders list.

Do not permanently destroy the transaction data immediately.

Instead move it to:

**Cancelled Orders / Archive**

so the owner can see the history later.

Provide an optional permanent delete function only for the owner/admin.

---

# ADMIN ORDER SECTIONS

Create these sections:

### 1. Pending Orders

Orders waiting for owner confirmation.

### 2. Confirmed Orders

Orders confirmed by owner but not completed.

### 3. Completed Orders

Orders successfully completed.

### 4. Cancelled Orders

Rejected/cancelled orders.

Each section should show a count.

Example:

Pending: 4
Confirmed: 7
Completed: 128
Cancelled: 12

---

# ORDER STATUS BADGES

Use clear status badges:

🟡 PENDING

🔵 CONFIRMED

🟢 COMPLETED

🔴 CANCELLED

The colors should match the existing premium admin theme.

---

# ORDER DETAILS

Clicking an order should open a detailed order view containing:

* Order ID
* Customer name
* Verified phone
* Address
* Products
* Quantity
* Box/bottle count
* Price
* Total
* Order date/time
* Verification status
* Payment status
* Current order status
* Owner notes
* Confirmation time
* Completion time

Add an internal:

**Owner Notes**

field so the owner can write things such as:

> Customer confirmed delivery tomorrow morning.

---

# DASHBOARD INTEGRATION

Add order statistics to the main dashboard:

* New Pending Orders
* Confirmed Orders
* Completed Today
* Cancelled Today
* Today's Completed Sales
* Today's Completed Order Count

If a new pending order arrives, show a notification:

> 🔔 New Order Received
> Order #ORD-1024 from customer.
> ₹1,500 — 3 boxes

Clicking the notification should open the order.

---

# NO WHATSAPP REDIRECT

This is mandatory:

After the customer verifies their mobile number and submits the order:

**DO NOT automatically open WhatsApp.**

The order must go directly into the owner's Admin Panel as a **Pending Order**.

WhatsApp can remain as an optional separate contact button, but it must NOT be part of the automatic checkout flow.

---

# MOBILE EXPERIENCE

Customer checkout must work perfectly on mobile.

Owner Admin Panel must also work on mobile.

The owner should be able to:

* See new orders
* Open order details
* Call customer
* Confirm order
* Mark completed
* Reject order

without needing a desktop.

---

# SECURITY

Customer phone numbers and order details are sensitive.

Do not expose the complete order list publicly.

Only authenticated admin/owner users should access orders.

Do not put admin order data directly into publicly accessible frontend code.

Use the existing backend/authentication system where available.

---

# FINAL FLOW

The final working flow must be exactly:

**Customer**

Add to Cart
↓
Proceed to Order
↓
Enter Details
↓
Truecaller Mobile Verification
↓
Verification Successful
↓
Create Order
↓
Show “Order Received — Waiting for Confirmation”
↓
Customer does NOT open WhatsApp

**Owner**

Admin Panel
↓
New Pending Order
↓
View Order
↓
Call Customer
↓
Confirm Order
↓
Order becomes CONFIRMED
↓
Deliver Order
↓
Mark as COMPLETED
↓
Order becomes COMPLETED
↓
Sales + Profit + Inventory reports update correctly

If owner rejects:

**PENDING → CANCELLED → Cancelled Orders Archive**

Implement this as a real working order-state system, not just a visual UI. Make sure refreshing the page does not lose orders and that the same order cannot accidentally be confirmed or completed twice.
