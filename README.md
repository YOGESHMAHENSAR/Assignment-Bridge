# Assignment Bridge (MERN)

A marketplace that connects two kinds of users:

- **Tasker**: posts an assignment request (instructions, files, deadline) and pays **₹100**.
- **Worker**: browses open requests, **accepts or ignores** them, uploads the finished work, and earns **₹50** when the tasker approves it.
- Requests are matched to workers within **2 km** of the worker's registered campus location. Both account and task locations use a campus name and coordinates.
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
| See open tasks and their files/details | no | within 2 km of registered campus | yes |
| Accept / ignore / give back a task | no | yes | no |
| Chat with the other participant | after a worker accepts | after accepting a task | no |
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
Task chat starts after acceptance, remains available through submissions and revisions, and becomes read-only when the task is approved or otherwise closed.

Prices are snapshotted on each task when it is created, so changing them later does not affect existing tasks.

## How worker money works

Razorpay Checkout only collects money. Paying workers out automatically needs RazorpayX/Payouts, which requires separate business verification. So this app uses a safe manual-but-tracked flow:

1. Tasker approves → worker's **wallet balance** += ₹50 (and a ledger entry is written).
2. Worker opens **Earnings** → requests a withdrawal to a UPI ID. The amount is held immediately.
3. Admin opens **Payouts**, sends the money by UPI, and clicks **Mark paid** (optionally with the UTR). Or **Reject** with a reason, which returns the amount to the worker's balance.
