# E-posta Fatura Bilgileri Taslağı

Tüm fatura e-postalarına ortak bir **Fatura Özeti** bloğu eklenecek. Red edildiyse **Red Sebebi** de gösterilecek.

---

## Ortak Fatura Özeti Bloğu (HTML)

Her e-postada aşağıdaki tablo yer alacak. Guest ve Freelancer için alanlar farklı olacak.

### Guest Fatura Özeti

| Alan | Kaynak | Örnek |
|------|--------|-------|
| Ad | service_description (parsed: guest name) | John Doe |
| Title | service_description (parsed: title) | Breaking News |
| Topic | service_description (parsed: topic) | Politics |
| TX Date | service_description (parsed: tx date, 2. tx date, 3. tx date) | 15/02/2024 |
| Bölüm | departments.name | News |
| Program | programs.name | Daily News |
| Fatura Tutarı | invoice_extracted_fields.gross_amount | £1,250.00 |
| Producer | service_description (parsed: producer) | Jane Smith |

### Freelancer Fatura Özeti

| Alan | Kaynak | Örnek |
|------|--------|-------|
| Fatura Tipi | invoice_type | Freelancer |
| Fatura No | invoice_extracted_fields.invoice_number | INV-2024-002 |
| Bölüm | departments.name | Operations |
| Yüklenici | freelancer_invoice_fields.contractor_name | Jane Smith |
| Şirket | freelancer_invoice_fields.company_name | ABC Ltd |
| Hizmet Açıklaması | freelancer_invoice_fields.service_description | Camera operator |
| Ay | freelancer_invoice_fields.service_month | February 2024 |
| Gün Sayısı | freelancer_invoice_fields.service_days_count | 5 |
| Günlük Ücret | freelancer_invoice_fields.service_rate_per_day | £350 |
| Ek Maliyet | freelancer_invoice_fields.additional_cost | £50 |
| Toplam Tutar | (gün × ücret) + ek maliyet | £1,800.00 |
| Alıcı | invoice_extracted_fields.beneficiary_name | Jane Smith |
| Hesap No | invoice_extracted_fields.account_number | 87654321 |
| Sort Code | invoice_extracted_fields.sort_code | 65-43-21 |

---

## E-posta Örnekleri (Taslak)

### 1. Invoice Submitted (Yeni fatura gönderildi)

```
Konu: #INV-2024-001 — Submitted for review

Başlık: Invoice Submitted

Metin: A new invoice has been submitted and is awaiting manager review.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ (Guest)                                   │
├─────────────────────────────────────────────────────────┤
│ Ad:           John Doe                                  │
│ Title:        Breaking News                             │
│ Topic:        Politics                                  │
│ TX Date:      15/02/2024                                │
│ Bölüm:        News                                      │
│ Program:      Daily News                                │
│ Fatura Tutarı: £1,250.00                                │
│ Producer:     Jane Smith                                │
└─────────────────────────────────────────────────────────┘

Status: [Pending Manager]
[View Invoice]
```

---

### 2. Manager Approved (Onaylandı)

```
Konu: #INV-2024-001 — Approved by John Manager

Başlık: Invoice Approved

Metin: Great news! The invoice has been approved by John Manager 
and is now pending admin review.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ                                            │
│ (Guest veya Freelancer alanları)                        │
└─────────────────────────────────────────────────────────┘

Status: [Approved by John Manager]
[View Invoice]
```

---

### 3. Manager Rejected (Reddedildi) — Red sebebi dahil

```
Konu: #INV-2024-001 — Rejected

Başlık: Invoice Rejected

Metin: Your invoice has been rejected by John Manager.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ (Guest)                                   │
├─────────────────────────────────────────────────────────┤
│ Ad:           John Doe                                  │
│ Title:        Breaking News                             │
│ Topic:        Politics                                  │
│ TX Date:      15/02/2024                                │
│ Bölüm:        News                                      │
│ Program:      Daily News                                │
│ Fatura Tutarı: £1,250.00                                │
│ Producer:     Jane Smith                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ RED SEBEBİ                                              │
│ Bank details do not match the invoice. Please verify     │
│ account number and sort code.                            │
└─────────────────────────────────────────────────────────┘

Status: [Rejected]
[View & Resubmit]
```

---

### 4. Ready for Payment

```
Konu: #INV-2024-001 — Ready for payment

Başlık: Ready for Payment

Metin: The invoice has been fully approved and is now ready 
for payment processing.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ                                            │
└─────────────────────────────────────────────────────────┘

Status: [Ready for Payment]
[Process Payment]
```

---

### 5. Paid (Ödendi)

```
Konu: #INV-2024-001 — Payment completed

Başlık: Payment Completed

Metin: The invoice has been paid successfully.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ                                            │
└─────────────────────────────────────────────────────────┘

Payment Ref: TXN-2024-5678

Status: [Paid]
[View Invoice]
```

---

### 6. Resubmitted (Tekrar gönderildi)

```
Konu: #INV-2024-001 — Resubmitted after correction

Başlık: Invoice Resubmitted

Metin: A previously rejected invoice has been corrected and 
resubmitted by Jane Doe for your review.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ                                            │
└─────────────────────────────────────────────────────────┘

Status: [Pending Manager]
[Review Invoice]
```

---

### 7. Manager Assigned

```
Konu: #INV-2024-001 — Assigned to you for review

Başlık: Invoice Assigned to You

Metin: You have been assigned by Admin Name to review this invoice.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ                                            │
└─────────────────────────────────────────────────────────┘

Status: [Pending Manager]
[Review Invoice]
```

---

### 8. Admin Approved (Ready for payment)

```
Konu: #INV-2024-001 — Admin approved, ready for payment

Başlık: Admin Approved

Metin: The invoice has been approved by admin (Admin Name) 
and is now ready for payment.

┌─────────────────────────────────────────────────────────┐
│ FATURA ÖZETİ                                            │
└─────────────────────────────────────────────────────────┘

Status: [Ready for Payment]
[Process Payment]
```

---

## Teknik Uygulama Özeti

1. **Yeni tip**: `InvoiceDetails` – guest veya freelancer için fatura özeti
2. **Yeni fonksiyon**: `buildInvoiceDetailsHtml(details)` – ortak HTML tablo üretir
3. **Tüm email fonksiyonları** `invoiceDetails` parametresi alacak
4. **Red e-postaları** `rejectionReason` zaten var; fatura özeti eklenecek
5. **Status route** ve diğer çağıranlar, e-posta göndermeden önce fatura detaylarını yükleyip geçecek

---

## Onay

Bu taslak sizin için uygun mu? "Tamam" derseniz uygulamaya geçeceğim.
