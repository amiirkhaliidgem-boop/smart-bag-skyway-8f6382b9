# Passenger Portal — Wording Update Only

Text-only edits in `src/routes/passenger.index.tsx`. No layout, component, styling, workflow, API or database changes.

## 1. Home Delivery status/timeline wording (Arabic only)

- "تم التعيين للتسليم" -> "حقائبك جاهزة للتسليم" (hero copy, line 627; timeline step, line 721)
- "في الطريق إليك" -> "حقائبك في الطريق إليك" (hero copy, line 623; timeline step, line 722)

English labels stay as they are.

## 2. OTP confirmation card

- Arabic: "أؤكد أن الأمتعة مختومة وبحالة جيدة." -> "أؤكد أن الأمتعة مغلقة وبحالة جيدة."
- English: "I will provide the OTP only after receiving my baggage." -> "I provided the OTP after receiving my baggage."
- Arabic: "لن أشارك رمز التحقق إلا بعد استلام الأمتعة." -> "قد شاركت رمز التحقق بعد استلام الأمتعة."

## 3. Airport Pickup information card

Replace the card's text content only (same card, same styling, same list markup):

English — "Collecting your baggage"
- Visit the Airport Lost & Found Office at the Airport.
- Bring your valid passport.
- Represent yourself in person.
- Bring your PIR reference number if available.

Arabic — "استلام الأمتعة"
- يرجى التوجه إلى مكتب المفقودات بالمطار.
- يجب حضور صاحب العلاقة شخصيًا.
- يرجى إحضار جواز سفر ساري.
- ويرجى إحضار رقم تقرير PIR إن وجد.

The Arabic block keeps the existing single RTL paragraph styling, rendered as the four lines above (one line each) so nothing about the card structure changes beyond the wording.

## Verification

Open one Home Delivery and one Airport Pickup passenger link and confirm the new wording renders in both languages; no other behaviour touched.
