# Photo swap pixel-diff (8 Nov 2026)

Playbook rule 5 evidence for PR #37. Tolerance 16/255 per channel; "photo area" = the bounding box of the replaced <img> (+2px), measured in the same browser setup as visual-baseline.spec.ts.

- Yes: / (desktop): only the General Medicine photo changed  
  Windows: 43,464 changed pixels, all inside the photo; Linux: 43,367 changed pixels, all inside the photo
- Yes: / (mobile): only the General Medicine photo changed  
  Windows: 20,121 changed pixels, all inside the photo; Linux: 20,139 changed pixels, all inside the photo
- Yes: /about (desktop): only the General Medicine photo changed  
  Windows: 188,439 changed pixels, all inside the photo; Linux: 188,392 changed pixels, all inside the photo
- Yes: /about (mobile): only the General Medicine photo changed  
  Windows: 87,030 changed pixels, all inside the photo; Linux: 87,084 changed pixels, all inside the photo
- Yes: /departments (desktop): only the General Medicine photo changed  
  Windows: 43,464 changed pixels, all inside the photo; Linux: 43,367 changed pixels, all inside the photo
- Yes: /departments (mobile): only the General Medicine photo changed  
  Windows: 19,986 changed pixels, all inside the photo; Linux: 19,989 changed pixels, all inside the photo
- Yes: /departments/general-medicine (desktop): only the General Medicine photo changed  
  Windows: 121,021 changed pixels, all inside the photo; Linux: 121,031 changed pixels, all inside the photo
- Yes: /departments/general-medicine (mobile): only the General Medicine photo changed  
  Windows: 86,650 changed pixels, all inside the photo; Linux: 86,684 changed pixels, all inside the photo
- Yes: /departments/dental (desktop): only the Dr. Bilal photo changed  
  Windows: 87,105 changed pixels, all inside the photo; Linux: 87,047 changed pixels, all inside the photo
- Yes: /departments/dental (mobile): only the Dr. Bilal photo changed  
  Windows: 8,320 changed pixels, all inside the photo; Linux: 8,335 changed pixels, all inside the photo
- Yes: /doctors (desktop): only the Dr. Bilal photo changed  
  Windows: 86,939 changed pixels, all inside the photo; Linux: 86,788 changed pixels, all inside the photo
- Yes: /doctors (mobile): only the Dr. Bilal photo changed  
  Windows: 8,320 changed pixels, all inside the photo; Linux: 8,335 changed pixels, all inside the photo
- Yes: /doctors/dr-bilal-ansari (desktop): only the Dr. Bilal photo changed  
  Windows: 66,427 changed pixels, all inside the photo; Linux: 66,279 changed pixels, all inside the photo
- Yes: /doctors/dr-bilal-ansari (mobile): only the Dr. Bilal photo changed  
  Windows: 65,638 changed pixels, all inside the photo; Linux: 65,667 changed pixels, all inside the photo
