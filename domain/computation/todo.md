## 1️⃣ Future improvement

If your department grows large (10k+ students), you can add an **automatic memory guard**:

```
maxOperationsPerTransaction = 20000
```

When exceeded:

```
flush + start new transaction
```

This prevents MongoDB transaction limits from ever being reached.

Think of it as a **pressure valve** for the computation engine. 🧠⚡

---

## 2 Termination Logic

Termination logic should no longer exist within the computation, it should occour only after closure of the registration portal for a semester. Currently in computation until the portal would start using real registration data


When the suspension moves from the student model to its own seprate model, consider addind suspensions to the bulkwriter and flush it seperately during the bulk write