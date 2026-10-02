# Security Specification - Khata Book & Kirana Store

## 1. Data Invariants
- Users must have a profile in the `/users` collection with a role (shopkeeper, customer, or admin).
- Customers/Suppliers must have an `ownerId` representing the shopkeeper who created them.
- Transactions must belong to an `ownerId` and be linked to a customer/supplier via `customerId` and `customerMobile` (or `supplierId`/`supplierMobile`).
- Only shopkeepers/admins can create customers/suppliers and their transactions (except for customer 'jama' entries).
- Customer specific 'jama' (payment) can be created by the customer themselves if authenticated and mobile matches.
- All timestamps must be server-generated (`request.time`).
- Mobile numbers must be normalized (10 digits).

## 2. The "Dirty Dozen" Payloads (Red Team Tests)
1. **Identity Theft (User Profile)**: Creating a user profile for a different UID.
2. **Role Escalation**: A customer trying to update their role to 'admin' or 'shopkeeper'.
3. **Ghost Transaction**: Creating a transaction for a different shopkeeper's customer (`ownerId` mismatch).
4. **Negative Payment**: Creating a 'jama' entry with a negative amount.
5. **Unauthorized Supplier Access**: Reading a supplier's ledger that belongs to another shopkeeper.
6. **Mobile Spoofing**: A customer trying to create a 'jama' transaction for a different mobile number.
7. **Terminal State Break**: Trying to edit a 'jama' transaction after it was created (immutability test).
8. **Resource Poisoning**: Sending a 1MB string in the `remark` field.
9. **Old System Bypass**: Trying to read old transactions by guessing IDs without being owner.
10. **Public User Leak**: Reading the entire `/users` collection without being admin.
11. **Shadow Update**: Adding a field `isVerified: true` to a customer profile.
12. **Timestamp Fraud**: Providing a fake `createdAt` date from the client.

## 3. Test Runner (Conceptual)
All the above payloads MUST return `PERMISSION_DENIED` in the Firestore Security Rules.
