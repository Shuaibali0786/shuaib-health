# Voice receptionist "Ayesha": self-test as a patient (2026-11-09, afternoon)

Branch `013-voice-receptionist` · PR #39 · production build, mock API and fake schedule only: **never production, never a Neon database**.

## How it was tested
In a real browser (Chromium, Playwright, desktop project) with a scripted Web Speech API: the owner's 6 conversations (#19–#24) plus #4 (email by voice, re-checked). Spec: `frontend/tests/e2e/voice-selftest.spec.ts`.

Checks on every conversation: it reaches the slip, the right department, no sentence twice in a row, at most one apology, **never "afsos"**, chat in English letters only, English slip, never stuck, no console errors, and **a clean panel after every turn** (the status pill, caption, "You said" and every card, choice or box stay clear of the mic and End buttons; the caption is at most two lines). #24 is also checked at **390 px and 1366 px**.

## Rounds
| Round | Result | What it found / what was fixed |
|---|---|---|
| 1 | 7 / 7 pass | All automatic checks passed. **Then I read every transcript myself** and found two tone problems the checks did not catch: (a) #22, after "no" to the email read-back: "Done, I've updated your email. No problem. Please type…" (a doubled, odd line); (b) #24, after "naam galat hai" and the new name: "Aap se mil kar khushi hui, Saima." again, as if she were new. **Fixed:** "no" at the email check now just asks to type it; a corrected name or number is confirmed as a change ("Theek hai, Saima Nawaz." / "Theek hai, 0300 765 4321."). Regression tests added. |
| 2 (final code) | **7 / 7 pass** | Transcripts below are from this run. |

Panel screenshots: `docs/reports/voice-panel-2026-11-09/` (`voice-panel-390-slip.png`, `voice-panel-1366-slip.png`, and the end of each conversation at 1280 px).

## Not verified
- A real microphone, real voices and room echo (the tests use a scripted speech API). How Chrome really writes spoken emails ("Sohail gmail dot com" may come as "sohail gmail.com" or "sohail@gmail.com"): all of these forms are handled in unit tests, but please try it on your phone.
- Mobile browser project for the self-test (desktop only, to stay within the PC's memory); the panel was checked at 390 px in the same run.

## Results table and full transcripts (browser, final code)

| # | Conversation | By | Result | Checks |
|---|---|---|---|---|
| 4 | Teeth cleaning by voice -> Dental -> slip | voice | PASS | apologies: 0; chat in English letters only; not stuck; slip opened, English only; no console errors |
| 19 | English, fever by voice -> General Medicine -> slip | voice | PASS | apologies: 0; no 'afsos'; panel clean after every turn; chat in English letters only; not stuck; slip opened, English only; no console errors |
| 20 | Roman Urdu, daant ka dard by voice -> Dental -> slip | voice | PASS | apologies: 0; no 'afsos'; panel clean after every turn; chat in English letters only; not stuck; slip opened, English only; no console errors |
| 21 | Small talk first (salam, how are you, thanks, Allah Hafiz), then a booking | voice | PASS | apologies: 0; no 'afsos'; panel clean after every turn; chat in English letters only; not stuck; slip opened, English only; no console errors |
| 22 | Email by voice: 'Sohail gmail dot com' read back letter by letter, 'no', then typed in the email box | voice | PASS | apologies: 0; no 'afsos'; panel clean after every turn; chat in English letters only; not stuck; slip opened, English only; no console errors |
| 23 | 'ok hain sab kuch' confirms the card | voice | PASS | apologies: 0; no 'afsos'; panel clean after every turn; chat in English letters only; not stuck; slip opened, English only; no console errors |
| 24 | Mid-way correction: name and number changed at the card, then 'jee' | voice | PASS | apologies: 0; no 'afsos'; panel clean after every turn; panel clean at 390 and 1366 px; chat in English letters only; not stuck; slip opened, English only; no console errors |

### #4 Teeth cleaning by voice -> Dental -> slip — PASS

- **Patient** (voice): Daant ki safai karwani hai
- **Ayesha**: Is ke liye hamara Dental department sahi rahega: Dr. Bilal Ansari (fee PKR 2,000). Yeh sirf rehnumai hai, diagnosis nahi. Kya main aap ki booking kar doon?
- **Patient** (voice): kar do
- **Ayesha**: Ji zaroor! Kaun sa din theek rahega? Dr. Bilal Ansari ke khali waqt Tuesday 6 October, Thursday 8 October aur Saturday 10 October ko hain.
- **Patient** (voice): Thursday 8 October
- **Ayesha**: Thursday 8 October ko mere paas 5:00 PM, 6:15 PM, 7:30 PM aur 8:45 PM hain. Kaun sa waqt theek rahega?
- **Patient** (voice): 5:00 PM
- **Ayesha**: Aap ka poora naam kya hai?
- **Patient** (voice): Ayesha Siddiqui
- **Ayesha**: Aap se mil kar khushi hui, Ayesha. Aap ka mobile number kya hai? Aahista aahista digits bata dein. Aap number bol sakte hain ya neeche likh bhi sakte hain.
- **Patient** (voice): 0333 4567890
- **Ayesha**: Kya aap email dena chahenge? Yeh zaroori nahi, aap skip bhi keh sakte hain.
- **Patient** (voice): ayesha at gmail dot com
- **Ayesha**: Aap ki email a-y-e-s-h-a at gmail dot com, sahi hai?
- **Patient** (voice): ji sahi hai
- **Ayesha**: Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): haan
- **Ayesha**: Aap ki booking ho gayi, Ayesha! Dr. Bilal Ansari, Thursday 8 October 5:00 PM. Aap ka reference SHER 5R73 E3 hai. Open my slip dabaiye. Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…

### #19 English, fever by voice -> General Medicine -> slip — PASS

- **Patient** (voice): I have a fever since yesterday
- **Ayesha**: Don't worry, I'll help you right away. For this, our General Medicine department is the right place: Dr. Hassan Mirza (fee PKR 2,000) and Dr. Omar Sheikh (fee PKR 1,800). This is guidance only, not a diagnosis. Shall I book an appointment for you?
- **Patient** (voice): yes please
- **Ayesha**: Of course! General Medicine has Dr. Hassan Mirza and Dr. Omar Sheikh. Which doctor would you like?
- **Patient** (voice): Dr. Hassan Mirza
- **Ayesha**: With Dr. Hassan Mirza. Which day suits you? Dr. Hassan Mirza has free times on Monday 5 October, Wednesday 7 October and Friday 9 October.
- **Patient** (voice): Monday 5 October
- **Ayesha**: On Monday 5 October I have 11:00 AM, 11:30 AM, 12:15 PM and 12:45 PM. Which time suits you?
- **Patient** (voice): 11:00 AM
- **Ayesha**: May I have your full name, please?
- **Patient** (voice): my name is John Matthews
- **Ayesha**: Nice to meet you, John. What is your mobile number? Please say the digits slowly. You can say the number or type it below.
- **Patient** (voice): zero three zero zero one two three four five six seven
- **Ayesha**: Would you like to add an email? It's optional, you can also say skip.
- **Patient** (voice): skip
- **Ayesha**: Thank you! I'm making your booking now. Please check the card, then say yes or tap Confirm.
- **Patient** (voice): yes
- **Ayesha**: You're booked, John! Dr. Hassan Mirza, Monday 5 October at 11:00 AM. Your reference is PMY2 YPD8 2B. Tap Open my slip, download the slip, save it on your phone, and bring it with you to the clinic.
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…

### #20 Roman Urdu, daant ka dard by voice -> Dental -> slip — PASS

- **Patient** (voice): mere daant mein bohat dard hai
- **Ayesha**: Aap fikar na karein, hum aap ka achhi tarah khayal rakhenge. Is ke liye hamara Dental department sahi rahega: Dr. Bilal Ansari (fee PKR 2,000). Yeh sirf rehnumai hai, diagnosis nahi. Kya main aap ki booking kar doon?
- **Patient** (voice): ji kar dein
- **Ayesha**: Ji zaroor! Kaun sa din theek rahega? Dr. Bilal Ansari ke khali waqt Tuesday 6 October, Thursday 8 October aur Saturday 10 October ko hain.
- **Patient** (voice): Tuesday 6 October
- **Ayesha**: Tuesday 6 October ko mere paas 9:00 AM, 10:15 AM, 11:30 AM aur 12:45 PM hain. Kaun sa waqt theek rahega?
- **Patient** (voice): 9:00 AM
- **Ayesha**: Aap ka poora naam kya hai?
- **Patient** (voice): mera naam Hina Pervaiz hai
- **Ayesha**: Aap se mil kar khushi hui, Hina. Aap ka mobile number kya hai? Aahista aahista digits bata dein. Aap number bol sakte hain ya neeche likh bhi sakte hain.
- **Patient** (voice): zero three four five one two three four five six seven
- **Ayesha**: Kya aap email dena chahenge? Yeh zaroori nahi, aap skip bhi keh sakte hain.
- **Patient** (voice): nahi
- **Ayesha**: Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): haan
- **Ayesha**: Aap ki booking ho gayi, Hina! Dr. Bilal Ansari, Tuesday 6 October 9:00 AM. Aap ka reference FHSA EWPX 7F hai. Open my slip dabaiye. Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…

### #21 Small talk first (salam, how are you, thanks, Allah Hafiz), then a booking — PASS

- **Patient** (voice): Assalam o Alaikum
- **Ayesha**: Wa alaikum assalam! Bataiye, main aap ki kya madad kar sakti hoon?
- **Patient** (voice): main theek hoon aap kaisi hain
- **Ayesha**: Sun kar khushi hui! Main bhi bilkul theek hoon, shukriya! Aap sunaiye, main aap ki kya madad karoon?
- **Patient** (voice): mujhe skin pe kharish hai
- **Ayesha**: Ji, fikar na karein, main abhi aap ki madad karti hoon. Is ke liye hamara Dermatology department sahi rahega: Dr. Maryam Baloch (fee PKR 3,000). Yeh sirf rehnumai hai, diagnosis nahi. Kya main aap ki booking kar doon?
- **Patient** (voice): ji
- **Ayesha**: Ji zaroor! Kaun sa din theek rahega? Dr. Maryam Baloch ke khali waqt Monday 5 October, Wednesday 7 October aur Friday 9 October ko hain.
- **Patient** (voice): Monday 5 October
- **Ayesha**: Monday 5 October ko mere paas 12:00 PM, 1:30 PM, 3:15 PM aur 4:45 PM hain. Kaun sa waqt theek rahega?
- **Patient** (voice): 12:00 PM
- **Ayesha**: Aap ka poora naam kya hai?
- **Patient** (voice): Zara Ali
- **Ayesha**: Aap se mil kar khushi hui, Zara. Aap ka mobile number kya hai? Aahista aahista digits bata dein. Aap number bol sakte hain ya neeche likh bhi sakte hain.
- **Patient** (voice): zero three zero zero one two three four five six seven
- **Ayesha**: Kya aap email dena chahenge? Yeh zaroori nahi, aap skip bhi keh sakte hain.
- **Patient** (voice): skip
- **Ayesha**: Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): theek hai
- **Ayesha**: Aap ki booking ho gayi, Zara! Dr. Maryam Baloch, Monday 5 October 12:00 PM. Aap ka reference 48GV BA2N RQ hai. Open my slip dabaiye. Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.
- **Patient** (voice): shukriya Ayesha
- **Ayesha**: Koi baat nahi, khushi hui! Kuch aur madad chahiye to zaroor bataiye.
- **Patient** (voice): Allah Hafiz
- **Ayesha**: Bohat shukriya! Apna khayal rakhiye, Allah Hafiz!
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…

### #22 Email by voice: 'Sohail gmail dot com' read back letter by letter, 'no', then typed in the email box — PASS

- **Patient** (voice): I would like to book an appointment with a dentist
- **Ayesha**: Of course! Dental, with Dr. Bilal Ansari (fee PKR 2,000). Which day suits you? Dr. Bilal Ansari has free times on Tuesday 6 October, Thursday 8 October and Saturday 10 October.
- **Patient** (voice): Tuesday 6 October
- **Ayesha**: On Tuesday 6 October I have 9:15 AM, 10:30 AM, 11:30 AM and 12:45 PM. Which time suits you?
- **Patient** (voice): 9:15 AM
- **Ayesha**: May I have your full name, please?
- **Patient** (voice): my name is Sohail Khan
- **Ayesha**: Nice to meet you, Sohail. What is your mobile number? Please say the digits slowly. You can say the number or type it below.
- **Patient** (voice): zero three two one seven six five four three two one
- **Ayesha**: Would you like to add an email? It's optional, you can also say skip.
- **Patient** (voice): Sohail gmail dot com
- **Ayesha**: I have your email as s-o-h-a-i-l at gmail dot com. Is that right?
- **Patient** (voice): no
- **Ayesha**: No problem. Please type your email in the box below, or say skip.
- **Patient** (typed): (types "sohail.khan@gmail.com" in the email box)
- **Ayesha**: Thank you! I'm making your booking now. Please check the card, then say yes or tap Confirm.
- **Patient** (voice): correct
- **Ayesha**: You're booked, Sohail! Dr. Bilal Ansari, Tuesday 6 October at 9:15 AM. Your reference is YQ5Z K7X6 2B. Tap Open my slip, download the slip, save it on your phone, and bring it with you to the clinic.
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…

### #23 'ok hain sab kuch' confirms the card — PASS

- **Patient** (voice): Dr Omar Sheikh se milna hai
- **Ayesha**: Ji zaroor! Kaun sa din theek rahega? Dr. Omar Sheikh ke khali waqt Tuesday 6 October, Thursday 8 October aur Saturday 10 October ko hain.
- **Patient** (voice): Tuesday 6 October
- **Ayesha**: Tuesday 6 October ko mere paas 2:00 PM, 3:30 PM, 6:15 PM aur 7:45 PM hain. Kaun sa waqt theek rahega?
- **Patient** (voice): 2:00 PM
- **Ayesha**: Aap ka poora naam kya hai?
- **Patient** (voice): mera naam Kashif Iqbal hai
- **Ayesha**: Aap se mil kar khushi hui, Kashif. Aap ka mobile number kya hai? Aahista aahista digits bata dein. Aap number bol sakte hain ya neeche likh bhi sakte hain.
- **Patient** (voice): zero three one two five five five six six seven seven
- **Ayesha**: Kya aap email dena chahenge? Yeh zaroori nahi, aap skip bhi keh sakte hain.
- **Patient** (voice): sohail khan at gmail
- **Ayesha**: Aap ki email s-o-h-a-i-l-k-h-a-n at gmail dot com, sahi hai?
- **Patient** (voice): ji
- **Ayesha**: Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): ok hain sab kuch
- **Ayesha**: Aap ki booking ho gayi, Kashif! Dr. Omar Sheikh, Tuesday 6 October 2:00 PM. Aap ka reference 6SP2 3ABW D5 hai. Open my slip dabaiye. Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…

### #24 Mid-way correction: name and number changed at the card, then 'jee' — PASS

- **Patient** (voice): mujhe allergy hai
- **Ayesha**: Aap fikar na karein, hum aap ka achhi tarah khayal rakhenge. Is ke liye hamara Dermatology department sahi rahega: Dr. Maryam Baloch (fee PKR 3,000). Yeh sirf rehnumai hai, diagnosis nahi. Kya main aap ki booking kar doon?
- **Patient** (voice): haan
- **Ayesha**: Ji zaroor! Kaun sa din theek rahega? Dr. Maryam Baloch ke khali waqt Monday 5 October, Wednesday 7 October aur Friday 9 October ko hain.
- **Patient** (voice): Monday 5 October
- **Ayesha**: Monday 5 October ko mere paas 12:15 PM, 1:45 PM, 3:15 PM aur 4:45 PM hain. Kaun sa waqt theek rahega?
- **Patient** (voice): 12:15 PM
- **Ayesha**: Aap ka poora naam kya hai?
- **Patient** (voice): Saima Noor
- **Ayesha**: Aap se mil kar khushi hui, Saima. Aap ka mobile number kya hai? Aahista aahista digits bata dein. Aap number bol sakte hain ya neeche likh bhi sakte hain.
- **Patient** (voice): zero three three three one two three four five six seven
- **Ayesha**: Kya aap email dena chahenge? Yeh zaroori nahi, aap skip bhi keh sakte hain.
- **Patient** (voice): skip
- **Ayesha**: Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): naam galat hai
- **Ayesha**: Aap ka poora naam kya hai?
- **Patient** (voice): mera naam Saima Nawaz hai
- **Ayesha**: Theek hai, Saima Nawaz. Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): number bhi galat hai
- **Ayesha**: Aap ka mobile number kya hai? Aahista aahista digits bata dein. Aap number bol sakte hain ya neeche likh bhi sakte hain.
- **Patient** (voice): zero three zero zero seven six five four three two one
- **Ayesha**: Theek hai, 0300 765 4321. Shukriya! Ji, main aap ki booking kar rahi hoon. Please card check karein, phir haan kahein ya Confirm dabaiye.
- **Patient** (voice): jee
- **Ayesha**: Aap ki booking ho gayi, Saima! Dr. Maryam Baloch, Monday 5 October 12:15 PM. Aap ka reference R29E VRW4 Z6 hai. Open my slip dabaiye. Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.
- **Slip page opened (English)**: Home Book an appointment Confirmation Your appointment is booked Keep your reference. This page is private to you. Save this slip: tap Download or take a screenshot. Show this reference at the clinic. Shuaib Health APPOI…
