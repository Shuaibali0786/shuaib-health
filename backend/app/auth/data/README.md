# common-passwords.txt

Passwords refused by the staff password policy (`app/auth/passwords.py`). Read from disk once;
no network call is ever made at runtime.

- Built from SecLists `Passwords/Common-Credentials` (MIT): `10k-most-common`,
  `100k-most-used-passwords-NCSC`, `Pwdb_top-1000000`, `xato-net-10-million-passwords-100000`,
  plus the project's earlier hand-written list.
- Kept only entries of 12 to 128 characters (the policy minimum and maximum), lower-cased, valid
  UTF-8, de-duplicated, sorted. The policy compares the lower-cased password.
- The 10k list alone holds just 10 entries of 12+ characters, hence the larger sources.
