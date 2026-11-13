# Assignment Bridge (MERN)

A marketplace that connects two kinds of users:

- **Tasker**: posts an assignment request (instructions, files, deadline) and pays **₹100**.
- **Worker**: browses open requests, **accepts or ignores** them, uploads the finished work, and earns **₹50** when the tasker approves it.
- **Admin**: sees every user, task and rupee. The platform keeps the remaining **₹50** per completed task.

```
Tasker pays ₹100 ──► held by platform ──► Worker finishes ──► Tasker approves
                                                              ├─► ₹50 to worker wallet
                                                              └─► ₹50 platform fee
```

## Roles and what each can do

| | Tasker | Worker | Admin |
|---|---|---|---|
| Register themselves | yes | yes | no (seeded) |
| Post requests with a required PDF attachment | yes | no | no |
| Pay via Razorpay | yes | no | no |
| See open tasks and their files/details | no | yes | yes |
| Accept / ignore / give back a task | no | yes | no |
| Upload finished work | no | yes | no |
| Approve work, request changes, rate worker | yes (own tasks) | no | no |
| Cancel a request (full refund) before it is accepted | yes (own) | no | yes (any) |
| Withdraw earnings (UPI) | no | yes | no |
| Dashboard, users, block/unblock, all tasks | no | no | yes |
| Mark worker payouts as paid / reject | no | no | yes |

Role checks are enforced on the **server** (`authorize(...)` middleware) as well as hidden in the UI.
Privacy by role: workers never see what the tasker paid or the platform's cut; taskers never see the worker's earning or the platform's cut.

## Task lifecycle

`pending_payment` → (paid) → `open` → (worker accepts) → `accepted` → (worker uploads) → `submitted` → `approved`
&nbsp;&nbsp;&nbsp;&nbsp;↳ tasker can send it to `revision` (default max 3 times) and the worker resubmits
&nbsp;&nbsp;&nbsp;&nbsp;↳ `open` or `pending_payment` tasks can be `cancelled` (paid ones are refunded)

Accepting is atomic, so two workers can never take the same task.

## Quick start

Requirements: **Node 18+** and a **MongoDB** (local, or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd server
cp .env.example .env        # then edit it (see below)
npm install
npm run seed                # creates the admin account from ADMIN_* in .env
npm run dev                 # http://localhost:5000

# 2. Frontend (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Log in as admin with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env` (defaults: `admin@example.com` / `Admin@12345`; **change them**). Register one tasker and one worker in two browsers (or one normal + one private window) to try the full flow.

### Works out of the box without any accounts (development only)

| Service | If keys are empty |
|---|---|
| Razorpay | **Demo payment mode**: a confirm dialog simulates the payment. A yellow banner is shown. Disabled automatically when `NODE_ENV=production`. |
| Cloudinary | Files are saved to `server/uploads/` and served by Express. |

### Turning on the real services

**Razorpay** (Test mode is free): Dashboard → Account & Settings → API keys. Put the values in `server/.env`:
```
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
```
Use Razorpay's test cards/UPI to try it. The server creates the order, and verifies the HMAC signature from Checkout before marking a task paid. Cancelling a paid, unaccepted task issues a full Razorpay refund.

**Cloudinary**: Console → Dashboard → API Keys:
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```
> New Cloudinary accounts block delivery of PDF and ZIP files by default. Enable it in **Settings → Security → "PDF and ZIP files delivery"**, otherwise those links return 401.

### Configuration (`server/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `TASK_PRICE` | 100 | What the tasker pays (₹) |
| `WORKER_EARNING` | 50 | Worker's share (₹). Platform fee = price − this |
| `MAX_ACTIVE_TASKS_PER_WORKER` | 5 | Concurrent accepted tasks per worker |
| `MAX_REVISIONS` | 3 | Revision rounds a tasker can request |
| `MIN_PAYOUT` | 50 | Smallest withdrawal (₹) |
| `JWT_SECRET` | dev value | **Set a long random value in production** |

Prices are snapshotted on each task when it is created, so changing them later does not affect existing tasks.

## How worker money works

Razorpay Checkout only collects money. Paying workers out automatically needs RazorpayX/Payouts, which requires separate business verification. So this app uses a safe manual-but-tracked flow:

1. Tasker approves → worker's **wallet balance** += ₹50 (and a ledger entry is written).
2. Worker opens **Earnings** → requests a withdrawal to a UPI ID. The amount is held immediately.
3. Admin opens **Payouts**, sends the money by UPI, and clicks **Mark paid** (optionally with the UTR). Or **Reject** with a reason, which returns the amount to the worker's balance.

Later you can replace step 3 with RazorpayX Payouts by calling it from `processPayout` in `server/src/controllers/adminController.js`.

## Project structure

```
server/src
  config/        env, db
  models/        User, Task, Transaction (ledger), Payout
  middleware/    auth (JWT + roles), upload (multer), error
  services/      storage (Cloudinary/local), payments (Razorpay), taskCancel (refund)
  controllers/   auth, task, wallet, admin
  routes/index.js  all endpoints
  seed.js        creates the admin
client/src
  pages/tasker | worker | admin, TaskDetail (shared, role-aware)
  components/    Layout, TaskCard, ui (dropzone, modal, badges...)
  context/       Auth, Toast
  utils/payment.js  Razorpay Checkout flow
```

### API overview (all under `/api`)

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/profile`
- Tasker: `POST /tasks` (multipart), `GET /tasks/mine`, `POST /tasks/:id/order`, `/verify-payment`, `/cancel`, `/approve`, `/revision`
- Tasker can edit unpaid or open/unassigned requests with `PUT /tasks/:id` (multipart); at least one PDF must remain attached.
- Worker: `GET /tasks/available`, `GET /tasks/assigned`, `POST /tasks/:id/accept|ignore|release|submit`, `GET /wallet`, `POST /wallet/payouts`
- Shared: `GET /tasks/:id` (visibility depends on role)
- Admin: `GET /admin/stats|users|tasks|payouts`, `PATCH /admin/users/:id/block`, `POST /admin/tasks/:id/cancel`, `PATCH /admin/payouts/:id`

## Deploying

1. Set `NODE_ENV=production`, a strong `JWT_SECRET`, real Razorpay + Cloudinary keys, `CLIENT_URL` (your site) and `MONGO_URI` (Atlas).
2. Frontend: `cd client && npm run build`, host `client/dist` anywhere static. If the API is on another domain, set `VITE_API_URL=https://api.yourdomain.com/api` before building.
3. Backend: run `node src/server.js` on any Node host. Run `npm run seed` once.

## Before you launch: read this

- **Academic integrity and payment rules.** Platforms where students pay others to complete graded coursework are restricted or illegal in some countries (several ban "contract cheating" services), many schools and universities prohibit it, and payment providers (including Razorpay) often restrict this kind of business. Check Razorpay's prohibited-business policy and local law first. Many marketplaces reduce risk by framing the service as tutoring, notes, or model answers for learning, and by publishing clear terms of use.
- **Not yet built (good next steps):** Razorpay webhook as a backup to client-side verification (covers a tasker closing the tab right after paying), email/SMS notifications, in-task chat, dispute handling for rejected work, auto-approval after N days, and MongoDB transactions for the approve-and-credit step (needs a replica set; Atlas has one).
- Uploaded files are served from unguessable URLs but are not access-controlled. For stricter privacy use Cloudinary "authenticated" delivery with signed URLs.
