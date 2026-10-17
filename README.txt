STUDENT STUDY PORTAL - FINAL VERSION

LOGIN FLOW
1. Open index.html first.
2. Common entrance credentials for every student:
   Username: student
   Password: 12345
3. After the common gate, login.html opens.
4. Each student creates/uses their OWN username and password on login.html.
5. That individual username is the account/data identifier.
6. All portal data (profile, subjects, attendance, assignments, notes, projects,
   timetable, results and performance) is separated by that individual account.

IMPORTANT
- Do not use the common index username as the student's data identifier.
- When an existing individual username is entered on login.html, its saved profile
  is loaded and its existing portal data is restored after the correct password.
- Logging out clears only the current session. Saved student data is not deleted.
- Protected pages redirect to index.html when no valid student session exists.
- Timetable reminders work while timetable.html is open. The page checks every 5
  seconds, checks again when the page becomes visible/focused, and uses a normal
  popup fallback when browser notifications are unavailable or denied.

RUNNING
A) Simple/static testing: open index.html in a browser.
B) Flask: install requirements.txt, then run:
   python app.py
   Open the local Flask address shown by Flask.

COMMON GATE
Username: student
Password: 12345

EXAMPLE INDIVIDUAL ACCOUNTS
Student A: username=saniya, password=1111
Student B: username=rahul, password=2222
These are examples only; students may create their own usernames/passwords.
