# FailIQ — Example RCA Output

> Generated from: `sample_logs/ecommerce_checkout_failure.log`  
> Service: `checkout-service` · Branch: `main` · Duration: 183.42s  
> Historical context chunks used: 0 (empty knowledge base)

---

## 1. Failure Summary

**48 tests total — 42 passed, 6 failed**

| # | Test | File | Assertion |
|---|---|---|---|
| 1 | `test_checkout_applies_discount_code` | `test_checkout.py:142` | `assert 85.00 == 90.00` |
| 2 | `test_checkout_expired_discount_code_rejected` | `test_checkout.py:178` | `assert 200 == 400` |
| 3 | `test_checkout_stack_multiple_discounts` | `test_checkout.py:215` | `assert 72.00 == 81.00` |
| 4 | `test_payment_gateway_timeout_retries` | `test_payment.py:89` | `assert 0 == 3` (retry count) |
| 5 | `test_payment_idempotency_key_prevents_double_charge` | `test_payment.py:134` | `assert 2 == 1` (charge count) |
| 6 | `test_inventory_reserve_on_checkout` | `test_inventory.py:67` | `assert 0 == 1` (reserved qty) |

---

## 2. Failure Clusters & Root Causes

### Cluster 1 — Discount Engine Regression
**Tests:** 1, 2, 3

**Assertions:**
- `assert 85.00 == 90.00` — SAVE10 applied 15% instead of 10%
- `assert 200 == 400` — expired discount code accepted instead of rejected
- `assert 72.00 == 81.00` — stacked discounts applied 28% instead of 19%

**Root cause:** All three failures point to a regression in the discount calculation engine. The percentage applied is consistently wrong (15% instead of 10%), expired codes are not being validated, and stacking logic compounds the error. Likely a recent change to `discount_service.py` or the discount rule configuration introduced a multiplier bug or removed expiry validation.

**Suggested fix:**
- Review recent commits to `discount_service.py` and discount rule config
- Check if a percentage field was changed from decimal (0.10) to integer (10) format
- Verify expiry date comparison uses UTC timestamps consistently
- Add unit tests for boundary cases: expired codes, stacking limits, rounding

---

### Cluster 2 — Payment Gateway Reliability
**Tests:** 4, 5

**Assertions:**
- `assert 0 == 3` — payment gateway timeout triggered 0 retries instead of 3
- `assert 2 == 1` — idempotency key not respected, customer charged twice

**Root cause:** Two distinct but related payment reliability failures. The retry logic is not executing on timeout (retry count = 0), and the idempotency key check is not preventing duplicate charges. Both suggest the payment gateway client was recently refactored — the retry decorator may have been removed or the idempotency header is no longer being sent.

**Suggested fix:**
- Verify the retry decorator/middleware is still applied to the payment gateway client
- Check that the `Idempotency-Key` header is included in all charge requests
- Add integration test with a mock gateway that simulates timeouts

---

### Cluster 3 — Inventory Reservation Race Condition
**Tests:** 6

**Assertion:** `assert 0 == 1` — SKU-98765 not reserved after checkout initiated

**Root cause:** The inventory reservation step is not executing or is failing silently during checkout. With Redis unavailable (falling back to in-memory cache), the reservation may not be persisting correctly across service boundaries. This could be a race condition or a missing await on an async reservation call.

**Suggested fix:**
- Check if inventory reservation is async and whether it's being awaited
- Verify the in-memory cache fallback correctly shares state within the test process
- Fix the Redis connection issue in CI (see Setup Issues below)

---

## 3. Failure Categories

| Cluster | Category |
|---|---|
| Discount Engine Regression | **Product Bug** |
| Payment Gateway Reliability | **Product Bug** |
| Inventory Reservation | **Product Bug** (possibly exacerbated by Infra Issue) |

---

## 4. Setup / Environment Issues (Non-blocking)

| Error | Root Cause | Blocking? |
|---|---|---|
| `Connection refused: redis:6379` | Redis container not running in CI | ❌ Non-blocking (fell back to in-memory cache) |

> **Note:** The Redis fallback may be masking the inventory reservation failure. Fixing Redis in CI should be prioritized to get a clean signal on Cluster 3.

---

## 5. Suggested Fixes

**Immediate (today):**
1. Revert or fix the discount service change — check git log for `discount_service.py` in the last 48 hours
2. Restore the retry decorator on the payment gateway client
3. Verify idempotency key is sent in all payment requests

**Short-term (this sprint):**
1. Fix Redis in CI — add a `redis` service to the GitLab CI job definition
2. Add explicit test for discount percentage precision (decimal vs integer)
3. Add idempotency key integration test with mock payment gateway

---

## 6. Confidence Score

**4 / 5** — Failure clusters are clear and well-separated. The inventory issue has a potential confounding factor (Redis unavailable) that reduces certainty. Confidence would increase to 5/5 with Redis running in CI.
